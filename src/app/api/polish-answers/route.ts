// Studio-only: polishes draft employer question answers into professional English

import { NextRequest, NextResponse } from "next/server";
import { isRateLimitError } from "@/lib/utils";
import { checkAndIncrementGlobal, GLOBAL_LIMIT, getResetTimeISO } from "@/lib/rateLimit";
import { generateWithFallback } from "@/lib/gemini";

function isStudioRequest(req: NextRequest): boolean {
  const pw = req.headers.get("x-studio-password");
  return !!process.env.STUDIO_PASSWORD && pw === process.env.STUDIO_PASSWORD;
}

interface QAPair {
  question: string;
  draft: string;
}

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { qaPairs } = await req.json() as { qaPairs: QAPair[] };

    if (!qaPairs || !Array.isArray(qaPairs) || qaPairs.length === 0) {
      return NextResponse.json(
        { error: "qaPairs (non-empty array) is required" },
        { status: 400 }
      );
    }

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

    const prompt = `Polish each draft answer into a professional, natural English sentence suitable for a job application form. Rules:
- The user may have written in Chinese, broken English, or point form — preserve their intent exactly
- Make it fluent and concise; do not add information not in the draft
- For factual/selection questions (yes/no, numbers, options), keep the answer short and direct
- For open-ended questions, write 1-2 natural sentences
- Never invent facts

Input Q&A pairs:
${qaPairs.map((qa, i) => `${i + 1}. Question: ${qa.question}\n   Draft: ${qa.draft}`).join("\n\n")}

Return ONLY valid JSON — no markdown, no explanation:
{
  "answers": [
    {
      "question": "original question text",
      "answer": "polished English answer"
    }
  ]
}`;

    const responseText = await generateWithFallback(async (client) => {
      const model = client.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
      const res = await model.generateContent(prompt);
      return res.response.text();
    });

    let cleanJson = responseText;
    if (responseText.includes("```")) {
      const match = responseText.match(/```(?:json)?([\s\S]*?)```/);
      if (match) cleanJson = match[1].trim();
    }

    try {
      return NextResponse.json(JSON.parse(cleanJson));
    } catch {
      console.error("JSON parse error. Raw response:", responseText);
      return NextResponse.json(
        { error: "AI returned an invalid format. Please try again." },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Polish answers error:", error);
    if (isRateLimitError(error)) {
      return NextResponse.json(
        { error: "API rate limit exceeded. Please wait a minute before retrying." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Failed to connect to AI engine" }, { status: 500 });
  }
}
