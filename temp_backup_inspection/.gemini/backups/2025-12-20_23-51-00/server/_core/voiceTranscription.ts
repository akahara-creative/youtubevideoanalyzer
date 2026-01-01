/**
 * Voice transcription helper using internal Speech-to-Text service
 *
 * Frontend implementation guide:
 * 1. Capture audio using MediaRecorder API
 * 2. Upload audio to storage (e.g., S3) to get URL
 * 3. Call transcription with the URL
 * 
 * Example usage:
 * ```tsx
 * // Frontend component
 * const transcribeMutation = trpc.voice.transcribe.useMutation({
 *   onSuccess: (data) => {
 *     console.log(data.text); // Full transcription
 *     console.log(data.language); // Detected language
 *     console.log(data.segments); // Timestamped segments
 *   }
 * });
 * 
 * // After uploading audio to storage
 * transcribeMutation.mutate({
 *   audioUrl: uploadedAudioUrl,
 *   language: 'en', // optional
 *   prompt: 'Transcribe the meeting' // optional
 * });
 * ```
 */
import { ENV } from "./env";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type TranscribeOptions = {
  audioUrl: string; // URL to the audio file (e.g., S3 URL)
  language?: string; // Optional: specify language code (e.g., "en", "es", "zh")
  prompt?: string; // Optional: custom prompt for the transcription
};

// Native Whisper API segment format
export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

// Native Whisper API response format
export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
};

export type TranscriptionResponse = WhisperResponse; // Return native Whisper API response directly

export type TranscriptionError = {
  error: string;
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "UPLOAD_FAILED" | "SERVICE_ERROR";
  details?: string;
};

/**
 * Transcribe audio to text using the internal Speech-to-Text service
 * 
 * @param options - Audio data and metadata
 * @returns Transcription result or error
 */
export async function transcribeAudio(
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    // Check if local Whisper should be used
    const { shouldUseLocalService } = await import("./env");
    const useLocalWhisper = shouldUseLocalService("whisper");
    
    if (useLocalWhisper) {
      return await transcribeAudioLocal(options);
    }
    
    // Step 1: Validate environment configuration (for API-based transcription)
    if (!ENV.forgeApiUrl) {
      return {
        error: "Voice transcription service is not configured",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_URL is not set. For local development, set USE_LOCAL_WHISPER=true and install faster-whisper: pip install faster-whisper"
      };
    }
    if (!ENV.forgeApiKey) {
      return {
        error: "Voice transcription service authentication is missing",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_KEY is not set. For local development, set USE_LOCAL_WHISPER=true and install faster-whisper: pip install faster-whisper"
      };
    }

    // Step 2: Download audio from URL
    let audioBuffer: Buffer;
    let mimeType: string;
    try {
      const response = await fetch(options.audioUrl);
      if (!response.ok) {
        return {
          error: "Failed to download audio file",
          code: "INVALID_FORMAT",
          details: `HTTP ${response.status}: ${response.statusText}`
        };
      }
      
      audioBuffer = Buffer.from(await response.arrayBuffer());
      mimeType = response.headers.get('content-type') || 'audio/mpeg';
      
      // Check file size (16MB limit)
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        return {
          error: "Audio file exceeds maximum size limit",
          code: "FILE_TOO_LARGE",
          details: `File size is ${sizeMB.toFixed(2)}MB, maximum allowed is 16MB`
        };
      }
    } catch (error) {
      return {
        error: "Failed to fetch audio file",
        code: "SERVICE_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      };
    }

    // Step 3: Create FormData for multipart upload to Whisper API
    const formData = new FormData();
    
    // Create a Blob from the buffer and append to form
    const filename = `audio.${getFileExtension(mimeType)}`;
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", audioBlob, filename);
    
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    
    // Add prompt - use custom prompt if provided, otherwise generate based on language
    const prompt = options.prompt || (
      options.language 
        ? `Transcribe the user's voice to text, the user's working language is ${getLanguageName(options.language)}`
        : "Transcribe the user's voice to text"
    );
    formData.append("prompt", prompt);

    // Step 4: Call the transcription service with retry logic
    const baseUrl = ENV.forgeApiUrl.endsWith("/")
      ? ENV.forgeApiUrl
      : `${ENV.forgeApiUrl}/`;
    
    const fullUrl = new URL(
      "v1/audio/transcriptions",
      baseUrl
    ).toString();

    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 180000; // 3 minutes
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[transcribeAudio] Attempt ${attempt}/${MAX_RETRIES}...`);
        
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(fullUrl, {
          method: "POST",
          headers: {
            authorization: `Bearer ${ENV.forgeApiKey}`,
            "Accept-Encoding": "identity",
          },
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          lastError = {
            error: "Transcription service request failed",
            code: "TRANSCRIPTION_FAILED",
            details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`
          };
          
          // Retry on 5xx errors
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            console.log(`[transcribeAudio] Server error, retrying in ${attempt * 2}s...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            continue;
          }
          
          return lastError;
        }

        // Success - parse and return response
        const whisperResponse = await response.json() as WhisperResponse;
        
        // Validate response structure
        if (!whisperResponse.text || typeof whisperResponse.text !== 'string') {
          return {
            error: "Invalid transcription response",
            code: "SERVICE_ERROR",
            details: "Transcription service returned an invalid response format"
          };
        }

        console.log(`[transcribeAudio] Success on attempt ${attempt}`);
        return whisperResponse;

      } catch (error: any) {
        console.error(`[transcribeAudio] Attempt ${attempt} failed:`, error.message);
        lastError = error;
        
        // Retry on timeout or network errors
        if (attempt < MAX_RETRIES && (error.name === 'AbortError' || error.message.includes('fetch'))) {
          console.log(`[transcribeAudio] Timeout/network error, retrying in ${attempt * 2}s...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
        
        break;
      }
    }

    // All retries failed
    return {
      error: "Transcription service request failed after retries",
      code: "TRANSCRIPTION_FAILED",
      details: lastError instanceof Error ? lastError.message : JSON.stringify(lastError)
    };

  } catch (error) {
    // Handle unexpected errors
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}

