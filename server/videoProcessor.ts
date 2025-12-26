import { exec } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { storagePut } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);
const rename = promisify(fs.rename);
const execAsync = promisify(exec);

interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

interface FrameAnalysis {
  timestamp: number;
  visualDescription: string;
  codeContent?: string;
  codeExplanation?: string;
  frameUrl: string;
}

export interface VideoProcessingResult {
  videoId: string;
  title: string;
  transcriptionSegments: TranscriptionSegment[];
  frameAnalyses: FrameAnalysis[];
}

/**
 * Extract YouTube video ID from URL
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Download YouTube video and extract audio using yt-dlp
 */
async function downloadVideoAndExtractAudio(
  videoUrl: string,
  outputDir: string
): Promise<{ videoPath: string; audioPath: string; title: string }> {
  const videoPath = path.join(outputDir, "video.mp4");
  const audioPath = path.join(outputDir, "audio.mp3");
  const ytDlpPath = path.join(__dirname, "yt-dlp");

  // Get video title first
  const title = await new Promise<string>((resolve, reject) => {
    exec(
      `"${ytDlpPath}" --get-title "${videoUrl}"`,
      {
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("yt-dlp get-title error:", stderr);
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      }
    );
  });

  // Download video
  await new Promise<void>((resolve, reject) => {
    exec(
      `"${ytDlpPath}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" -o "${videoPath}" "${videoUrl}"`,
      {
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("yt-dlp download error:", stderr);
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });

  // Download audio directly with yt-dlp (m4a format, no conversion)
  // This completely avoids ffmpeg processing and reduces memory usage
  const m4aPath = audioPath.replace('.mp3', '.m4a');
  await new Promise<void>((resolve, reject) => {
    exec(
      `"${ytDlpPath}" -f "worstaudio[ext=m4a]/worstaudio/bestaudio[ext=m4a]/bestaudio" -o "${m4aPath}" "${videoUrl}"`,
      {
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("yt-dlp audio download error:", stderr);
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });

  // Rename m4a to mp3 extension (Whisper API accepts m4a)
  await rename(m4aPath, audioPath);

  return { videoPath, audioPath, title };
}



/**
 * Upload audio to S3 and transcribe using Whisper API
 */
async function transcribeVideoAudio(audioPath: string): Promise<TranscriptionSegment[]> {
  const audioBuffer = await readFile(audioPath);
  const audioSizeMB = audioBuffer.length / (1024 * 1024);
  
  console.log(`[transcribeVideoAudio] Audio file size: ${audioSizeMB.toFixed(2)}MB`);

  // Check if audio is too large
  if (audioSizeMB > 15) {
    throw new Error(`Audio file is too large: ${audioSizeMB.toFixed(2)}MB. Maximum allowed is 15MB.`);
  }

  // Upload audio to storage (local or remote)
  const audioKey = `temp-audio/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
  const { url: audioUrl } = await storagePut(audioKey, audioBuffer, "audio/mpeg");
  
  // transcribeAudio function will automatically use local Whisper if configured
  const result = await transcribeAudio({
    audioUrl,
    language: "ja",
  });

  console.log("[transcribeVideoAudio] Whisper API result:", JSON.stringify(result, null, 2));

  // Check for errors
  if ('error' in result) {
    console.error("[transcribeVideoAudio] Transcription failed:", result.error, result.details);
    throw new Error(`Transcription failed: ${result.error} - ${result.details}`);
  }

  // Convert Whisper segments to our format
  const segments: TranscriptionSegment[] = [];
  if ('segments' in result && result.segments) {
    console.log("[transcribeVideoAudio] Found", result.segments.length, "segments");
    segments.push(...result.segments.map((seg: any) => ({
      start: Math.floor(seg.start),
      end: Math.ceil(seg.end),
      text: seg.text.trim(),
    })));
  } else {
    console.log("[transcribeVideoAudio] No segments found in result");
  }

  console.log("[transcribeVideoAudio] Returning", segments.length, "segments");
  return segments;
}

/**
 * Extract frames from video at regular intervals using direct ffmpeg command
 * This is more memory-efficient than using fluent-ffmpeg library
 */
async function extractFrames(
  videoPath: string,
  outputDir: string,
  intervalSeconds: number = 60
): Promise<string[]> {
  const framesDir = path.join(outputDir, "frames");
  await mkdir(framesDir, { recursive: true });

  // Get video duration using ffprobe command
  const durationCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
  const { stdout: durationStr } = await execAsync(durationCmd);
  const duration = parseFloat(durationStr.trim());

  console.log(`[extractFrames] Video duration: ${duration}s`);

  // Calculate frame timestamps
  const numFrames = Math.max(1, Math.min(Math.floor(duration / intervalSeconds), 15));
  const timestamps = Array.from({ length: numFrames }, (_, i) => 
    i * Math.min(intervalSeconds, duration / numFrames)
  );

  console.log(`[extractFrames] Extracting ${numFrames} frames...`);

  // Extract frames one by one to minimize memory usage
  const framePaths: string[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i];
    const framePath = path.join(framesDir, `frame-${i + 1}.png`);
    
    // Extract single frame at specific timestamp
    // -ss: seek to timestamp, -vframes 1: extract 1 frame, -s: resize to 640x360
    const cmd = `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -s 640x360 -y "${framePath}"`;
    
    try {
      await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer
      framePaths.push(framePath);
      console.log(`[extractFrames] Extracted frame ${i + 1}/${numFrames} at ${timestamp.toFixed(1)}s`);
    } catch (error) {
      console.error(`[extractFrames] Failed to extract frame ${i + 1}:`, error);
      // Continue with next frame even if one fails
    }
  }

  if (framePaths.length === 0) {
    throw new Error("Failed to extract any frames from video");
  }

  console.log(`[extractFrames] Successfully extracted ${framePaths.length} frames`);
  return framePaths;
}

/**
 * Analyze a frame using LLM vision capabilities
 */
async function analyzeFrame(
  framePath: string,
  timestamp: number
): Promise<{ visualDescription: string; codeContent?: string; codeExplanation?: string; frameUrl: string }> {
  const frameBuffer = await readFile(framePath);
  const frameKey = `frames/${Date.now()}-${timestamp}-${Math.random().toString(36).substring(7)}.png`;
  const { url: frameUrl } = await storagePut(frameKey, frameBuffer, "image/png");

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "あなたは動画フレームを分析する専門家です。画面に表示されている内容を構造化して詳しく説明してください。以下の観点から分析してください：\n" +
          "1. 画面の全体的な説明（何が映っているか）\n" +
          "2. 主要な要素の詳細（人物、背景、テキスト、UI要素など）\n" +
          "3. テロップや字幕の内容（表示されている文字情報）\n" +
          "4. コードの有無（コードが表示されている場合は、その内容と目的を詳しく説明）\n" +
          "5. 視覚的な効果や特殊な要素\n\n" +
          "分析は専門的で詳細なものにし、画面に実際に表示されている内容を正確に記述してください。推測ではなく、実際に見える情報を基に説明してください。",
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: frameUrl,
              detail: "high",
            },
          },
          {
            type: "text",
            text: "この動画フレームを分析してください。画面に表示されている内容を以下の構造で詳しく説明してください：\n\n" +
              "## 画面の概要\n" +
              "このフレームは何を映しているか、全体的な説明をしてください。\n\n" +
              "## 主要な要素の詳細\n\n" +
              "### 1. 人物（人物が映っている場合）\n" +
              "- 性別・年齢・外見\n" +
              "- 服装・アクセサリー\n" +
              "- 表情・動作・姿勢\n" +
              "- 位置・構図\n\n" +
              "### 2. 背景・設定\n" +
              "- 場所（室内/室外、具体的な環境）\n" +
              "- インテリア・装飾品\n" +
              "- 照明・雰囲気\n\n" +
              "### 3. テロップ・字幕（表示されている文字情報）\n" +
              "- 表示されているテキストの内容\n" +
              "- フォント・デザイン・色\n" +
              "- 位置・目的\n\n" +
              "### 4. UI要素・画面表示（アプリやウェブサイトが映っている場合）\n" +
              "- 表示されているインターフェースの説明\n" +
              "- ボタン・メニュー・データなどの詳細\n\n" +
              "## コードの有無について\n" +
              "プログラミングコード、ソースコード、またはコマンドラインの表示がある場合は、その内容と目的を詳しく説明してください。コードが含まれていない場合は、「この動画フレームには、プログラミングコード、ソースコード、またはコマンドラインの表示は一切含まれていません。」と明記してください。\n\n" +
              "分析は専門的で詳細なものにし、実際に画面に表示されている内容を正確に記述してください。",
          },
        ],
      },
    ],
  });

  const content = response.choices[0].message.content;
  const description = typeof content === 'string' ? content : JSON.stringify(content);

  // Check if code is detected
  const codeDetectionResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "画像分析結果からコードが含まれているかを判定し、含まれている場合はコードを抽出して説明してください。",
      },
      {
        role: "user",
        content: `以下の画像分析結果を見て、コードが含まれているか判定してください:\n\n${description}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "code_detection",
        strict: true,
        schema: {
          type: "object",
          properties: {
            hasCode: { type: "boolean", description: "コードが含まれているかどうか" },
            codeContent: { type: "string", description: "抽出されたコード(コードがない場合は空文字列)" },
            codeExplanation: { type: "string", description: "コードの説明(コードがない場合は空文字列)" },
          },
          required: ["hasCode", "codeContent", "codeExplanation"],
          additionalProperties: false,
        },
      },
    },
  });

  const codeContent = codeDetectionResponse.choices[0].message.content;
  const contentStr = typeof codeContent === 'string' ? codeContent : JSON.stringify(codeContent);
  
  // JSON形式を抽出（コードブロックやマークダウン形式からも抽出）
  let codeInfo: { hasCode: boolean; codeContent: string; codeExplanation: string };
  try {
    // まず、そのままパースを試みる
    codeInfo = JSON.parse(contentStr);
  } catch (error) {
    // JSON形式でない場合、JSON部分を抽出
    const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        codeInfo = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.warn("[analyzeFrame] Failed to parse JSON from response, using defaults");
        // パースに失敗した場合はデフォルト値を返す
        codeInfo = {
          hasCode: false,
          codeContent: "",
          codeExplanation: "",
        };
      }
    } else {
      console.warn("[analyzeFrame] No JSON found in response, using defaults");
      codeInfo = {
        hasCode: false,
        codeContent: "",
        codeExplanation: "",
      };
    }
  }

  return {
    visualDescription: description,
    codeContent: codeInfo.hasCode ? codeInfo.codeContent : undefined,
    codeExplanation: codeInfo.hasCode ? codeInfo.codeExplanation : undefined,
    frameUrl,
  };
}

