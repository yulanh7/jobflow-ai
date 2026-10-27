// Analyzes resume-job alignment and generates learning plans for all skill gaps

import { NextRequest, NextResponse } from "next/server";
import { isRateLimitError, isDbError } from "@/lib/utils";
import { checkAndIncrementFeature, checkAndIncrementGlobal, FEATURE_LIMITS, GLOBAL_LIMIT, getResetTimeISO, type RefundFn } from "@/lib/rateLimit";
import { generateWithFallback } from "@/lib/gemini";
import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { buildSystemInstruction, RESOURCE_URL_RULE } from "@/prompts/system";
import { getCandidateProfile } from "@/lib/candidateProfile";

function getIP(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

function isStudioRequest(req: NextRequest): boolean {
  const pw = req.headers.get("x-studio-password");
  return !!process.env.STUDIO_PASSWORD && pw === process.env.STUDIO_PASSWORD;
}

const STRING = { type: SchemaType.STRING } as const;
const STRING_LIST = { type: SchemaType.ARRAY, items: STRING } as const;

const ANALYSIS_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    score: { type: SchemaType.INTEGER },
    summary: STRING,
    strengths: STRING_LIST,
    gaps: STRING_LIST,
    suggestions: STRING_LIST,
    skillGaps: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          skill: STRING,
          reason: STRING,
          category: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["interview_ready", "quick_win", "long_term"],
          },
          timeEstimate: STRING,
          interviewTip: STRING,
          quickWinPlan: STRING,
          longTermPartA: STRING,
          longTermPartB: STRING,
          steps: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                day: STRING,
                task: STRING,
                resources: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      type: {
                        type: SchemaType.STRING,
                        format: "enum",
                        enum: ["video", "docs", "book", "course", "article"],
                      },
                      title: STRING,
                      url: STRING,
                    },
                    required: ["type", "title", "url"],
                  },
                },
                aiPrompt: STRING,
              },
              required: ["day", "task", "resources", "aiPrompt"],
            },
          },
          demoProject: STRING,
          resumeBullet: STRING,
        },
        required: ["skill", "reason", "category", "timeEstimate", "interviewTip", "steps", "demoProject", "resumeBullet"],
      },
    },
  },
  required: ["score", "summary", "strengths", "gaps", "suggestions", "skillGaps"],
};

export async function POST(req: NextRequest) {
  // Set once usage is charged; called on failure so users don't lose a credit
  let refundUsage: RefundFn | undefined;

  try {
    const { resumeText, jobDescription } = await req.json();

    if (!resumeText || !jobDescription) {
      return NextResponse.json(
        { error: "Resume text and job description are required" },
        { status: 400 }
      );
    }

    const isStudio = isStudioRequest(req);
    if (isStudio) {
      const result = await checkAndIncrementGlobal();
      if (result.allowed) refundUsage = result.refund;
      if (!result.allowed) {
        return NextResponse.json(
          { error: "今日网站使用总次数已满，请明天再试。", reason: "global_limit", globalCount: result.globalCount, globalLimit: GLOBAL_LIMIT, resetAt: getResetTimeISO() },
          { status: 429 }
        );
      }
    } else {
      const rateLimit = await checkAndIncrementFeature(getIP(req), "analyze");
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: rateLimit.reason === "global_limit"
              ? "今日网站使用总次数已满，请明天再试。"
              : "您今日的分析次数已达上限，请明天再试。",
            reason: rateLimit.reason,
            featureCount: rateLimit.featureCount,
            globalCount: rateLimit.globalCount,
            featureLimit: FEATURE_LIMITS.analyze,
            globalLimit: GLOBAL_LIMIT,
            resetAt: getResetTimeISO(),
          },
          { status: 429 }
        );
      }
    }

    // Personal profile is studio-only; public users must never receive it
    const candidateProfile = isStudio ? getCandidateProfile() : "";

    const prompt = `
# Task
Evaluate the candidate's alignment with the job description. Score 0-100:
- 80-100: Strong match, most required skills explicitly present
- 60-79: Good match, majority of skills present with minor gaps
- 40-59: Moderate match, some key skills missing
- 0-39: Weak match, significant gaps

Base evaluation ONLY on explicit evidence in the resume. Do not infer skills. Scoring must be objective.

# Field Rules
- summary: 2-3 sentence overview
- strengths: specific skill matches between resume and JD
- gaps: missing mandatory skills or eligibility requirements
- suggestions: actionable advice referencing specific resume content

# skillGaps Rules
- Only include skills explicitly required by the JD that are absent from the resume
- Maximum 5 entries, ordered by impact on the hiring decision
- If no gaps exist, return an empty array
- Never include language skills as skill gaps — note them in the gaps array instead
- Citizenship, residency, and clearance requirements → gaps array only, never skillGaps

# Category Definitions (assign honestly — do not over-optimise)
- interview_ready: Conceptual only, 4-8 hours. Can be discussed in interview but not built yet.
- quick_win: Genuinely learnable in 24-48 hours, buildable demo, addable to resume as a personal project.
- long_term: 1+ month sustained effort to reach employable level.

Every skill gap must have an interviewTip. Fill quickWinPlan only for quick_win, longTermPartA/longTermPartB only for long_term.

# Learning Plan (required for every skill gap)
- steps: 2-4 steps proportional to timeEstimate
  - day: e.g. "Day 1 (3hrs)"
  - task: concrete action to take
  - resources: at least one per step, type is one of video, docs, book, course, article
  - aiPrompt: a practical prompt the user can paste into an AI assistant to learn hands-on
- demoProject: one specific, buildable demo that proves this skill (one sentence)
- resumeBullet: "Built [X] using [skill] to [outcome]" — for a personal project, ready to paste
- ${RESOURCE_URL_RULE}

# Input
<resume>
${resumeText}
</resume>

<job_description>
${jobDescription}
</job_description>
`;

    const responseText = await generateWithFallback(async (client) => {
      // JSON mode + schema: long nested output from flash-lite otherwise breaks JSON.parse
      const model = client.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: buildSystemInstruction(candidateProfile),
        generationConfig: {
          // Low temperature keeps scores stable across reruns of the same input
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: ANALYSIS_SCHEMA,
        },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

    let cleanJson = responseText;
    if (responseText.includes("```")) {
      const match = responseText.match(/```(?:json)?([\s\S]*?)```/);
      if (match) cleanJson = match[1].trim();
    }

    try {
      const analysis = JSON.parse(cleanJson);
      return NextResponse.json(analysis);
    } catch {
      await refundUsage?.();
      console.error("JSON parse error. Raw response:", responseText);
      return NextResponse.json(
        { error: "AI returned an invalid format. Please try again." },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    await refundUsage?.();
    console.error("Analysis error:", error);
    if (isRateLimitError(error)) {
      return NextResponse.json({ error: "API rate limit exceeded. Please wait a minute before retrying." }, { status: 429 });
    }
    if (isDbError(error)) {
      return NextResponse.json({ error: "Database connection error. Check your Upstash Redis environment variables." }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to connect to AI engine" }, { status: 500 });
  }
}
