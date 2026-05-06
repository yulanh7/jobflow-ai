// Rewrites resume and cover letter incorporating selected skill gaps

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { resumeText, jobDescription, selectedGaps } = await req.json();

    if (!resumeText || !jobDescription || !Array.isArray(selectedGaps) || selectedGaps.length === 0) {
      return NextResponse.json(
        { error: "resumeText, jobDescription, and selectedGaps (non-empty array) are required" },
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

# Cover Letter Rules
1. Start with: "Dear Hiring Manager,"
2. Blank line after salutation
3. 4 paragraphs, no bullet points
4. Blank line before closing
5. End with: "Yours sincerely,\n\nRachel Huang"
6. Naturally weave in the new skills without sounding forced

CRITICAL WORD COUNT RULE:
The cover letter MUST contain between 300-350 words.
Count every single word before responding.
If under 300 words: expand Body paragraph 1 with more specific
project details, technologies used, and measurable outcomes.
Never submit a cover letter under 300 words.

BANNED WORDS — using any of these will fail the quality check.
Do a final scan of your output before responding.
Remove any instance of: ensure, crucial, vital, leverage, seamless,
seamlessly, comprehensive, robust, innovative, cutting-edge, dynamic,
synergy, facilitate, enhance, keen, extensive, strongly aligns,
well-suited, coupled with, furthermore, spearheaded, adept,
specializing, solid foundation, proven ability, complex applications

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
