// Generates a per-skill learning plan using Gemini AI

import { NextRequest, NextResponse } from "next/server";
import { isRateLimitError } from "@/lib/utils";
import { checkAndIncrementGlobal, GLOBAL_LIMIT, getResetTimeISO } from "@/lib/rateLimit";
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
    const { skills, jobDescription } = await req.json();

    if (!skills || !Array.isArray(skills) || skills.length === 0 || !jobDescription) {
      return NextResponse.json(
        { error: "skills (non-empty array) and jobDescription are required" },
        { status: 400 }
      );
    }

    if (!isStudioRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await checkAndIncrementGlobal();
    if (!result.allowed) {
      return NextResponse.json(
        { error: "今日网站使用总次数已满，请明天再试。", reason: "global_limit", globalCount: result.globalCount, globalLimit: GLOBAL_LIMIT, resetAt: getResetTimeISO() },
        { status: 429 }
      );
    }

    const prompt = `
# Rules
${contentStandards}

# Candidate Profile
${candidateProfile}

# Task
For each skill, generate a practical learning plan to add it to a developer's resume within the shortest realistic time. Be realistic about time estimates. Focus on what can be demonstrated in a resume or interview. Suggest a specific demo project per skill. Only recommend real, existing resources (official docs, Coursera, YouTube, MDN, etc.). Every step must include at least one resource and one aiPrompt. If a URL is uncertain, use the platform name instead of guessing.

# Input

## Skills to Learn
${skills.join(", ")}

## Target Job Description
${jobDescription}

# Output Format
Return ONLY valid JSON — no markdown, no explanation:
{
  "plans": [
    {
      "skill": "skill name",
      "totalTime": "24-48 hours",
      "steps": [
        {
          "day": "Day 1 (4hrs)",
          "task": "description of what to do",
          "resources": [
            {
              "type": "video",
              "title": "Resource Title",
              "url": "https://..."
            }
          ],
          "aiPrompt": "Teach me X with a hands-on example..."
        }
      ],
      "demoProject": "Brief description of demo project to add to resume",
      "resumeBullet": "One ready-to-use bullet: Built [X] with [skill]..."
    }
  ]
}

Resource type values — use only: "video", "docs", "book", "course", "article"
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
      const plan = JSON.parse(cleanJson);
      return NextResponse.json(plan);
    } catch (parseError) {
      console.error("JSON parse error. Raw response:", responseText);
      return NextResponse.json(
        { error: "AI returned an invalid format. Please try again." },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Learning plan generation error:", error);

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
