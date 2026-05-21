// src/app/api/analyze/route.ts
// Analyzes resume-job alignment using Gemini AI and returns structured feedback

import { NextRequest, NextResponse } from "next/server";
import { isRateLimitError } from "@/lib/utils";
import { checkAndIncrement, checkAndIncrementGlobal, IP_LIMIT, GLOBAL_LIMIT, getResetTimeISO } from "@/lib/rateLimit";
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
          {
            error: "今日网站使用总次数已满，请明天再试。",
            reason: "global_limit",
            ipCount: 0,
            globalCount: result.globalCount,
            ipLimit: IP_LIMIT,
            globalLimit: GLOBAL_LIMIT,
            resetAt: getResetTimeISO(),
          },
          { status: 429 }
        );
      }
    } else {
      const rateLimit = await checkAndIncrement(getIP(req));
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: rateLimit.reason === "global_limit"
              ? "今日网站使用总次数已满，请明天再试。"
              : "您今日的使用次数已达上限，请明天再试。",
            reason: rateLimit.reason,
            ipCount: rateLimit.ipCount,
            globalCount: rateLimit.globalCount,
            ipLimit: IP_LIMIT,
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
- Citizenship, residency, and clearance requirements → gaps array only, never skillGaps: "Requires [exact requirement] — eligibility requirement, not a learnable skill"

# Category Definitions (assign honestly — do not over-optimise)
- interview_ready: Conceptual, 4-8 hours. Required fields: skill, reason, category, timeEstimate, interviewTip.
- quick_win: Genuinely learnable 24-48 hours, addable to resume. Required fields: + quickWinPlan.
- long_term: 1+ month sustained effort. Required fields: + longTermPartA, longTermPartB.

Every skill must have an interviewTip. Omit category-specific fields that don't apply.

# Input
RESUME: ${resumeText}
JOB DESCRIPTION: ${jobDescription}

# Output Format
Return ONLY valid JSON — no markdown, no explanation. You MUST include the skillGaps array even if empty:
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
      "longTermPartB": "(long_term only) ..."
    }
  ]
}
`;

    const responseText = await generateWithFallback(async (client) => {
      const model = client.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

    // Extract JSON — strip markdown code fences if present
    let cleanJson = responseText;
    if (responseText.includes("```")) {
      const match = responseText.match(/```(?:json)?([\s\S]*?)```/);
      if (match) cleanJson = match[1].trim();
    }

    try {
      const analysis = JSON.parse(cleanJson);
      return NextResponse.json(analysis);
    } catch (parseError) {
      console.error("JSON parse error. Raw response:", responseText);
      return NextResponse.json(
        { error: "AI returned an invalid format. Please try again." },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Gemini analysis error:", error);

    if (isRateLimitError(error)) {
      return NextResponse.json(
        {
          error:
            "API rate limit exceeded. Please wait a minute before retrying.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to connect to AI engine" },
      { status: 500 }
    );
  }
}
