// Generates a per-skill learning plan using Gemini AI

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
    const { skills, jobDescription } = await req.json();

    if (!skills || !Array.isArray(skills) || skills.length === 0 || !jobDescription) {
      return NextResponse.json(
        { error: "skills (non-empty array) and jobDescription are required" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `
# Writing Standards
${contentStandards}

# Candidate Reference Profile
${candidateProfile}

      # Role
      You are a senior developer and career coach specialising in the Canberra technology market.

      # Task
      For each skill in the list, generate a practical learning plan that helps a developer add this skill to their resume within the shortest realistic time.

      # Skills to learn:
      ${skills.join(", ")}

      # Target Job Description:
      ${jobDescription}

      # Rules
      1. Be realistic about time estimates
      2. Focus on what can be demonstrated in a resume or interview
      3. Suggest a specific demo project for each skill
      4. Only recommend real, existing resources (official docs, Coursera, YouTube, MDN, etc.)
      5. Every step must include at least one resource and one aiPrompt
      6. If a URL is uncertain, use the platform name (e.g. "Coursera" or "YouTube") instead
      7. Output MUST be valid JSON with no markdown formatting

      # Expected Output Format
      {
        "plans": [
          {
            "skill": "skill name",
            "totalTime": "24-48 hours",
            "steps": [
              {
                "day": "Day 1 (4hrs)",
                "task": "Read official docs and watch intro tutorial",
                "resources": [
                  {
                    "type": "video",
                    "title": "Angular in 100 Seconds",
                    "url": "https://www.youtube.com/watch?v=Ata9cSC2WpM"
                  },
                  {
                    "type": "docs",
                    "title": "Angular — Getting Started",
                    "url": "https://angular.dev/tutorials/learn-angular"
                  }
                ],
                "aiPrompt": "Teach me Angular components with a hands-on example. I know React so explain the differences."
              }
            ],
            "demoProject": "Brief description of a demo project to add to resume",
            "resumeBullet": "One ready-to-use resume bullet point: Built [X] with [skill]..."
          }
        ]
      }

      # Resource type values
      Use only: "video", "docs", "book", "course", "article"
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
