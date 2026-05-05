// src/app/api/analyze/route.ts
// Analyzes resume-job alignment using Gemini AI and returns structured feedback

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
{
  "score": 0-100,
  "summary": "2-3 sentence overview",
  "strengths": ["Specific skill match 1", "Specific skill match 2"],
  "gaps": ["Missing mandatory skill 1"],
  "suggestions": ["Actionable advice referencing specific resume content"]
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
  } catch (error: any) {
    console.error("Gemini analysis error:", error);

    if (error.status === 429 || error.message?.includes("429")) {
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
