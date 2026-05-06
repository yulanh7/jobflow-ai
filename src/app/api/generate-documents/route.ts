// Generates a tailored resume and/or cover letter using Gemini AI

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { resumeText, jobDescription, extraContext, generateResume, generateCoverLetter } =
      await req.json();

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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `
      # Role
      You are an expert technical resume writer and career coach specialising in the Australian technology job market, particularly Canberra.

      # Candidate Profile
      ${resumeText}

      # Target Job Description
      ${jobDescription}

      ${extraContext ? `# Extra Context from Candidate\n${extraContext}` : ""}

      # Task
      ${generateResume ? "Generate a tailored one-page resume." : ""}
      ${generateCoverLetter ? "Generate a tailored cover letter." : ""}

      # Resume Rules (apply strictly if generating resume)
      1. One page maximum
      2. Bullet point format for work experience
      3. Implicit first person — "Built X" not "I built X"
      4. Each bullet 10-15 words, maximum 20 words
      5. Simple action verbs only: built, created, developed, wrote, designed, launched, integrated, deployed, reduced, improved, helped, made, fixed, implemented, added, updated, managed, led, coordinated
      6. NEVER use these words: ensure, crucial, vital, leverage, seamless, comprehensive, robust, innovative, cutting-edge, dynamic, synergy, paradigm, transform, facilitate, enhance, drive, deliver, solutions, navigate, journey, elevate, optimize
      7. Tailor bullets to match JD requirements
      8. Include only defendable numbers from the original resume
      9. Keep all real job titles and dates accurate

      # Cover Letter Rules (apply strictly if generating cover letter)
      1. 300-350 words maximum, never exceed 400
      2. Prose paragraphs, no bullet points
      3. Structure:
         - Opening (2-3 sentences): Role name + core skill match
         - Body 1 (5-6 sentences): 1-2 strongest relevant projects with specific details
         - Body 2 (3-4 sentences): Why this specific company, extract from JD
         - Gap explanation (2-3 sentences): Mention community platform project, ready to return
         - Closing (2 sentences): Ready to contribute, call to action
      4. Use "you/your" to address hiring manager
      5. Same banned words as resume
      6. Evidence-based: reference actual projects from resume
      7. Opening example format: "I'm applying for the [Role] at [Company]. I have [X]+ years building [relevant tech]. I'm [location]-based with valid work rights."

      # Output Format
      Respond ONLY with valid JSON, no markdown:
      {
        "resume": "full resume text with \\n for line breaks, null if not requested",
        "coverLetter": "full cover letter text with \\n for line breaks, null if not requested"
      }

      CRITICAL: Your entire response must be ONLY a valid JSON object.
      No text before or after the JSON.
      No markdown code fences like \`\`\`json.
      No explanations.
      Start your response with { and end with }
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
