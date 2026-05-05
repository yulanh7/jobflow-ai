import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { resumeText, jobDescription } = await req.json();

    if (!resumeText || !jobDescription) {
      return NextResponse.json(
        { error: "Resume text and job description are required" },
        { status: 400 }
      );
    }

    // Use gemini-2.5-flash-lite — fast response with sufficient free tier quota
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const prompt = `
    You are a strict and consistent recruitment consultant.
    Evaluate the candidate's resume against the job description using explicit evidence only.
    
    Scoring criteria:
    - 80-100: Strong match, most required skills explicitly present
    - 60-79: Good match, majority of skills present with minor gaps  
    - 40-59: Moderate match, some key skills missing
    - 0-39: Weak match, significant gaps
    
    RESUME:
    ${resumeText}
    
    JOB DESCRIPTION:
    ${jobDescription}
    
    Respond ONLY with a valid JSON object. Do not include markdown formatting.
    {
      "score": number,
      "summary": "string",
      "strengths": ["string"],
      "gaps": ["string"],
      "suggestions": ["string"]
    }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log(
      "Using API Key:",
      process.env.GEMINI_API_KEY?.slice(0, 5) + "****"
    );

    // --- 稳健的 JSON 提取逻辑 ---
    let cleanJson = responseText;

    // 如果 AI 还是带了 ```json 标签，用这个正则精准提取内容
    if (responseText.includes("```")) {
      const match = responseText.match(/```(?:json)?([\s\S]*?)```/);
      if (match) {
        cleanJson = match[1].trim();
      }
    }

    try {
      const analysis = JSON.parse(cleanJson);
      return NextResponse.json(analysis);
    } catch (parseError) {
      console.error("JSON Parse Error. Raw response:", responseText);
      return NextResponse.json(
        { error: "AI returned an invalid format. Please try again." },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Gemini analysis error:", error);

    // 专门处理 429 额度问题，给前端一个友好的提示
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
