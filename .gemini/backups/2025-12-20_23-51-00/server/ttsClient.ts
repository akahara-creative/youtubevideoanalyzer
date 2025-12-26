import { ENV } from "./_core/env";

/**
 * OpenAI TTS (Text-to-Speech) Client
 * Generates speech audio from text using OpenAI's TTS API
 */

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
export type TTSModel = "tts-1" | "tts-1-hd";
export type TTSFormat = "mp3" | "opus" | "aac" | "flac";

export interface TTSOptions {
  voice?: TTSVoice;
  model?: TTSModel;
  speed?: number; // 0.25 to 4.0
  responseFormat?: TTSFormat;
}

/**
 * Generate speech from text using OpenAI TTS API
 */
export async function generateSpeechWithOpenAI(
  text: string,
  options: TTSOptions = {}
): Promise<Buffer> {
  const {
    voice = "alloy",
    model = "tts-1",
    speed = 1.0,
    responseFormat = "mp3",
  } = options;

  // Validate speed
  if (speed < 0.25 || speed > 4.0) {
    throw new Error("Speed must be between 0.25 and 4.0");
  }

  // Get API key from environment
  const apiKey = ENV.forgeApiKey;
  const apiUrl = ENV.forgeApiUrl;

  if (!apiKey || !apiUrl) {
    throw new Error("OpenAI API credentials not configured");
  }

  try {
    // Call OpenAI TTS API
    const response = await fetch(`${apiUrl}/v1/audio/speech`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        speed,
        response_format: responseFormat,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI TTS API error: ${response.status} - ${errorText}`);
    }

    // Return audio buffer
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("[TTS] Error generating speech:", error);
    throw error;
  }
}

/**
 * Generate speech with retry logic
 */
export async function generateSpeechWithRetry(
  text: string,
  options: TTSOptions = {},
  maxRetries: number = 3
): Promise<Buffer> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateSpeechWithOpenAI(text, options);
    } catch (error) {
      lastError = error as Error;
      console.warn(`[TTS] Attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Failed to generate speech after retries");
}

/**
 * Split long text into chunks for TTS
 * OpenAI TTS has a 4096 character limit per request
 */
export function splitTextForTTS(text: string, maxLength: number = 4000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  const sentences = text.split(/[.!?。！？]\s*/);
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence + ". ";
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence + ". ";
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Generate speech for long text by splitting into chunks
 */
export async function generateSpeechForLongText(
  text: string,
  options: TTSOptions = {}
): Promise<Buffer> {
  const chunks = splitTextForTTS(text);

  if (chunks.length === 1) {
    return await generateSpeechWithRetry(text, options);
  }

  // Generate speech for each chunk
  const audioBuffers: Buffer[] = [];
  for (const chunk of chunks) {
    const audio = await generateSpeechWithRetry(chunk, options);
    audioBuffers.push(audio);
  }

  // Concatenate audio buffers
  return Buffer.concat(audioBuffers);
}
