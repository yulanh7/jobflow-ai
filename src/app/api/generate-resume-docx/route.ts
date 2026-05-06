// Accepts an original .docx resume + AI-rewritten plain text.
// Replaces text content in the original docx while preserving all XML
// formatting (paragraph styles, run properties, fonts, spacing).

import PizZip from "pizzip";
import { NextRequest, NextResponse } from "next/server";

// Escape characters that are special in XML text nodes
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Extract the concatenated plain text from a single <w:p> XML string
function getParagraphText(paragraph: string): string {
  const parts: string[] = [];
  const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  while ((match = regex.exec(paragraph)) !== null) {
    parts.push(match[1]);
  }
  return parts.join("").trim();
}

// Replace all <w:t> text content in a paragraph with newText.
// The first <w:t> gets the full new text; subsequent ones are emptied.
// This preserves run formatting (<w:rPr>) and paragraph formatting (<w:pPr>).
function setParagraphText(paragraph: string, newText: string): string {
  let firstReplaced = false;
  return paragraph.replace(/<w:t([^>]*)>[^<]*<\/w:t>/g, (_, attrs) => {
    if (!firstReplaced) {
      firstReplaced = true;
      // Ensure xml:space="preserve" so leading/trailing spaces are kept
      const spaceAttr = attrs.includes("xml:space")
        ? attrs
        : ` xml:space="preserve"`;
      return `<w:t${spaceAttr}>${escapeXml(newText)}</w:t>`;
    }
    return `<w:t></w:t>`;
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const content = formData.get("content") as string | null;

    if (!file || !content) {
      return NextResponse.json(
        { error: "file and content are required" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const zip = new PizZip(buffer);

    const docXmlFile = zip.files["word/document.xml"];
    if (!docXmlFile) {
      return NextResponse.json(
        { error: "Invalid docx: word/document.xml not found" },
        { status: 400 }
      );
    }

    const docXml = docXmlFile.asText();

    // New content lines — skip empty lines; they map to empty paragraphs in
    // the original which we leave untouched as structural spacers.
    // Strip leading dash/en-dash/em-dash from bullet lines so the docx
    // template's own bullet style isn't doubled (e.g. "• - text" → "• text").
    const newLines = content
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => line.replace(/^[\s]*[-–—]\s*/, "").trim());
    let lineIndex = 0;

    // Walk every <w:p> in the document and replace its text content
    const updatedXml = docXml.replace(
      /<w:p[ >][\s\S]*?<\/w:p>/g,
      (paragraph) => {
        const originalText = getParagraphText(paragraph);

        // Empty paragraph → keep as-is (acts as a spacer row)
        if (!originalText) return paragraph;

        // Ran out of new lines → leave remaining paragraphs unchanged
        if (lineIndex >= newLines.length) return paragraph;

        return setParagraphText(paragraph, newLines[lineIndex++]);
      }
    );

    zip.file("word/document.xml", updatedXml);

    const nodeBuffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
    // NextResponse body requires a Uint8Array, not a Node Buffer
    const output = new Uint8Array(nodeBuffer);

    return new NextResponse(output, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="resume-tailored.docx"',
      },
    });
  } catch (error: any) {
    console.error("Resume docx generation error:", error);

    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 }
    );
  }
}
