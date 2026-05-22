// Rewrites resume and cover letter incorporating selected skill gaps

import { NextRequest, NextResponse } from "next/server";
import { SchemaType } from "@google/generative-ai";
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
    const {
      resumeText,
      jobDescription,
      selectedGaps,
      candidateName,
      confirmedQualifications,
      paragraphCount,
    } = await req.json();

    if (
      !resumeText ||
      !jobDescription ||
      !Array.isArray(selectedGaps) ||
      selectedGaps.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "resumeText, jobDescription, and selectedGaps (non-empty array) are required",
        },
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
            globalCount: result.globalCount,
            globalLimit: GLOBAL_LIMIT,
            resetAt: getResetTimeISO(),
          },
          { status: 429 }
        );
      }
    } else {
      const rateLimit = await checkAndIncrementFeature(getIP(req), "documents");
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: rateLimit.reason === "global_limit"
              ? "今日网站使用总次数已满，请明天再试。"
              : "您今日的文件生成次数已达上限，请明天再试。",
            reason: rateLimit.reason,
            featureCount: rateLimit.featureCount,
            globalCount: rateLimit.globalCount,
            featureLimit: FEATURE_LIMITS.documents,
            globalLimit: GLOBAL_LIMIT,
            resetAt: getResetTimeISO(),
          },
          { status: 429 }
        );
      }
    }

    const todayDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const prompt = `
# Rules
${contentStandards}

# Candidate Profile
${candidateProfile}

# Confirmed Qualifications (CRITICAL — runtime data)
CONFIRMED QUALIFICATIONS: ${confirmedQualifications?.length > 0 ? confirmedQualifications.join(", ") : "NONE"}
- CITIZENSHIP: If "Australian Citizen" NOT in confirmed list → DO NOT mention citizenship → use "I hold full Australian working rights."
- SECURITY CLEARANCE: If clearance NOT in confirmed list → do NOT claim it.
  - Citizenship confirmed → "I am ready to undergo the vetting process for [Clearance Level] upon sponsorship."
  - Citizenship NOT confirmed → "I am willing to undergo all required background and character suitability assessments."
- Never infer citizenship, PR status, or clearance from the resume.

# Task
Rewrite the resume and cover letter to incorporate the selected skills.

Skill category behaviour:
- quick_win: Add to Skills section + new bullet in most relevant role: "Built [demo] using [skill] to [outcome]"
- interview_ready: Add to Skills section only; cover letter: "expanding knowledge in [skill]"
- long_term: Cover letter only — "I'm aware this role requires [skill] and I'm actively working towards it"

Additional resume constraints:
- Only use metrics from the original resume — never invent numbers
- Keep all original job titles, company names, and dates unchanged
- Output plain text — no markdown, no asterisks, no bold markers

${paragraphCount ? `Line count (CRITICAL): original DOCX has exactly ${paragraphCount} non-empty lines. Rewritten resume MUST output EXACTLY ${paragraphCount} non-empty lines.` : ""}

# Input

## Uploaded Resume
${resumeText}

## Job Description
${jobDescription}

## Selected Skills to Incorporate
${JSON.stringify(selectedGaps, null, 2)}

# Cover Letter Format
- Header: extract name, email, phone from Candidate Profile — output on separate lines (name, then email, then phone)
- Date: "${todayDate}"
- Greeting: scan JD for hiring manager name → "Dear [Name]," or "Dear Hiring Manager,"
- Closing: "Kind regards,\n\n${candidateName?.trim() || "[Your Name]"}"

# Cover Letter Para 2 — weave in new skills
For quick_win skills: mention as recently applied. For interview_ready: "expanding knowledge in [skill]". For long_term: one honest sentence only. Do NOT list technologies — tell a story about impact.

# Output Format
Return ONLY valid JSON — no markdown, no explanation:
{
  "resume": "full rewritten resume as plain text, use \\n for line breaks",
  "coverLetter": "full rewritten cover letter as plain text, use \\n for line breaks"
}
`;

    const responseText = await generateWithFallback(async (client) => {
      // JSON mode guarantees valid JSON output
      const model = client.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              resume: { type: SchemaType.STRING },
              coverLetter: { type: SchemaType.STRING },
            },
            required: ["resume", "coverLetter"],
          },
        },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

    // Attempt 1: direct parse
    try {
      const documents = JSON.parse(responseText);
      return NextResponse.json(documents);
    } catch {
      // fall through to extraction attempts
    }

    // Attempt 2: strip markdown fences then parse
    let cleanJson = responseText;
    if (responseText.includes("```")) {
      const fenceMatch = responseText.match(/```(?:json)?([\s\S]*?)```/);
      if (fenceMatch) cleanJson = fenceMatch[1].trim();
    }

    try {
      const documents = JSON.parse(cleanJson);
      return NextResponse.json(documents);
    } catch {
      // fall through to brace extraction
    }

    // Attempt 3: extract outermost { } block
    const braceMatch = responseText.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        const documents = JSON.parse(braceMatch[0]);
        return NextResponse.json(documents);
      } catch {
        // fall through to error
      }
    }

    console.error("JSON parse error. Raw response:", responseText);
    return NextResponse.json(
      { error: "AI returned an invalid format. Please try again." },
      { status: 500 }
    );
  } catch (error: unknown) {
    console.error("Rewrite with skills error:", error);

    if (isRateLimitError(error)) {
      return NextResponse.json({ error: "API rate limit exceeded. Please wait a minute before retrying." }, { status: 429 });
    }
    if (isDbError(error)) {
      return NextResponse.json({ error: "Database connection error. Check your MONGODB_URI." }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to connect to AI engine" }, { status: 500 });
  }
}