/**
 * Transcribe audio using local faster-whisper (Python script)
 * ファイルパスとURLの両方に対応
 */
export async function transcribeAudioLocal(
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    let audioFilePath: string;
    let isTemporaryFile = false;
    
    // Step 1: Check if audioUrl is a file path or URL
    if (options.audioUrl.startsWith('/tmp/') || 
        options.audioUrl.startsWith('/var/') ||
        (options.audioUrl.startsWith('/') && !options.audioUrl.startsWith('http'))) {
      // It's an absolute file path (e.g., /tmp/video-xxx/audio.mp3)
      audioFilePath = options.audioUrl;
      console.log(`[transcribeAudioLocal] Using file path directly: ${audioFilePath}`);
    } else if (options.audioUrl.startsWith('http://') || options.audioUrl.startsWith('https://')) {
      // It's a URL - download it first (サーバー経由でアクセス)
      let audioBuffer: Buffer;
      let mimeType: string;
      try {
        console.log(`[transcribeAudioLocal] Downloading audio from URL: ${options.audioUrl}`);
        const response = await fetch(options.audioUrl, {
          signal: AbortSignal.timeout(30000), // 30秒タイムアウト
        });
        if (!response.ok) {
          return {
            error: "Failed to download audio file",
            code: "INVALID_FORMAT",
            details: `HTTP ${response.status}: ${response.statusText}`
          };
        }
        
        audioBuffer = Buffer.from(await response.arrayBuffer());
        mimeType = response.headers.get('content-type') || 'audio/mpeg';
        
        // Check file size (16MB limit)
        const sizeMB = audioBuffer.length / (1024 * 1024);
        if (sizeMB > 16) {
          return {
            error: "Audio file exceeds maximum size limit",
            code: "FILE_TOO_LARGE",
            details: `File size is ${sizeMB.toFixed(2)}MB, maximum allowed is 16MB`
          };
        }
      } catch (error) {
        return {
          error: "Failed to fetch audio file",
          code: "SERVICE_ERROR",
          details: error instanceof Error ? error.message : "Unknown error"
        };
      }

      // Save audio to temporary file
      const tempDir = path.join(process.cwd(), "uploads", "temp");
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempFileName = `transcribe_${Date.now()}_${Math.random().toString(36).substring(7)}.${getFileExtension(mimeType)}`;
      audioFilePath = path.join(tempDir, tempFileName);
      await fs.writeFile(audioFilePath, audioBuffer);
      isTemporaryFile = true;
      console.log(`[transcribeAudioLocal] Saved audio to temporary file: ${audioFilePath}`);
    } else {
      return {
        error: "Invalid audio URL or path",
        code: "INVALID_FORMAT",
        details: `Unsupported audio source: ${options.audioUrl}`
      };
    }
    
    try {
      // Step 2: Call Python script for transcription
      const scriptPath = path.join(process.cwd(), "scripts", "transcribe_local.py");
      const language = options.language || "ja";
      
      console.log(`[transcribeAudioLocal] Calling local Whisper: ${scriptPath}`);
      console.log(`[transcribeAudioLocal] Audio file: ${audioFilePath}`);
      
      const { stdout, stderr } = await execAsync(
        `/opt/homebrew/bin/python3 "${scriptPath}" "${audioFilePath}" "${language}"`,
        { timeout: 1200000 } // 20 minutes timeout for small model
      );
      
      if (stderr) {
        console.log(`[transcribeAudioLocal] stderr: ${stderr}`);
      }
      
      // Parse JSON response
      const result = JSON.parse(stdout.trim());
      
      // Check if it's an error
      if (result.error) {
        return {
          error: result.error,
          code: result.code || "TRANSCRIPTION_FAILED",
          details: result.details
        };
      }
      
      // Return transcription result
      return result as TranscriptionResponse;
      
    } finally {
      // Clean up temporary file (only if we created it)
      if (isTemporaryFile) {
        try {
          await fs.unlink(audioFilePath);
          console.log(`[transcribeAudioLocal] Cleaned up temporary file: ${audioFilePath}`);
        } catch (error) {
          console.warn(`[transcribeAudioLocal] Failed to delete temp file: ${audioFilePath}`, error);
        }
      }
    }
    
  } catch (error) {
    return {
      error: "Local transcription failed",
      code: "SERVICE_ERROR",
      details: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}

/**
 * Helper function to get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/ogg': 'ogg',
    'audio/m4a': 'm4a',
    'audio/mp4': 'm4a',
  };
  
  return mimeToExt[mimeType] || 'audio';
}

/**
 * Helper function to get full language name from ISO code
 */
function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch',
    'pl': 'Polish',
    'tr': 'Turkish',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
  };
  
  return langMap[langCode] || langCode;
}

/**
 * Example tRPC procedure implementation:
 * 
 * ```ts
 * // In server/routers.ts
 * import { transcribeAudio } from "./_core/voiceTranscription";
 * 
 * export const voiceRouter = router({
 *   transcribe: protectedProcedure
 *     .input(z.object({
 *       audioUrl: z.string(),
 *       language: z.string().optional(),
 *       prompt: z.string().optional(),
 *     }))
 *     .mutation(async ({ input, ctx }) => {
 *       const result = await transcribeAudio(input);
 *       
 *       // Check if it's an error
 *       if ('error' in result) {
 *         throw new TRPCError({
 *           code: 'BAD_REQUEST',
 *           message: result.error,
 *           cause: result,
 *         });
 *       }
 *       
 *       // Optionally save transcription to database
 *       await db.insert(transcriptions).values({
 *         userId: ctx.user.id,
 *         text: result.text,
 *         duration: result.duration,
 *         language: result.language,
 *         audioUrl: input.audioUrl,
 *         createdAt: new Date(),
 *       });
 *       
 *       return result;
 *     }),
 * });
 * ```
 */
