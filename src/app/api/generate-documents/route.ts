// Generates a tailored resume and/or cover letter using Gemini AI

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
      paragraphCount,
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

    // User-supplied background takes precedence; Google Search fills the gap
    let companyContext = "";
    if (generateCoverLetter) {
      const searchResult = await researchCompany(jobDescription);
      companyContext = [companyBackground, searchResult].filter(Boolean).join("\n\n");
    }

    const todayDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const prompt = `
# Rules
${contentStandards}

# Candidate Profile
${candidateProfile}

# Task
${generateResume ? "Generate a tailored one-page resume." : ""}
${generateCoverLetter ? "Generate a tailored cover letter." : ""}

${feedback && previousResume ? `
# Revision Instructions
User feedback on previous version: ${feedback}

Previous resume (revise based on feedback above):
${previousResume}
${previousCoverLetter ? `\nPrevious cover letter (revise based on feedback above):\n${previousCoverLetter}` : ""}
Keep everything that was good — only change what the feedback requests.
` : ""}

# Confirmed Qualifications (CRITICAL — runtime data, override defaults)
CONFIRMED QUALIFICATIONS: ${confirmedQualifications?.length > 0 ? confirmedQualifications.join(", ") : "NONE"}
1. CITIZENSHIP: If "Australian Citizen" NOT in confirmed list → STRICTLY FORBIDDEN to mention citizenship → use "I hold full Australian working rights."
2. SECURITY CLEARANCE: If clearance NOT in confirmed list → do NOT claim it.
   - Citizenship confirmed → "I am an Australian citizen and am ready to undergo the [clearance level] vetting process upon sponsorship."
   - Citizenship NOT confirmed → "I am willing to undergo all necessary background and suitability checks required for this position."
3. Never infer PR or citizenship from the resume.
${confirmedQualifications?.length > 0 ? "- Confirmed qualifications MUST be added to the Skills section and mentioned naturally in the cover letter." : ""}

# Input

## Uploaded Resume
${resumeText}

## Job Description
${jobDescription}

${extraContext ? `## Extra Context from Candidate\n${extraContext}` : ""}

${companyContext ? `## Company Research (use in Para 3 — reference actual product names, platforms, mission; never invent details not present here)
${companyContext}` : ""}

${companyBackground ? `## Company Background (use in Para 3)
${companyBackground}` : ""}

${generateResume && paragraphCount ? `# Resume Line Count (CRITICAL)
Original DOCX has exactly ${paragraphCount} non-empty lines. Rewritten resume MUST output EXACTLY ${paragraphCount} non-empty lines. Count before submitting.` : ""}

${generateResume ? `# Resume Content Integrity (CRITICAL — never violate)
STRICTLY FORBIDDEN: Do not add any skills, tools, frameworks, languages, qualifications, or experience NOT explicitly in the uploaded resume. A low match score means genuine gaps — not permission to fabricate. Only reframe and tailor what already exists.
After generating the resume, populate "changes" with 3-5 bullets describing what changed (e.g. "Tailored summary to match React/TypeScript focus in JD").` : ""}

${generateResume ? `# resumeData Output (REQUIRED alongside the plain-text resume field)
- name: candidate full name
- contact_line: email · phone · github · linkedin · portfolio
- summary: 2-3 sentence summary as a single string
- skills: items joined with " · " separator (e.g. "React · Next.js · TypeScript")
- experience: reverse chronological — each entry: title, company ("Name · City"), date, bullets ([{"bullet": "text"}])
- education: each entry: degree, institution, date
resumeData must exactly mirror the plain-text resume field.` : ""}

${generateCoverLetter ? `# Cover Letter Format
- Header: extract name, email, phone from resume — on separate lines (name, then email, then phone)
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

# Output Format
Return ONLY valid JSON — no markdown, no explanation:
{
  "resume": ${generateResume ? '"full resume as plain text, use \\n for line breaks"' : "null"},
  "coverLetter": ${generateCoverLetter ? '"full cover letter as plain text, use \\n for line breaks"' : "null"},
  "changes": ${generateResume ? '["3-5 short bullets describing what changed from the original resume"]' : "null"}
}
`;

    const responseText = await generateWithFallback(async (client) => {
      // JSON mode guarantees valid JSON output — no escaped-newline issues
      const model = client.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
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

    console.error("JSON parse error. Raw response:", responseText);
    return NextResponse.json(
      { error: "AI returned an invalid format. Please try again." },
      { status: 500 }
    );
  } catch (error: unknown) {
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
