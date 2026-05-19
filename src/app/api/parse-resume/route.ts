// Handles resume file uploads and extracts plain text from PDF and DOCX formats
import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    let text = "";

    if (file.type === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(buffer);
      text = result.text.replace(/\n\s*\n/g, "\n").trim();
    } else if (
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;

      // Count non-empty paragraphs in the original XML so AI can match line count exactly
      const PizZip = (await import("pizzip")).default;
      const zip = new PizZip(buffer);
      const docXml = zip.files["word/document.xml"]?.asText();
      if (docXml) {
        const paragraphs = [...docXml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)];
        const nonEmptyCount = paragraphs.filter(([p]) =>
          /<w:t[^>]*>[^<\s][^<]*<\/w:t>/.test(p)
        ).length;
        return NextResponse.json({ text, paragraphCount: nonEmptyCount });
      }
    } else {
      return NextResponse.json(
        {
          error: "Unsupported file type. Please upload a PDF or Word document.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ text, paragraphCount: null });
  } catch (error) {
    console.error("Resume parsing error:", error);
    return NextResponse.json(
      { error: "Failed to parse resume" },
      { status: 500 }
    );
  }
}
