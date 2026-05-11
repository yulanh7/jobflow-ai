// Generates a tailored resume and/or cover letter using Gemini AI

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
    } = await req.json();

    if (!resumeText || !jobDescription) {
      return NextResponse.json(
        { error: "resumeText and jobDescription are required" },
        { status: 400 }
      );
    }

    if (!generateResume && !generateCoverLetter) {
      return NextResponse.json(
        { error: "At least one of generateResume or generateCoverLetter must be true" },
        { status: 400 }
      );
    }

    // JSON mode guarantees valid JSON output — no escaped-newline issues
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            resume: { type: SchemaType.STRING, nullable: true },
            coverLetter: { type: SchemaType.STRING, nullable: true },
            changes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
          },
          required: ["resume", "coverLetter", "changes"],
        },
      },
    });

    const prompt = `
# Role
You are an expert technical resume writer specialising in the Australian
technology job market, particularly Canberra government and private sector roles.

# Candidate Profile
${resumeText}

# Target Job Description
${jobDescription}

${extraContext ? `# Extra Context from Candidate\n${extraContext}` : ""}

${feedback && previousResume ? `
# User Feedback on Previous Version
${feedback}

# Previous Resume (revise this based on feedback above)
${previousResume}

${previousCoverLetter ? `# Previous Cover Letter (revise this based on feedback above)
${previousCoverLetter}` : ""}

IMPORTANT: Keep everything that was good, only change what the feedback requests.
` : ""}

# Task
${generateResume ? "Generate a tailored one-page resume." : ""}
${generateCoverLetter ? "Generate a tailored cover letter." : ""}

${confirmedQualifications?.length > 0 ? `
# Confirmed Qualifications (candidate confirmed they hold these)
${confirmedQualifications.join(", ")}
- Add to Skills section of resume
- Mention in cover letter: "I hold [qualification]"
` : ""}

${generateResume ? `
# Resume Rules (follow every rule strictly)

After generating the resume, populate the "changes" array with 3-5 short bullet points describing what was changed from the original resume (e.g. "Tailored summary to match React/TypeScript focus in JD", "Reordered skills to prioritise Next.js and Node.js", "Strengthened bullet points with action verbs").


## Structure (in this exact order)
1. Name — centred, bold
2. Contact line — email · phone · linkedin · github, centred
3. Summary — 2-3 sentences, tailored to this JD
4. Skills — one line, technologies relevant to JD listed first
5. Experience — reverse chronological, each role has:
   - Job title (bold) | Company · Location | Date range
   - 3-5 bullet points
6. Education

## Writing Rules
- Implicit first person: "Built X" not "I built X"
- Each bullet 10-15 words, hard maximum 20 words
- Start each bullet with a simple action verb:
  built, created, developed, wrote, designed, launched, integrated,
  deployed, reduced, improved, fixed, implemented, added, updated,
  managed, led, coordinated, migrated, delivered
- Tailor bullets to match JD keywords naturally
- Only use numbers that appear in the original resume — never invent metrics
- Keep all original job titles, company names, and dates unchanged
- Output plain text only — no markdown formatting, no asterisks, no bold markers, no hashtags

## Banned Words (NEVER use any of these)
ensure, crucial, vital, leverage, seamless, seamlessly, comprehensive,
robust, innovative, cutting-edge, dynamic, synergy, paradigm, transform,
facilitate, enhance, drive, deliver, solutions, navigate, journey,
elevate, optimize, keen, extensive, versatility, progressive, esteemed,
excited by the prospect, strongly aligns, well-suited, coupled with,
furthermore, intricate, spearheaded, adept, proficient in,
solid foundation, strong foundation, specializing
` : ""}
${generateCoverLetter ? `
# Cover Letter Rules (follow every rule strictly)

## Format
- Start with: "Dear Hiring Manager,"
- Blank line after salutation
- 4 paragraphs (no bullet points)
- Blank line before closing
- End with: "Yours sincerely,\n\nRachel Huang"
- MUST be 300-350 words — count carefully, do not submit outside this range

## Structure
Paragraph 1 — Opening (2-3 sentences):
"I'm applying for the [exact role title] at [company name from JD].
I have [X]+ years building [most relevant tech from JD].
I'm Canberra-based with valid Australian work rights."

Paragraph 2 — Strongest evidence (5-6 sentences):
Pick 1-2 projects from the resume that best match this JD.
Give specific details: tech used, scale, what you built, outcome.
Reference actual numbers from the resume only.

Paragraph 3 — Why this company (3-4 sentences):
Extract what makes this role/company specific from the JD.
Show genuine alignment — not generic enthusiasm.
If JD mentions government, national systems, or specific domain — reference it.

Paragraph 4 — Gap + closing (4-5 sentences):
If there is an employment gap in the resume, explain in 2 sentences:
"Since [last role end date], I built a community platform using Next.js,
Redux Toolkit, and TypeScript. I'm ready to return to full-time work."
If no gap, skip this and go straight to closing.
Closing: express readiness to contribute, invite next step.

## Same Banned Words as Resume
ensure, crucial, vital, leverage, seamless, seamlessly, comprehensive,
robust, innovative, cutting-edge, dynamic, synergy, facilitate, enhance,
keen, extensive, strongly aligns, well-suited, coupled with, furthermore,
spearheaded, adept, proficient in, excited by the prospect, esteemed,
solid foundation, strong foundation, specializing

CRITICAL: Before finalising, count every word in your cover letter.
Target is exactly 300-350 words.
If under 300: expand paragraph 2 with more project specifics.
If over 350: remove filler phrases and adjectives.
Do a final word count check before outputting.
` : ""}

# Final Checks (do these before responding)
Do a final scan for banned words. If you find any, replace with a simpler alternative.

# Output
Return ONLY valid JSON — no markdown, no explanation:
{
  "resume": ${generateResume ? '"full resume as plain text, use \\n for line breaks"' : "null"},
  "coverLetter": ${generateCoverLetter ? '"full cover letter as plain text, use \\n for line breaks"' : "null"},
  "changes": ${generateResume ? '["3-5 short bullet points describing what was changed from the original resume, e.g. Tailored summary to match React/TypeScript focus in JD"]' : "null"}
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

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
  } catch (error: any) {
    console.error("Document generation error:", error);

    if (error.status === 429 || error.message?.includes("429")) {
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
