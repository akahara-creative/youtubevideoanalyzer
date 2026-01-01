import mammoth from "mammoth";

/**
 * Extract text from various file types
 * @param buffer File buffer
 * @param fileType File type (txt, docx, pdf, m4a)
 * @returns Extracted text content
 */
export async function extractTextFromFile(
  buffer: Buffer,
  fileType: "txt" | "docx" | "pdf" | "m4a"
): Promise<string> {
  try {
    switch (fileType) {
      case "txt":
        return buffer.toString("utf-8");

      case "docx":
        const docxResult = await mammoth.extractRawText({ buffer });
        return docxResult.value;

      case "pdf":
        // pdf-parse uses default export
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(buffer);
        return pdfData.text;

      case "m4a":
        // For audio files, use Whisper transcription
        const { transcribeAudio } = await import("./_core/voiceTranscription");
        const { storagePut } = await import("./storage");
        
        // Upload audio to storage temporarily
        const audioKey = `temp-audio/${Date.now()}-${Math.random().toString(36).substring(7)}.m4a`;
        const { url: audioUrl } = await storagePut(audioKey, buffer, "audio/mp4");
        
        // Transcribe audio
        const transcriptionResult = await transcribeAudio({
          audioUrl,
          language: "ja",
        });
        
        // Check for errors
        if ('error' in transcriptionResult) {
          throw new Error(`Transcription failed: ${transcriptionResult.error} - ${transcriptionResult.details}`);
        }
        
        // Return full transcription text
        return transcriptionResult.text || "";

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error(`[TextExtractor] Failed to extract text from ${fileType}:`, error);
    throw new Error(`Failed to extract text from ${fileType} file`);
  }
}
