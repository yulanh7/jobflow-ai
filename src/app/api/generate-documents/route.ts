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
      candidateName,
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
            changes: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              nullable: true,
            },
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

${
  feedback && previousResume
    ? `
# User Feedback on Previous Version
${feedback}

# Previous Resume (revise this based on feedback above)
${previousResume}

${
  previousCoverLetter
    ? `# Previous Cover Letter (revise this based on feedback above)
${previousCoverLetter}`
    : ""
}

IMPORTANT: Keep everything that was good, only change what the feedback requests.
`
    : ""
}

# Task
${generateResume ? "Generate a tailored one-page resume." : ""}
${generateCoverLetter ? "Generate a tailored cover letter." : ""}

# Identity Rule (CRITICAL — never violate this)
CONFIRMED QUALIFICATIONS: ${confirmedQualifications?.length > 0 ? confirmedQualifications.join(", ") : "NONE"}
1. CITIZENSHIP:
   - If "Australian Citizen" is NOT in the confirmed list: 
     * STRICTLY FORBIDDEN to mention citizenship. 
     * USE: "I hold full Australian working rights."
2. SECURITY CLEARANCE:
   - If a clearance (Baseline/NV1/NV2) is NOT in the confirmed list:
     * DO NOT say "I hold it" or "I will initiate it."
     * IF citizenship IS in the confirmed list: USE "I am an Australian citizen and am ready to undergo the [clearance level] vetting process upon sponsorship."
     * IF citizenship is NOT in the confirmed list: USE "I am willing to undergo all necessary background and suitability checks required for this position."
3. NO HALLUCINATION:
   - Never assume PR or citizenship if not explicitly provided.
${confirmedQualifications?.length > 0 ? `- These confirmed qualifications SHOULD be added to the Skills section of the resume and mentioned naturally in the cover letter.` : ""}

${
  generateResume
    ? `
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
`
    : ""
}
${
  generateCoverLetter
    ? `
# Cover Letter Rules (follow every rule strictly)

## Format
- Greeting: Scan the JD for a named hiring manager or recruiter. If found, use "Dear [Name]," — otherwise use "Dear Hiring Manager,"
- Blank line after salutation
- 4 paragraphs (no bullet points)
- Blank line before closing
- End with: "Kind regards,\n\n${candidateName?.trim() || "[Your Name]"}"
- MUST be 200-250 words — count carefully, do not submit outside this range

## Structure

Paragraph 1 — Opening (2-3 sentences):
Do NOT open with "I am writing to express my interest in" or "I am pleased to apply for" — these are clichés. Instead open with: "I am applying for the [exact role title] at [company/agency from JD]." Then state years of experience with the most relevant technology from the JD. If the candidate holds any confirmed qualifications (clearance, citizenship etc.) that the JD requires — state them here naturally. Otherwise state Canberra-based and Australian work rights.

Paragraph 2 — Challenge + evidence (5-6 sentences):
Step 1: Identify ONE major technical challenge or requirement from the JD (e.g. scale, accessibility, specific platform, complex integration).
Step 2: Write 1 sentence naming that challenge in the JD's own words.
Step 3: Write 2-3 sentences showing how a specific project from the resume directly addressed a similar challenge — include at least 2 concrete numbers from the resume (e.g. users served, coverage %, years, site count).
Step 4: Do NOT list every technology. Tell a story about impact, not a catalogue of skills.
Do NOT mention any skill gaps or missing qualifications in this paragraph.

Paragraph 3 — Why this role (3-4 sentences):
Extract what is genuinely specific about this role or organisation from the JD — not generic praise.
Reference specific terms from the JD: named systems, platforms, domains, or outcomes.
Show how the candidate's background connects to those specifics — not enthusiasm, evidence.

Paragraph 4 — Gap + closing (4-5 sentences):
If there is an employment gap in the resume, explain it in 1-2 sentences using specific project details.
Do NOT use these generic closing phrases: "I am confident in my ability", "I look forward to the opportunity", "I am available for an interview at your earliest convenience", "I would welcome the chance", "I am eager to bring".
Close with a direct, active statement: name what you bring to this specific role, then invite the next step in one sentence. Do not repeat any sentiment already used in paragraph 3.

## Banned Words and Phrases (NEVER use — run a check before finalising)
ensure, crucial, vital, leverage, seamless, seamlessly, comprehensive,
robust, innovative, cutting-edge, dynamic, synergy, facilitate, enhance,
keen, extensive, strongly aligns, well-suited, coupled with, furthermore,
spearheaded, adept, proficient in, excited by the prospect, esteemed,
solid foundation, strong foundation, specializing, effectively, impactful,
confident in my ability, contribute positively, collaborate effectively,
very compelling, particularly appeals, eager to apply,
I am writing to express my interest, I am pleased to apply,
available for an interview at your earliest convenience,
particularly appealing, prospect of supporting, it is with great,
I would be a great fit, I believe I am,
passionate, deeply, resonates, moreover,
I possess the technical foundation, eager to apply my skills, eager to bring,
this role is particularly appealing, I am eager to, possess the technical foundation,
particularly appealing, prospect of supporting

CRITICAL: Target 200-250 words. Prioritise information density — do NOT add filler sentences to reach a word count.
If over 320: cut adjectives and filler phrases, not content.
Never pad with generic enthusiasm to reach a target.
`
    : ""
}

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
        {
          error:
            "API rate limit exceeded. Please wait a minute before retrying.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to connect to AI engine" },
      { status: 500 }
    );
  }
}
