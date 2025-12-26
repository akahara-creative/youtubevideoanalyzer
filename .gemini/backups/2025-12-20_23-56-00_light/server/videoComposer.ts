/**
 * Video Composer
 * 
 * Composes final video from scenario, slides, and audio.
 * Uses existing TTS and video rendering functionality.
 */

import { renderVideo } from "./videoRenderer";
import { generateSpeech } from "./voicevoxClient";
import { storagePut } from "./storage";
import type { Scenario, Slide } from "./contentStrategy";
import puppeteer from "puppeteer";
import { promises as fs } from "fs";
import path from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { execSync } from "child_process";

/**
 * ⚠️ WARNING: Voice generation is currently disabled (ENABLE_VOICE=false)
 * This will be implemented in Cursor with direct VoiceVox API access
 * DO NOT remove VoiceVox-related code below
 */
const ENABLE_VOICE = false;

/**
 * Puppeteer Chromeの実行パスを動的に検出
 */
function findChromeExecutable(): string | undefined {
  try {
    // 環境変数で指定されている場合
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // ユーザーキャッシュを検索
    const userCachePaths = [
      `/home/${process.env.USER}/.cache/puppeteer`,
      '/home/ubuntu/.cache/puppeteer',
      '/root/.cache/puppeteer',
    ];

    for (const cachePath of userCachePaths) {
      try {
        const result = execSync(`find ${cachePath} -name "chrome" -type f 2>/dev/null | head -1`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();
        if (result) {
          console.log(`[VideoComposer] Found Chrome at: ${result}`);
          return result;
        }
      } catch {}
    }

    console.warn('[VideoComposer] Chrome executable not found, using default');
    return undefined;
  } catch (error) {
    console.error('[VideoComposer] Error finding Chrome executable:', error);
    return undefined;
  }
}

/**
 * Generate slide images from slide data using Puppeteer
 */
export async function generateSlideImages(
  slides: Slide[]
): Promise<Array<{ imageUrl: string; duration: number }>> {
  console.log("[VideoComposer] Generating slide images");

  const executablePath = findChromeExecutable();
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
    ],
    executablePath,
  });

  const slideImages: Array<{ imageUrl: string; duration: number }> = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    for (const slide of slides) {
      // Generate HTML for the slide
      const html = generateSlideHTML(slide);

      // Set HTML content
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 60000 });

      // Take screenshot
      const screenshot = await page.screenshot({
        type: "png",
        fullPage: false,
      });

      // Upload to S3
      const fileName = `slide-${slide.slideNumber}-${randomBytes(4).toString("hex")}.png`;
      const { url } = await storagePut(
        `video-slides/${fileName}`,
        screenshot,
        "image/png"
      );

      slideImages.push({
        imageUrl: url,
        duration: slide.duration,
      });

      console.log(
        `[VideoComposer] Generated slide ${slide.slideNumber}: ${url}`
      );
    }
  } finally {
    await browser.close();
  }

  return slideImages;
}

/**
 * Generate HTML for a single slide
 */
function generateSlideHTML(slide: Slide): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${slide.title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      width: 1920px;
      height: 1080px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Meiryo', sans-serif;
      padding: 80px;
    }
    
    .slide-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: white;
      border-radius: 20px;
      padding: 80px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    
    h1 {
      font-size: 72px;
      font-weight: bold;
      color: #2d3748;
      margin-bottom: 60px;
      text-align: center;
      line-height: 1.3;
    }
    
    .content {
      width: 100%;
      max-width: 1400px;
    }
    
    .content-item {
      font-size: 48px;
      color: #4a5568;
      margin-bottom: 40px;
      padding-left: 40px;
      position: relative;
      line-height: 1.6;
    }
    
    .content-item::before {
      content: "•";
      position: absolute;
      left: 0;
      color: #667eea;
      font-weight: bold;
      font-size: 60px;
    }
    
    .slide-number {
      position: absolute;
      top: 40px;
      right: 40px;
      font-size: 36px;
      color: #a0aec0;
      font-weight: bold;
    }
  </style>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
  <div class="slide-container">
    <div class="slide-number">${slide.slideNumber}</div>
    <h1>${slide.title}</h1>
    <div class="content">
      ${slide.content.map((item) => `<div class="content-item">${item}</div>`).join("")}
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Generate audio from scenario
 */
