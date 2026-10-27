// Generates a tailored resume and/or cover letter using Gemini AI

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

async function researchCompany(jobDescription: string): Promise<string> {
  try {
    return await generateWithFallback(async (client) => {
      const model = client.getGenerativeModel({
        model: "gemini-2.0-flash",
        tools: [{ googleSearch: {} }] as never,
      });
      const result = await model.generateContent(
        `From this job description, identify the company name and research it. Return 2-3 factual sentences covering: what the company/organisation does, their key product or platform (with its actual name if known), and their mission or target audience. Be specific — use real product names and numbers if found. Job description: ${jobDescription.substring(0, 1500)}`
      );
      return result.response.text().trim();
    });
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  // Set once usage is charged; called on failure so users don't lose a credit
  let refundUsage: RefundFn | undefined;

  try {
    const {
      resumeText,
      jobDescription,
      extraContext,
      generateResume,
      generateCoverLetter,
      confirmedQualifications,
      feedback,
      previousResume,
      previousCoverLetter,
      candidateName,
      companyBackground,
    } = await req.json();

    if (!resumeText || !jobDescription) {
      return NextResponse.json(
        { error: "resumeText and jobDescription are required" },
        { status: 400 }
      );
    }

    if (!generateResume && !generateCoverLetter) {
      return NextResponse.json(
        {
          error:
            "At least one of generateResume or generateCoverLetter must be true",
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

    // User-supplied background takes precedence; Google Search fills the gap
    let companyContext = "";
    if (generateCoverLetter) {
      const searchResult = await researchCompany(jobDescription);
      companyContext = [companyBackground, searchResult].filter(Boolean).join("\n\n");
    }

    // Personal profile is studio-only; public users must never receive it
    const candidateProfile = isStudio ? getCandidateProfile() : "";

    const todayDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const prompt = `
# Task
${generateResume ? "Generate a tailored one-page resume." : ""}
${generateCoverLetter ? "Generate a tailored cover letter." : ""}
${feedback && previousResume ? `
# Revision Instructions
Revise the previous version below based on the user's feedback. Keep everything that was good — only change what the feedback requests.

<feedback>
${feedback}
</feedback>

<previous_resume>
${previousResume}
</previous_resume>
${previousCoverLetter ? `\n<previous_cover_letter>\n${previousCoverLetter}\n</previous_cover_letter>` : ""}
` : ""}
${buildQualificationRules(confirmedQualifications)}

# Input
<resume>
${resumeText}
</resume>

<job_description>
${jobDescription}
</job_description>
${extraContext ? `\n<extra_context>\n${extraContext}\n</extra_context>` : ""}
${companyContext ? `\n<company_research>\n${companyContext}\n</company_research>\nUse company research in Para 3 — reference actual product names, platforms, mission; never invent details not present there.` : ""}
${generateResume ? `
# Resume Content Integrity (CRITICAL — never violate)
STRICTLY FORBIDDEN: Do not add any skills, tools, frameworks, languages, qualifications, or experience NOT explicitly in the uploaded resume. A low match score means genuine gaps — not permission to fabricate. Only reframe and tailor what already exists.
Keep it to one page: never add more bullets to a role than the original resume has.
Populate "changes" with 3-5 bullets describing what changed (e.g. "Tailored summary to match React/TypeScript focus in JD").

# resumeData Output (REQUIRED alongside the plain-text resume field)
- name: candidate full name
- contact_line: email · phone · github · linkedin · portfolio
- summary: 2-3 sentence summary as a single string
- skills: items joined with " · " separator (e.g. "React · Next.js · TypeScript")
- experience: reverse chronological — each entry: title, company ("Name · City"), date, bullets ([{"bullet": "text"}])
- education: each entry: degree, institution, date
resumeData must exactly mirror the plain-text resume field.` : ""}
${generateCoverLetter ? `
# Cover Letter Format
- Header: extract name, email, phone from the resume — on separate lines (name, then email, then phone)
- Date: "${todayDate}"
- Greeting: scan JD for hiring manager name → "Dear [Name]," or "Dear Hiring Manager,"
- Closing: "Kind regards,\n\n${candidateName?.trim() || "[Your Name]"}"

# Cover Letter Para 2 — Challenge + evidence + skill bridge (5-6 sentences)
Step 1: One sentence naming ONE major technical challenge from the JD in the JD's own words.
Step 2: 2-3 sentences from a specific resume project addressing a similar challenge — include at least 2 concrete numbers from the resume.
Step 3: One bridge sentence connecting a skill the candidate ALREADY HAS to a JD requirement (transferability pattern). One precise bridge only — do NOT list technologies.
Do NOT mention skill gaps in Para 2.

# Cover Letter Para 3 — Why this role
${companyContext ? "Use the company research — name actual products, platforms, or mission. Evidence over enthusiasm." : "Reference specific terms from the JD: named systems, platforms, domains, outcomes. Evidence over enthusiasm."}` : ""}

# Output Fields
- resume: ${generateResume ? "full resume as plain text, use \\n for line breaks" : "null"}
- coverLetter: ${generateCoverLetter ? "full cover letter as plain text, use \\n for line breaks" : "null"}
- changes: ${generateResume ? "3-5 short bullets describing what changed from the original resume" : "null"}
- resumeData: ${generateResume ? "structured resume as described above" : "null"}
`;

    const responseText = await generateWithFallback(async (client) => {
      // JSON mode guarantees valid JSON output — no escaped-newline issues
      const model = client.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: buildSystemInstruction(candidateProfile),
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              resume: { type: SchemaType.STRING, nullable: true },
              coverLetter: { type: SchemaType.STRING, nullable: true },
              changes: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                nullable: true,
              },
              resumeData: {
                type: SchemaType.OBJECT,
                nullable: true,
                properties: {
                  name:         { type: SchemaType.STRING },
                  contact_line: { type: SchemaType.STRING },
                  summary:      { type: SchemaType.STRING },
                  skills:       { type: SchemaType.STRING },
                  experience: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        title:   { type: SchemaType.STRING },
                        company: { type: SchemaType.STRING },
                        date:    { type: SchemaType.STRING },
                        bullets: {
                          type: SchemaType.ARRAY,
                          items: {
                            type: SchemaType.OBJECT,
                            properties: {
                              bullet: { type: SchemaType.STRING },
                            },
                            required: ["bullet"],
                          },
                        },
                      },
                      required: ["title", "company", "date", "bullets"],
                    },
                  },
                  education: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        degree:      { type: SchemaType.STRING },
                        institution: { type: SchemaType.STRING },
                        date:        { type: SchemaType.STRING },
                      },
                      required: ["degree", "institution", "date"],
                    },
                  },
                },
                required: ["name", "contact_line", "summary", "skills", "experience", "education"],
              },
            },
            required: ["resume", "coverLetter", "changes", "resumeData"],
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
    console.error("Document generation error:", error);

    if (isRateLimitError(error)) {
      return NextResponse.json({ error: "API rate limit exceeded. Please wait a minute before retrying." }, { status: 429 });
    }
    if (isDbError(error)) {
      return NextResponse.json({ error: "Database connection error. Check your MONGODB_URI." }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to connect to AI engine" }, { status: 500 });
  }
}
