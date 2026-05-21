// Fills resume-template.docx with AI-generated structured data using docxtemplater.
// The template preserves all original formatting (bold, italic, tabs, indentation).
// No XML patching — docxtemplater clones the formatted XML nodes and injects data.

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

interface ExperienceEntry {
  title: string;
  company: string;
  date: string;
  bullets: { bullet?: string; text?: string }[];
}

interface EducationEntry {
  degree: string;
  institution: string;
  date: string;
}

interface ResumeData {
  name: string;
  contact_line: string;
  summary: string;
  skills: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  // Flat fields required by the template
  education_degree?: string;
  education_university?: string;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    // file is accepted for API compatibility but not used — template is fixed
    formData.get("file");
    const resumeDataRaw = formData.get("resumeData") as string | null;

    if (!resumeDataRaw) {
      return NextResponse.json(
        { error: "resumeData is required" },
        { status: 400 }
      );
    }

    const resumeData: ResumeData = JSON.parse(resumeDataRaw);

    // Flatten education array into the single-field placeholders the template uses
    resumeData.education_degree = resumeData.education[0]?.degree || "";
    resumeData.education_university = resumeData.education[0]?.institution || "";

    // Normalise bullet field name: Gemini emits { bullet } but the template uses { text }
    resumeData.experience = resumeData.experience.map((exp) => ({
      ...exp,
      bullets: exp.bullets.map((b) => ({ text: b.bullet ?? b.text ?? "" })),
    }));

    // Load the fixed template that preserves all original formatting
    const templatePath = path.join(process.cwd(), "templates", "resume-template.docx");
    const templateBuffer = fs.readFileSync(templatePath);

    // Fill placeholders — docxtemplater clones XML nodes for loops,
    // so bold/italic/tab-stop formatting is inherited from the template.
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(resumeData);

    const nodeBuffer = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
    const output = new Uint8Array(nodeBuffer);

    return new NextResponse(output, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="resume-tailored.docx"',
      },
    });
  } catch (error: unknown) {
    console.error("Resume docx generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate document" },
      { status: 500 }
    );
  }
}
