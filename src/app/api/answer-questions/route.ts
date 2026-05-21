// Answers employer screening questions using the candidate's resume and JD

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
    const { questions, resumeText, jobDescription } = await req.json();

    if (!questions || !resumeText || !jobDescription) {
      return NextResponse.json(
        { error: "questions, resumeText, and jobDescription are required" },
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

    const responseText = await generateWithFallback(async (client) => {
      const model = client.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

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
