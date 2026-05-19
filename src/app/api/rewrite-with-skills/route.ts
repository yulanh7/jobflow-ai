// Rewrites resume and cover letter incorporating selected skill gaps

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
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

    // JSON mode guarantees valid JSON output
    const model = genAI.getGenerativeModel({
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

    const prompt = `
# Role
You are an expert technical resume writer specialising in the Australian
technology job market, particularly Canberra.

# Candidate Profile
${resumeText}

# Target Job Description
${jobDescription}

# Selected Skills to Incorporate
${JSON.stringify(selectedGaps, null, 2)}

# Task
Rewrite the resume and cover letter to incorporate the selected skills.

# Rules for incorporating skills by category

For "quick_win" skills:
- Add directly to Skills section
- Add a new bullet point in the most relevant job experience
- Example: "Built [demo project] using [skill] to [outcome]"

For "interview_ready" skills:
- Add to Skills section only
- Do NOT add fake project experience
- In cover letter, mention as "expanding knowledge in [skill]"

For "long_term" skills:
- Do NOT add to resume
- In cover letter only: one honest sentence about awareness/interest
- Example: "I'm aware this role requires [skill] and I'm actively working towards it"

# Resume Rules
1. One page maximum
2. Implicit first person — "Built X" not "I built X"
3. Each bullet 10-15 words, hard maximum 20 words
4. Start each bullet with a simple action verb: built, created, developed,
   wrote, designed, launched, integrated, deployed, reduced, improved,
   fixed, implemented, added, updated, managed, led, coordinated, migrated, delivered
5. No markdown formatting, no asterisks, no bold markers, no hashtags
6. Only use numbers from the original resume — never invent metrics
7. Keep all original job titles, company names, and dates unchanged
8. NEVER use banned words: ensure, crucial, vital, leverage, seamless,
   comprehensive, robust, innovative, facilitate, enhance, keen,
   furthermore, coupled with, well-suited, spearheaded, adept

# Identity Rule (CRITICAL — never violate this)
CONFIRMED QUALIFICATIONS: ${confirmedQualifications?.length > 0 ? confirmedQualifications.join(", ") : "NONE"}
- If "Australian citizen" or citizenship is NOT in the confirmed list: DO NOT mention citizenship. Use "I hold full Australian working rights."
- If a security clearance is required by the JD but NOT in the confirmed list:
  DO NOT claim to hold it.
  If citizenship IS in the confirmed list: use "I am ready to undergo the vetting process for [Clearance Level] upon sponsorship."
  If citizenship is NOT in the confirmed list: use "I am willing to undergo all required background and character suitability assessments."
- Never hallucinate or infer citizenship, PR status, or security clearance from the resume.

# Cover Letter Rules (follow every rule strictly)

## Format
- Greeting: Scan the JD for a named hiring manager or recruiter. If found, use "Dear [Name]," — otherwise use "Dear Hiring Manager,"
- Blank line after salutation
- 4 paragraphs, no bullet points
- Blank line before closing
- End with: "Kind regards,\n\n${candidateName?.trim() || "[Your Name]"}"
- Target 200-250 words. Prioritise information density — do NOT pad with filler sentences to reach a word count.

## Structure

Paragraph 1 — Opening (2-3 sentences):
Do NOT open with "I am writing to express my interest in" or "I am pleased to apply for."
State the exact role title and company/agency. State years of experience with the most relevant tech from the JD.
State only confirmed qualifications/work rights — never assume citizenship or clearance.

Paragraph 2 — Challenge + evidence (4-5 sentences):
Identify ONE major challenge or requirement from the JD. Name it in one sentence.
Then show how a specific project from the resume addressed a similar challenge — include at least 2 numbers from the resume.
Weave in new skills naturally: for quick_win skills mention them as recently applied; for interview_ready mention as expanding knowledge; for long_term one honest sentence only.
Do NOT list technologies. Tell a story about impact.

Paragraph 3 — Why this role (2-3 sentences):
Reference specific terms from the JD: named systems, platforms, domains, or outcomes.
Connect the candidate's background to those specifics with evidence, not enthusiasm.

Paragraph 4 — Closing (2-3 sentences):
Do NOT use: "I am confident in my ability", "I look forward to the opportunity", "I am available for an interview at your earliest convenience", "contribute positively", "collaborate effectively".
State what you bring to this specific role, then invite the next step directly. Example: "I welcome a technical discussion regarding my fit for the team."

## Banned Words and Phrases (run a final scan before submitting)
ensure, crucial, vital, leverage, seamless, seamlessly, comprehensive,
robust, innovative, cutting-edge, dynamic, synergy, facilitate, enhance,
keen, extensive, strongly aligns, well-suited, coupled with, furthermore,
spearheaded, adept, proficient in, excited by the prospect, esteemed,
solid foundation, strong foundation, specializing, effectively, impactful,
confident in my ability, contribute positively, collaborate effectively,
very compelling, particularly appeals, eager to apply,
I am writing to express my interest, I am pleased to apply,
available for an interview at your earliest convenience,
proven ability, complex applications, particularly appealing,
passionate, deeply, resonates, moreover,
I possess the technical foundation, eager to apply my skills, eager to bring,
this role is particularly appealing, I am eager to

# Output
Return ONLY valid JSON — no markdown, no explanation:
{
  "resume": "full rewritten resume as plain text, use \\n for line breaks",
  "coverLetter": "full rewritten cover letter as plain text, use \\n for line breaks"
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
    console.error("Rewrite with skills error:", error);

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
