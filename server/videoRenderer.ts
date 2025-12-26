import { storagePut } from "./storage";
import { generateSpeechForLongText, TTSVoice } from "./ttsClient";
import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import path from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

/**
 * TTS (Text-to-Speech) using OpenAI API
 */
export async function generateSpeech(
  text: string,
  voice: TTSVoice = "alloy"
): Promise<Buffer> {
  try {
    // Use OpenAI TTS API with retry logic and long text support
    const audioBuffer = await generateSpeechForLongText(text, {
      voice,
      model: "tts-1",
      speed: 1.0,
      responseFormat: "mp3",
    });
    
    return audioBuffer;
  } catch (error) {
    console.error("[TTS] Error generating speech:", error);
    throw error;
  }
}

/**
 * Combine slides and audio into a video using ffmpeg
 */
export async function renderVideo(params: {
  slides: Array<{ imageUrl: string; duration: number }>;
  audioBuffer?: Buffer;
  projectId: number;
}): Promise<string> {
  const { slides, audioBuffer, projectId } = params;
  
  const tempDir = path.join(tmpdir(), `video-${projectId}-${randomBytes(8).toString("hex")}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Download slide images
    const slideFiles: string[] = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const slideFile = path.join(tempDir, `slide-${i}.png`);
      
      // Download image from URL
      const response = await fetch(slide.imageUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(slideFile, buffer);
      
      slideFiles.push(slideFile);
    }

    // Save audio if provided
    let audioFile: string | undefined;
    if (audioBuffer && audioBuffer.length > 0) {
      // VoiceVox APIはWAV形式を返すため、.wavを使用
      audioFile = path.join(tempDir, "audio.wav");
      await fs.writeFile(audioFile, audioBuffer);
    }

    // Generate video with ffmpeg
    const outputFile = path.join(tempDir, "output.mp4");
    
    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg();

      // Add slides as input with duration
      for (let i = 0; i < slideFiles.length; i++) {
        command = command.input(slideFiles[i]).inputOptions([
          '-loop', '1',
          '-t', `${slides[i].duration}`,
        ]);
      }

      // 音声ファイルの入力インデックスを記録
      const audioInputIndex = slideFiles.length;

      // Concatenate slides
      command = command
        .complexFilter([
          ...slideFiles.map((_, i) => `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`),
          `${slideFiles.map((_, i) => `[v${i}]`).join("")}concat=n=${slideFiles.length}:v=1:a=0[outv]`,
        ])
        .map("[outv]"); // ビデオストリームをマッピング

      // Add audio if provided
      if (audioFile) {
        console.log('[VideoRenderer] Adding audio file:', audioFile);
        command = command
          .input(audioFile)
          .inputOptions(['-f', 'wav']) // WAV形式を明示
          .audioCodec("aac")
          .audioBitrate('128k') // 音声ビットレートを設定
          .map(`${audioInputIndex}:a`); // 音声ストリームを明示的にマッピング
      } else {
        // No audio, add silent audio track
        console.log('[VideoRenderer] No audio file provided, adding silent audio track');
        command = command
          .input('anullsrc=r=44100:cl=stereo')
          .inputOptions(['-f', 'lavfi'])
          .audioCodec("aac")
          .audioBitrate('128k');
        // lavfi入力の場合、明示的な.map()は不要（自動的に音声ストリームとして追加される）
        // -shortestオプションで動画の長さに合わせて音声が切り取られる
      }

      command
        .videoCodec("libx264")
        .outputOptions(["-pix_fmt yuv420p", "-shortest"])
        .output(outputFile)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    // Return local file path (caller will handle S3 upload and cleanup)
    return outputFile;
  } catch (error) {
    // Cleanup on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
    
    console.error("[VideoRenderer] Error rendering video:", error);
    throw error;
  }
}

/**
 * Generate complete video from project
 */
export async function generateCompleteVideo(params: {
  projectId: number;
  scenes: Array<{
    id: number;
    script: string;
    duration: number;
    slides: Array<{ imageUrl: string; slideNumber: number }>;
  }>;
}): Promise<string> {
  const { projectId, scenes } = params;

  // Generate audio for each scene
  const sceneAudios: Buffer[] = [];
  for (const scene of scenes) {
    const audio = await generateSpeech(scene.script);
    sceneAudios.push(audio);
  }

  // Combine all scene audios
  const combinedAudio = Buffer.concat(sceneAudios);

  // Prepare slides with durations
  const allSlides = scenes.flatMap((scene) =>
    scene.slides.map((slide) => ({
      imageUrl: slide.imageUrl!,
      duration: scene.duration / scene.slides.length,
    }))
  );

  // Render video
  const videoUrl = await renderVideo({
    slides: allSlides,
    audioBuffer: combinedAudio,
    projectId,
  });

  return videoUrl;
}
