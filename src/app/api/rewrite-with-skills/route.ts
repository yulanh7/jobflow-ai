// Rewrites resume and cover letter incorporating selected skill gaps

import { NextRequest, NextResponse } from "next/server";
import { SchemaType } from "@google/generative-ai";
import { isRateLimitError, isDbError } from "@/lib/utils";
import { checkAndIncrementFeature, checkAndIncrementGlobal, FEATURE_LIMITS, GLOBAL_LIMIT, getResetTimeISO, type RefundFn } from "@/lib/rateLimit";
import { generateWithFallback } from "@/lib/gemini";
import { buildSystemInstruction } from "@/prompts/system";
import { buildQualificationRules } from "@/prompts/workRights";
import { getCandidateProfile } from "@/lib/candidateProfile";

function getIP(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

function isStudioRequest(req: NextRequest): boolean {
  const pw = req.headers.get("x-studio-password");
  return !!process.env.STUDIO_PASSWORD && pw === process.env.STUDIO_PASSWORD;
}

export async function POST(req: NextRequest) {
  // Set once usage is charged; called on failure so users don't lose a credit
  let refundUsage: RefundFn | undefined;

  try {
    const {
      resumeText,
      jobDescription,
      selectedGaps,
      candidateName,
      confirmedQualifications,
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

    const isStudio = isStudioRequest(req);
    if (isStudio) {
      const result = await checkAndIncrementGlobal();
      if (result.allowed) refundUsage = result.refund;
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

    // Personal profile is studio-only; public users must never receive it
    const candidateProfile = isStudio ? getCandidateProfile() : "";

    const todayDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const prompt = `
${buildQualificationRules(confirmedQualifications)}

# Task
Rewrite the resume and cover letter to incorporate the selected skills.

Skill category behaviour:
- quick_win: Add to Skills section + one bullet under a "Personal Projects" section (create it if absent): "Built [demo] using [skill] to [outcome]". Never place it under an employer's role.
- interview_ready: Add to Skills section only; cover letter: "expanding knowledge in [skill]"
- long_term: Cover letter only — "I'm aware this role requires [skill] and I'm actively working towards it"

Additional resume constraints:
- Only use metrics from the original resume — never invent numbers
- Keep all original job titles, company names, and dates unchanged
- Keep it to one page: never add more bullets to a role than the original resume has
- Output plain text — no markdown, no asterisks, no bold markers

# Input
<resume>
${resumeText}
</resume>

<job_description>
${jobDescription}
</job_description>

<selected_skills>
${JSON.stringify(selectedGaps, null, 2)}
</selected_skills>

# Cover Letter Format
- Header: extract name, email, phone from the resume — output on separate lines (name, then email, then phone)
- Date: "${todayDate}"
- Greeting: scan JD for hiring manager name → "Dear [Name]," or "Dear Hiring Manager,"
- Closing: "Kind regards,\n\n${candidateName?.trim() || "[Your Name]"}"

# Cover Letter Para 2 — weave in new skills
For quick_win skills: mention as a recent personal project. For interview_ready: "expanding knowledge in [skill]". For long_term: one honest sentence only. Do NOT list technologies — tell a story about impact.

# Output Fields
- resume: full rewritten resume as plain text, use \\n for line breaks
- coverLetter: full rewritten cover letter as plain text, use \\n for line breaks
`;

    const responseText = await generateWithFallback(async (client) => {
      // JSON mode guarantees valid JSON output
      const model = client.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: buildSystemInstruction(candidateProfile),
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

    await refundUsage?.();
    console.error("JSON parse error. Raw response:", responseText);
    return NextResponse.json(
      { error: "AI returned an invalid format. Please try again." },
      { status: 500 }
    );
  } catch (error: unknown) {
    await refundUsage?.();
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
