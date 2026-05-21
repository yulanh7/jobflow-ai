// Answers employer screening questions using the candidate's resume and JD

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { isRateLimitError } from "@/lib/utils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
      # Role
      You are an expert career coach helping a candidate answer employer screening questions for a job application in Australia.

      # Candidate Profile
      ${resumeText}

      # Job Description
      ${jobDescription}

      # Employer Questions
      ${questions}

      # Rules
      1. Answer each question directly and concisely
      2. Base answers ONLY on information in the candidate profile
      3. For right to work questions: candidate is based in Australia with valid work rights
      4. For security clearance questions: answer honestly based on resume
      5. Keep each answer to 1-2 sentences maximum
      6. Use plain, direct language — no corporate jargon
      7. Format: list each question followed immediately by the answer
      8. Never use these words: keen, comprehensive, robust, seamlessly, leverage, ensure, facilitate
      9. Output MUST be valid JSON:
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
