import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

/**
 * Generate a DOCX file from title and content
 * @param title Document title
 * @param content Document content (plain text or markdown)
 * @returns Buffer containing the DOCX file
 */
export async function generateDocx(title: string, content: string): Promise<Buffer> {
  // Parse content into paragraphs
  const lines = content.split("\n");
  const children: Paragraph[] = [];

  // Add title
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: {
        after: 200,
      },
    })
  );

  // Add content paragraphs
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.length === 0) {
      // Empty line
      children.push(new Paragraph({ text: "" }));
    } else if (trimmedLine.startsWith("# ")) {
      // Heading 1
      children.push(
        new Paragraph({
          text: trimmedLine.substring(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (trimmedLine.startsWith("## ")) {
      // Heading 2
      children.push(
        new Paragraph({
          text: trimmedLine.substring(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 150, after: 75 },
        })
      );
    } else if (trimmedLine.startsWith("### ")) {
      // Heading 3
      children.push(
        new Paragraph({
          text: trimmedLine.substring(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 100, after: 50 },
        })
      );
    } else {
      // Regular paragraph
      children.push(
        new Paragraph({
          children: [new TextRun(trimmedLine)],
          spacing: { after: 100 },
        })
      );
    }
  }

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