/**
 * Process YouTube video: download, transcribe, and analyze frames
 */
/**
 * Check if analysis is cancelled
 */
async function checkCancelled(analysisId?: number): Promise<boolean> {
  if (!analysisId) return false;
  
  try {
    const { getVideoAnalysisById } = await import("./db.js");
    const analysis = await getVideoAnalysisById(analysisId);
    return analysis?.status === "cancelled";
  } catch (error) {
    console.warn("[checkCancelled] Failed to check cancellation status:", error);
    return false;
  }
}

export async function processYouTubeVideo(
  videoUrl: string,
  options?: {
    analysisId?: number;
    onProgress?: (step: string, progress: number, message?: string) => Promise<void>;
  }
): Promise<VideoProcessingResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  const tempDir = path.join("/tmp", `video-${videoId}-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  const updateProgress = async (step: string, progress: number, message?: string) => {
    if (options?.onProgress) {
      await options.onProgress(step, progress, message);
    }
  };

  // Check cancellation before starting
  if (await checkCancelled(options?.analysisId)) {
    throw new Error("Analysis was cancelled by user");
  }

  try {
    // Step 1: Download video and extract audio (0-20%)
    await updateProgress("download", 0, "動画をダウンロード中...");
    
    // Check cancellation before download
    if (await checkCancelled(options?.analysisId)) {
      throw new Error("Analysis was cancelled by user");
    }
    
    const { videoPath, audioPath, title } = await downloadVideoAndExtractAudio(videoUrl, tempDir);
    await updateProgress("download", 20, "動画のダウンロードが完了しました");

    // Step 2: Transcribe audio (20-50%)
    await updateProgress("transcription", 20, "音声を文字起こし中...");
    
    // Check cancellation before transcription
    if (await checkCancelled(options?.analysisId)) {
      throw new Error("Analysis was cancelled by user");
    }
    
    const transcriptionSegments = await transcribeVideoAudio(audioPath);
    await updateProgress("transcription", 50, `文字起こしが完了しました（${transcriptionSegments.length}セグメント）`);

    // Step 3: Extract frames (50-55%)
    await updateProgress("frameExtraction", 50, "フレームを抽出中...");
    
    // Check cancellation before frame extraction
    if (await checkCancelled(options?.analysisId)) {
      throw new Error("Analysis was cancelled by user");
    }
    
    const framePaths = await extractFrames(videoPath, tempDir, 30);
    await updateProgress("frameExtraction", 55, `フレーム抽出が完了しました（${framePaths.length}フレーム）`);

    // Step 4: Analyze frames (55-90%)
    const frameAnalyses: FrameAnalysis[] = [];
    console.log(`[processYouTubeVideo] Analyzing ${framePaths.length} frames...`);
    const frameProgressStep = (90 - 55) / framePaths.length; // 各フレームで進む進捗率
    
    for (let i = 0; i < framePaths.length; i++) {
      // Check cancellation before each frame analysis
      if (await checkCancelled(options?.analysisId)) {
        throw new Error("Analysis was cancelled by user");
      }
      
      const timestamp = i * 30;
      const currentProgress = 55 + (i * frameProgressStep);
      await updateProgress(
        "frameAnalysis",
        Math.floor(currentProgress),
        `フレーム分析中: ${i + 1}/${framePaths.length} (${timestamp}秒)`
      );
      
      console.log(`[processYouTubeVideo] Analyzing frame ${i + 1}/${framePaths.length} (${timestamp}s)...`);
      try {
        const analysis = await analyzeFrame(framePaths[i], timestamp);
        frameAnalyses.push({
          timestamp,
          ...analysis,
        });
        console.log(`[processYouTubeVideo] Frame ${i + 1} analysis completed`);
      } catch (error) {
        console.error(`[processYouTubeVideo] Error analyzing frame ${i + 1}:`, error);
        // エラーが発生しても処理を続行（デフォルト値を追加）
        frameAnalyses.push({
          timestamp,
          visualDescription: `フレーム分析エラー: ${error instanceof Error ? error.message : String(error)}`,
          frameUrl: "",
        });
      }
    }
    await updateProgress("frameAnalysis", 90, `フレーム分析が完了しました（${frameAnalyses.length}フレーム）`);
    console.log(`[processYouTubeVideo] Frame analysis completed: ${frameAnalyses.length} frames`);

    return {
      videoId,
      title,
      transcriptionSegments,
      frameAnalyses,
    };
  } finally {
    // Cleanup temp files
    try {
      // Recursively remove all files and subdirectories
      const removeRecursive = async (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            await removeRecursive(filePath);
            fs.rmdirSync(filePath);
          } else {
            await unlink(filePath).catch(() => {});
          }
        }
      };
      
      await removeRecursive(tempDir);
      fs.rmdirSync(tempDir);
    } catch (e) {
      console.error("Failed to cleanup temp files:", e);
    }
  }
}

/**
 * Generate comprehensive summary from transcription and frame analyses
 */
export async function generateVideoSummary(
  transcriptionSegments: TranscriptionSegment[],
  frameAnalyses: FrameAnalysis[]
): Promise<{ summary: string; learningPoints: string }> {
  // 入力値の検証
  if (!transcriptionSegments || !Array.isArray(transcriptionSegments)) {
    console.warn("[generateVideoSummary] transcriptionSegments is invalid, using empty array");
    transcriptionSegments = [];
  }
  if (!frameAnalyses || !Array.isArray(frameAnalyses)) {
    console.warn("[generateVideoSummary] frameAnalyses is invalid, using empty array");
    frameAnalyses = [];
  }
  
  const transcriptionText = transcriptionSegments.map((s) => s?.text || "").join(" ");
  const frameDescriptions = frameAnalyses
    .map((f) => `[${f?.timestamp || 0}s] ${f?.visualDescription || ""}`)
    .join("\n");

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "あなたは動画の内容を分析して、学習者にとって有益なサマリーを作成する専門家です。\n" +
          "動画の内容を正確に理解し、以下の点に注意して分析してください：\n" +
          "1. 動画の主題・テーマを正確に把握する\n" +
          "2. 文字起こしと映像分析の両方を統合して理解する\n" +
          "3. 動画で説明されている具体的な方法・手順・ポイントを抽出する\n" +
          "4. 視聴者が実際に学べる実践的な内容を重視する\n" +
          "5. 要約は詳細で具体的な内容を含める（200-500文字程度）\n" +
          "6. 学習ポイントは箇条書きで、各ポイントに説明を加える",
      },
      {
        role: "user",
        content: `以下の動画の文字起こしと映像分析結果から、包括的で詳細なサマリーを作成してください。

【文字起こし】
${transcriptionText}

【映像分析】
${frameDescriptions}

以下の形式でJSON形式で出力してください：

1. summary（動画全体の要約）:
   - 動画の主題・テーマを明確に示す
   - 動画で説明されている内容を200-500文字程度で詳しく要約
   - 具体的な方法・手順・ポイントを含める
   - 文字起こしと映像分析の両方の情報を統合して記述

2. learningPoints（学習ポイント）:
   - この動画で学べる主要なポイントを箇条書きで抽出
   - 各ポイントには簡潔な説明を加える（例：「- **ポイント名:** 説明文」）
   - 実践的で具体的な内容を重視
   - 5-10個程度のポイントを抽出

出力形式の例：
{
  "summary": "この動画は、[主題]について解説しています。[具体的な内容の要約]。特に、[重要なポイント]について詳しく説明されています。",
  "learningPoints": "- **ポイント1:** 説明文\n- **ポイント2:** 説明文\n..."
}

動画の内容を正確に理解し、文字起こしと映像分析の両方の情報を活用して、詳細で実践的なサマリーを作成してください。`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "video_summary",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "動画全体の要約" },
            learningPoints: { type: "string", description: "学習ポイント(箇条書き)" },
          },
          required: ["summary", "learningPoints"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  
  // JSON形式を抽出（コードブロックやマークダウン形式からも抽出）
  let result: { summary: string; learningPoints: string };
  try {
    // まず、そのままパースを試みる
    result = JSON.parse(contentStr);
  } catch (error) {
    // JSON形式でない場合、JSON部分を抽出
    const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        result = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.warn("[generateVideoSummary] Failed to parse JSON from response, using fallback");
        // パースに失敗した場合は、テキストから要約を抽出
        const summaryMatch = contentStr.match(/summary["\s:：]+([^"}\n]+)/i);
        const learningMatch = contentStr.match(/learningPoints["\s:：]+([^"}\n]+)/i);
        result = {
          summary: summaryMatch ? summaryMatch[1].trim() : "要約の生成に失敗しました。",
          learningPoints: learningMatch ? learningMatch[1].trim() : "学習ポイントの抽出に失敗しました。",
        };
      }
    } else {
      console.warn("[generateVideoSummary] No JSON found in response, using fallback");
      result = {
        summary: "要約の生成に失敗しました。",
        learningPoints: "学習ポイントの抽出に失敗しました。",
      };
    }
  }
  
  // resultが正しく設定されているか確認
  if (!result || typeof result !== 'object') {
    console.error("[generateVideoSummary] result is invalid, using fallback");
    result = {
      summary: "要約の生成に失敗しました。",
      learningPoints: "学習ポイントの抽出に失敗しました。",
    };
  }
  
  // summaryとlearningPointsが存在するか確認
  if (!result.summary || typeof result.summary !== 'string') {
    console.warn("[generateVideoSummary] summary is missing or invalid, using fallback");
    result.summary = "要約の生成に失敗しました。";
  }
  if (!result.learningPoints || typeof result.learningPoints !== 'string') {
    console.warn("[generateVideoSummary] learningPoints is missing or invalid, using fallback");
    result.learningPoints = "学習ポイントの抽出に失敗しました。";
  }
  
  // データベースのtext型の制限（約64KB）を考慮して要約・箇条書き化
  const MAX_TEXT_LENGTH = 60000; // 安全のため60KBに制限
  if (result.summary.length > MAX_TEXT_LENGTH) {
    const { compressText } = await import("./_core/textCompressor");
    result.summary = await compressText(result.summary, "summary");
  }
  if (result.learningPoints.length > MAX_TEXT_LENGTH) {
    const { compressText } = await import("./_core/textCompressor");
    result.learningPoints = await compressText(result.learningPoints, "learningPoints");
  }
  
  return result;
}