export async function generateAudioFromScenario(
  scenario: Scenario,
  speakerId: number = 3 // デフォルト: ずんだもん・ノーマル
): Promise<Buffer> {
  console.log("[VideoComposer] ========== Generating audio from scenario ==========");
  console.log("[VideoComposer] Speaker ID:", speakerId);
  
  if (!ENABLE_VOICE) {
    console.warn("[VideoComposer] ⚠️ Voice generation is disabled (ENABLE_VOICE=false)");
    console.warn("[VideoComposer] Returning silent audio (to be implemented in Cursor)");
    return Buffer.alloc(0);
  }
  
  console.log("[VideoComposer] Generating audio with VoiceVox TTS");

  try {
    // シナリオから全ナレーションテキストを結合
    const sections = [
      scenario.hook.content,
      scenario.problemPresentation.content,
      scenario.solution.content,
      scenario.callToAction.content,
    ];
    const fullText = sections
      .filter((text: string) => text && text.trim().length > 0)
      .join('\n');

    if (!fullText || fullText.trim().length === 0) {
      console.error("[VideoComposer] ❌ No narration text found, returning silent audio");
      return Buffer.alloc(0);
    }

    console.log(`[VideoComposer] Narration text length: ${fullText.length} characters`);
    console.log(`[VideoComposer] First 100 chars: ${fullText.substring(0, 100)}...`);

    // テキストが長い場合はチャンクに分割（VoiceVox APIのリクエストサイズ制限を回避）
    const MAX_CHUNK_SIZE = 500; // 最大500文字/チャンク
    const chunks: string[] = [];
    
    if (fullText.length <= MAX_CHUNK_SIZE) {
      chunks.push(fullText);
    } else {
      // 文の区切り（。！？）で分割
      const sentences = fullText.split(/([\u3002\uff01\uff1f])/g).filter(s => s.trim());
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= MAX_CHUNK_SIZE) {
          currentChunk += sentence;
        } else {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = sentence;
        }
      }
      if (currentChunk) chunks.push(currentChunk);
    }

    console.log(`[VideoComposer] Split text into ${chunks.length} chunks`);

    // 各チャンクごとに音声を生成
    const audioBuffers: Buffer[] = [];
    let totalDuration = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[VideoComposer] Generating audio for chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      
      const result = await generateSpeech({
        text: chunk,
        speaker: speakerId,
        speed: 1.0,
        pitch: 0.0,
        intonationScale: 1.0,
      });

      audioBuffers.push(result.audioBuffer);
      totalDuration += result.duration;
      
      console.log(`[VideoComposer] Chunk ${i + 1} audio: ${result.audioBuffer.length} bytes, ${result.duration.toFixed(2)}s`);
    }

    // 音声バッファを結合
    const combinedBuffer = Buffer.concat(audioBuffers);
    console.log(
      `[VideoComposer] ✅ Generated audio successfully (${combinedBuffer.length} bytes, ${totalDuration.toFixed(2)}s)`
    );

    if (combinedBuffer.length === 0) {
      console.error("[VideoComposer] ❌ Audio buffer is empty!");
    }

    return combinedBuffer;
  } catch (error: any) {
    console.error("[VideoComposer] ❌ Failed to generate audio with VoiceVox:", error.message);
    console.error("[VideoComposer] Error stack:", error.stack);
    console.log("[VideoComposer] Falling back to silent audio");
    return Buffer.alloc(0);
  }
}

/**
 * Compose final video from slides and audio
 */
export async function composeVideo(params: {
  slides: Slide[];
  scenario: Scenario;
  jobId: number;
  speakerId?: number; // VoiceVox speaker ID
}): Promise<string> {
  console.log("[VideoComposer] Composing final video");

  const { slides, scenario, jobId, speakerId = 3 } = params;

  // Step 1: Generate slide images
  const slideImages = await generateSlideImages(slides);

  // Step 2: Generate audio from scenario
  const audioBuffer = await generateAudioFromScenario(scenario, speakerId);

  // Step 3: Render video using existing videoRenderer
  const videoPath = await renderVideo({
    slides: slideImages,
    audioBuffer,
    projectId: jobId,
  });

  console.log(`[VideoComposer] Video rendered: ${videoPath}`);

  // Step 4: Upload video to S3
  const videoBuffer = await fs.readFile(videoPath);
  const fileName = `video-${jobId}-${randomBytes(8).toString("hex")}.mp4`;
  const { url } = await storagePut(
    `generated-videos/${fileName}`,
    videoBuffer,
    "video/mp4"
  );

  console.log(`[VideoComposer] Video uploaded to S3: ${url}`);

  // Step 5: Clean up temporary file
  await fs.unlink(videoPath).catch(() => {});

  return url;
}

/**
 * Perform complete video composition
 */
export async function performVideoComposition(params: {
  slides: Slide[];
  scenario: Scenario;
  jobId: number;
  speakerId?: number; // VoiceVox speaker ID
}): Promise<{ videoUrl: string }> {
  console.log(`[VideoComposer] Starting video composition for job ${params.jobId}`);

  const videoUrl = await composeVideo({
    slides: params.slides,
    scenario: params.scenario,
    jobId: params.jobId,
    speakerId: params.speakerId,
  });

  console.log("[VideoComposer] Video composition completed");

  return { videoUrl };
}
