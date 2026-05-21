// src/app/api/analyze/route.ts
// Analyzes resume-job alignment using Gemini AI and returns structured feedback

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { isRateLimitError } from "@/lib/utils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
      # Role
      You are a senior technical recruiter specialising in the Canberra technology market.

      # Task
      Evaluate the candidate's alignment with the provided Job Description.

      # Scoring Criteria
      - 80-100: Strong match, most required skills explicitly present
      - 60-79: Good match, majority of skills present with minor gaps
      - 40-59: Moderate match, some key skills missing
      - 0-39: Weak match, significant gaps

      # Critical Constraints
      1. Base evaluation ONLY on explicit evidence in the RESUME text.
      2. Do not infer or assume skills that are not mentioned.
      3. Scoring must be strictly objective.
      4. Output MUST be valid JSON with no markdown formatting.

      # Input Data
      RESUME: ${resumeText}
      JOB DESCRIPTION: ${jobDescription}

      # Expected Output Format
      You MUST include the skillGaps array in your response. This is required. Do not omit it even if there are no gaps.

      {
        "score": 0-100,
        "summary": "2-3 sentence overview",
        "strengths": ["Specific skill match 1", "Specific skill match 2"],
        "gaps": ["Missing mandatory skill or experience explicitly required by the JD"],
        "suggestions": ["Actionable advice referencing specific resume content"],
        "skillGaps": [
          {
            "skill": "Angular",
            "reason": "Explicitly required in JD but not found in resume",
            "category": "quick_win",
            "timeEstimate": "24-48 hours",
            "interviewTip": "Mention React experience and explain Angular shares similar component concepts — show willingness to ramp up quickly",
            "quickWinPlan": "Complete the official Angular Tour of Heroes tutorial, then build a small CRUD app. Enough to discuss confidently in interview."
          },
          {
            "skill": "AWS / Cloud Infrastructure",
            "reason": "JD requires cloud deployment experience but resume shows only on-premise deployments",
            "category": "long_term",
            "timeEstimate": "1-2 months",
            "interviewTip": "Highlight your Docker and server deployment experience as a transferable foundation, and mention you are actively building cloud skills",
            "longTermPartA": "Complete AWS Cloud Practitioner or Solutions Architect Associate — gives you the credibility to discuss cloud architecture in interviews",
            "longTermPartB": "Deploy a personal project to AWS (EC2 + S3 + RDS) to demonstrate hands-on cloud experience on your resume"
          }
        ]
      }

      # skillGaps Rules
      - Only include skills explicitly required by the JD that are absent from the resume.
      - Maximum 5 entries, ordered by impact on the hiring decision.
      - If no skill gaps exist, return an empty array [] — never omit the skillGaps field.
      - Never include language skills (e.g. Mandarin, Chinese, English) as skill gaps. Language proficiency cannot be learned in hours and is a personal attribute, not a technical skill gap. If the JD requires a language, note it in the gaps array instead with a suggestion to explicitly state language skills in the resume if the candidate already speaks the language.
      - Citizenship, residency, and security clearance requirements (e.g. "must be an Australian citizen", "active Baseline Security Clearance", "NV1", "NV2", "must hold PR") MUST appear in the gaps array as plain text — they are eligibility criteria, not learnable skills. They MUST NOT appear in skillGaps under any circumstances. Write them in gaps as: "Requires [exact requirement from JD] — eligibility requirement, not a learnable skill".

      # Category Definitions (assign honestly — do not over-optimise)
      - interview_ready: Conceptual skills where understanding core concepts is enough to pass an interview question.
        Time: 4-8 hours. Examples: specific methodologies, lightweight frameworks, tooling conventions.
        Required fields: skill, reason, category, timeEstimate, interviewTip.
      - quick_win: Technical skills genuinely learnable in 24-48 hours and addable to the resume.
        Time: 24-48 hours. Examples: Python basics, a specific UI framework, a standard specification.
        Required fields: skill, reason, category, timeEstimate, interviewTip, quickWinPlan.
      - long_term: Complex skills or credentials requiring 1+ month of sustained effort.
        Time: 1 month+. Examples: cybersecurity depth, security clearance applications, deep system architecture.
        Required fields: skill, reason, category, timeEstimate, interviewTip, longTermPartA, longTermPartB.

      Categorise each skill gap honestly based on realistic learning time.
      Do not over-optimise — if a skill genuinely takes months, mark it long_term.
      Every skill must have an interviewTip regardless of category.
      Omit quickWinPlan for non-quick_win entries. Omit longTermPartA/longTermPartB for non-long_term entries.
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
