// Accepts an original .docx resume + AI-rewritten plain text.
// Replaces <w:t> text nodes in the original XML while preserving all
// formatting tags (<w:r>, <w:rPr>, <w:pPr>, styles, fonts, spacing).

import PizZip from "pizzip";
import { NextRequest, NextResponse } from "next/server";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Step 3: Extract combined plain text from all <w:t> nodes in one <w:p>
function getParagraphText(paragraph: string): string {
  const parts: string[] = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(paragraph)) !== null) parts.push(m[1]);
  return parts.join("").trim();
}

// Step 4: Replace <w:t> content in one paragraph with newText.
// First <w:t> receives the full replacement; subsequent ones are cleared.
// All <w:r>, <w:rPr>, <w:pPr>, and other format tags are untouched.
function setParagraphText(paragraph: string, newText: string): string {
  let placed = false;
  return paragraph.replace(/<w:t([^>]*)>[^<]*<\/w:t>/g, (_, attrs) => {
    if (!placed) {
      placed = true;
      // Preserve xml:space="preserve" so Word keeps leading/trailing spaces
      const finalAttrs = attrs.includes("xml:space")
        ? attrs
        : `${attrs} xml:space="preserve"`.trim();
      return `<w:t ${finalAttrs}>${escapeXml(newText)}</w:t>`;
    }
    // Keep the run wrapper intact — just empty the text node
    return `<w:t></w:t>`;
  });
}

export async function POST(req: NextRequest) {
  try {
    // Step 1: Receive original DOCX file + AI-rewritten plain text
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

    // Step 2: Unzip and read word/document.xml
    const zip = new PizZip(buffer);
    const docXmlFile = zip.files["word/document.xml"];
    if (!docXmlFile) {
      return NextResponse.json(
        { error: "Invalid docx: word/document.xml not found" },
        { status: 400 }
      );
    }
    const docXml = docXmlFile.asText();

    // Step 3: Build ordered list of replacement lines from content.
    // Empty lines are skipped — they map to structurally empty paragraphs
    // which act as spacers and are left untouched.
    // Strip leading dash/bullet characters so template bullets aren't doubled.
    const newLines = content
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => line.replace(/^[\s]*[-–—•]\s*/, "").trim());

    let lineIndex = 0;

    // Step 4: Walk every <w:p> and replace text while preserving format tags
    const updatedXml = docXml.replace(
      /<w:p[ >][\s\S]*?<\/w:p>/g,
      (paragraph) => {
        const originalText = getParagraphText(paragraph);

        // Empty paragraph → structural spacer, leave untouched
        if (!originalText) return paragraph;

        // Ran out of replacement lines → leave remainder as-is
        if (lineIndex >= newLines.length) return paragraph;

        return setParagraphText(paragraph, newLines[lineIndex++]);
      }
    );

    // Step 5: Repack and return the updated DOCX
    zip.file("word/document.xml", updatedXml);
    const nodeBuffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
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
