// Analyzes resume-job alignment and generates learning plans for all skill gaps

import { NextRequest, NextResponse } from "next/server";
import { isRateLimitError, isDbError } from "@/lib/utils";
import { checkAndIncrementFeature, checkAndIncrementGlobal, FEATURE_LIMITS, GLOBAL_LIMIT, getResetTimeISO } from "@/lib/rateLimit";
import { generateWithFallback } from "@/lib/gemini";
import fs from "fs";
import path from "path";

function getIP(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

function isStudioRequest(req: NextRequest): boolean {
  const pw = req.headers.get("x-studio-password");
  return !!process.env.STUDIO_PASSWORD && pw === process.env.STUDIO_PASSWORD;
}

const skillsDir = path.join(process.cwd(), ".claude/skills");
let contentStandards = "";
let candidateProfile = "";
try {
  contentStandards = fs.readFileSync(path.join(skillsDir, "content-standards/SKILL.md"), "utf-8");
  candidateProfile = fs.readFileSync(path.join(skillsDir, "my-profile/SKILL.md"), "utf-8");
} catch { /* skills not available in this environment */ }

export async function POST(req: NextRequest) {
  try {
    const { resumeText, jobDescription } = await req.json();

    if (!resumeText || !jobDescription) {
      return NextResponse.json(
        { error: "Resume text and job description are required" },
        { status: 400 }
      );
    }

    if (isStudioRequest(req)) {
      const result = await checkAndIncrementGlobal();
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

    const prompt = `
# Rules
${contentStandards}

# Candidate Profile
${candidateProfile}

# Task
Evaluate the candidate's alignment with the provided Job Description. Score 0-100:
- 80-100: Strong match, most required skills explicitly present
- 60-79: Good match, majority of skills present with minor gaps
- 40-59: Moderate match, some key skills missing
- 0-39: Weak match, significant gaps

Base evaluation ONLY on explicit evidence in the resume. Do not infer skills. Scoring must be objective.

# skillGaps Rules
- Only include skills explicitly required by the JD that are absent from the resume
- Maximum 5 entries, ordered by impact on the hiring decision
- If no gaps exist, return an empty array [] — never omit the field
- Never include language skills as skill gaps — note them in the gaps array instead
- Citizenship, residency, and clearance requirements → gaps array only, never skillGaps

# Category Definitions (assign honestly — do not over-optimise)
- interview_ready: Conceptual only, 4-8 hours. Can be discussed in interview but not built yet.
- quick_win: Genuinely learnable 24-48 hours, buildable demo, addable to resume.
- long_term: 1+ month sustained effort to reach employable level.

Every skill must have an interviewTip. Omit category-specific plan fields that don't apply.

# Learning Plan (REQUIRED for every skillGap — even if gaps array is empty, return skillGaps: [])
For EACH skill gap, generate a practical learning plan immediately actionable. Use only real, existing resources (official docs, YouTube, Coursera, MDN). If a URL is uncertain, use the platform name as the url value.

Learning plan additions per skillGap:
- steps: 2-4 steps proportional to timeEstimate
  - day: e.g. "Day 1 (3hrs)"
  - task: concrete action to take
  - resources: at least one per step — [{type, title, url}] (types: "video" "docs" "book" "course" "article")
  - aiPrompt: a practical prompt the user can paste into an AI assistant to learn hands-on
- demoProject: one specific, buildable demo that proves this skill on a resume (one sentence)
- resumeBullet: "Built [X] using [skill] to [outcome]" — ready to paste

# Input
RESUME: ${resumeText}
JOB DESCRIPTION: ${jobDescription}

# Output Format
Return ONLY valid JSON — no markdown, no explanation:
{
  "score": 0-100,
  "summary": "2-3 sentence overview",
  "strengths": ["Specific skill match"],
  "gaps": ["Missing mandatory skill or eligibility requirement"],
  "suggestions": ["Actionable advice referencing specific resume content"],
  "skillGaps": [
    {
      "skill": "Angular",
      "reason": "Explicitly required in JD but not found in resume",
      "category": "quick_win",
      "timeEstimate": "24-48 hours",
      "interviewTip": "...",
      "quickWinPlan": "(quick_win only) ...",
      "longTermPartA": "(long_term only) ...",
      "longTermPartB": "(long_term only) ...",
      "steps": [
        {
          "day": "Day 1 (4hrs)",
          "task": "...",
          "resources": [{"type": "video", "title": "Angular Crash Course", "url": "https://youtube.com/..."}],
          "aiPrompt": "Teach me Angular components with a hands-on example..."
        }
      ],
      "demoProject": "Build a task manager SPA with Angular routing and services",
      "resumeBullet": "Built a task manager SPA using Angular to demonstrate component-based architecture"
    }
  ]
}
`;

    const responseText = await generateWithFallback(async (client) => {
      const model = client.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
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
      console.error("JSON parse error. Raw response:", responseText);
      return NextResponse.json(
        { error: "AI returned an invalid format. Please try again." },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Analysis error:", error);
    if (isRateLimitError(error)) {
      return NextResponse.json({ error: "API rate limit exceeded. Please wait a minute before retrying." }, { status: 429 });
    }
    if (isDbError(error)) {
      return NextResponse.json({ error: "Database connection error. Check your MONGODB_URI." }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to connect to AI engine" }, { status: 500 });
  }
}
