// src/app/api/analyze/route.ts
// Analyzes resume-job alignment using Gemini AI and returns structured feedback

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { isRateLimitError } from "@/lib/utils";
import fs from "fs";
import path from "path";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

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

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

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
