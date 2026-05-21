// Answers employer screening questions using the candidate's resume and JD

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
    const { questions, resumeText, jobDescription } = await req.json();

    if (!questions || !resumeText || !jobDescription) {
      return NextResponse.json(
        { error: "questions, resumeText, and jobDescription are required" },
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
Answer each employer screening question directly and concisely. Base answers ONLY on information in the candidate profile and uploaded resume. Keep each answer to 1-2 sentences maximum.

# Input

## Uploaded Resume
${resumeText}

## Job Description
${jobDescription}

## Employer Questions
${questions}

# Output Format
Return ONLY valid JSON — no markdown, no explanation:
{
  "answers": [
    {
      "question": "original question text",
      "answer": "concise answer"
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Strip markdown code fences if present
    let cleanJson = responseText;
    if (responseText.includes("```")) {
      const match = responseText.match(/```(?:json)?([\s\S]*?)```/);
      if (match) cleanJson = match[1].trim();
    }

    try {
      const data = JSON.parse(cleanJson);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error("JSON parse error. Raw response:", responseText);
      return NextResponse.json(
        { error: "AI returned an invalid format. Please try again." },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Answer questions error:", error);

    if (isRateLimitError(error)) {
      return NextResponse.json(
        { error: "API rate limit exceeded. Please wait a minute before retrying." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to connect to AI engine" },
      { status: 500 }
    );
  }
}
