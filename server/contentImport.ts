import mammoth from "mammoth";
import * as pdfParse from "pdf-parse";
import fs from "fs/promises";

/**
 * Extract text from uploaded file based on file type
 */
export async function extractTextFromFile(
  filePath: string,
  fileType: "txt" | "docx" | "pdf"
): Promise<string> {
  try {
    switch (fileType) {
      case "txt":
        return await extractTextFromTxt(filePath);
      case "docx":
        return await extractTextFromDocx(filePath);
      case "pdf":
        return await extractTextFromPdf(filePath);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error: any) {
    console.error(`[ContentImport] Failed to extract text from ${fileType}:`, error);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

/**
 * Extract text from TXT file
 */
async function extractTextFromTxt(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return buffer.toString("utf-8");
}

/**
 * Extract text from DOCX file using mammoth
 */
async function extractTextFromDocx(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extract text from PDF file using pdf-parse
 */
async function extractTextFromPdf(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const data = await (pdfParse as any).default(buffer);
  return data.text;
}

/**
 * Clean up temporary file
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error(`[ContentImport] Failed to cleanup temp file:`, error);
  }
}
