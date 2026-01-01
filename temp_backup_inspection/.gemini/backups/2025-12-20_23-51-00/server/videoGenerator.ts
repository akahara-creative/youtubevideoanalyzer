import { invokeLLM } from "./_core/llm";
import { getRAGContextWithTags, saveToRAGWithTags } from "./ragWithTags";
import puppeteer from "puppeteer";
import { storagePut } from "./storage";
import fs from "fs";

/**
 * Analyze strategies from RAG and generate video structure
 */
export async function analyzeStrategiesAndGenerateStructure(params: {
  theme: string;
  targetAudience?: string;
}) {
  console.log("[Video Generator] Analyzing strategies from RAG...");

  // Get relevant strategies from RAG
  const ragContext = await getRAGContextWithTags({
    query: params.theme,
    limit: 15,
  });

  const contextText = ragContext;

  // Generate video structure using LLM
  const prompt = `以下のRAGに蓄積された戦略を参考に、「${params.theme}」をテーマにした動画の構成を提案してください。

# 蓄積された戦略
${contextText}

# ターゲット視聴者
${params.targetAudience || "一般視聴者"}

# 出力形式
以下のJSON形式で出力してください：
{
  "title": "動画タイトル",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "シーンタイトル",
      "script": "ナレーション原稿",
      "slides": [
        {
          "slideNumber": 1,
          "content": "スライドの内容（箇条書きまたは短文）",
          "design": {
            "backgroundColor": "#色コード",
            "textColor": "#色コード",
            "fontSize": "large/medium/small",
            "layout": "center/left/right"
          }
        }
      ]
    }
  ]
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "あなたは動画制作の専門家です。" },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "video_structure",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            scenes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sceneNumber: { type: "integer" },
                  title: { type: "string" },
                  script: { type: "string" },
                  slides: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        slideNumber: { type: "integer" },
                        content: { type: "string" },
                        design: {
                          type: "object",
                          properties: {
                            backgroundColor: { type: "string" },
                            textColor: { type: "string" },
                            fontSize: { type: "string" },
                            layout: { type: "string" },
                          },
                          required: ["backgroundColor", "textColor", "fontSize", "layout"],
                          additionalProperties: false,
                        },
                      },
                      required: ["slideNumber", "content", "design"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["sceneNumber", "title", "script", "slides"],
                additionalProperties: false,
              },
            },
          },
          required: ["title", "scenes"],
          additionalProperties: false,
        },
      },
    },
  });

  const messageContent = response.choices[0].message.content;
  const structure = JSON.parse(typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent));
  console.log("[Video Generator] Generated structure:", structure);

  // Save generated structure to RAG
  try {
    await saveToRAGWithTags({
      content: `テーマ: ${params.theme}\n\n動画構成:\n${JSON.stringify(structure, null, 2)}`,
      type: '構成パターン',
      sourceId: params.theme,
      tags: {
        genre: ['動画'],
        contentType: ['構成パターン'],
        theme: [],
        author: [],
      },
    });
    console.log("[Video Generator] Saved structure to RAG");
  } catch (error) {
    console.error("[Video Generator] Failed to save to RAG:", error);
  }

  return structure;
}

/**
 * Generate slide image from content and design
 */
export async function generateSlideImage(params: {
  content: string;
  design: {
    backgroundColor: string;
    textColor: string;
    fontSize: string;
    layout: string;
  };
  userId: number;
  projectId: number;
  sceneNumber: number;
  slideNumber: number;
}): Promise<string> {
  console.log("[Video Generator] Generating slide image...");

  const { content, design } = params;

  // Generate HTML for slide
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: 1920px;
      height: 1080px;
      background-color: ${design.backgroundColor};
      color: ${design.textColor};
      font-family: 'Noto Sans JP', sans-serif;
      display: flex;
      align-items: center;
      justify-content: ${design.layout === "center" ? "center" : design.layout === "left" ? "flex-start" : "flex-end"};
      padding: 80px;
    }
    .content {
      font-size: ${design.fontSize === "large" ? "72px" : design.fontSize === "medium" ? "48px" : "36px"};
      line-height: 1.6;
      text-align: ${design.layout === "center" ? "center" : design.layout === "left" ? "left" : "right"};
      max-width: 1600px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="content">${content}</div>
</body>
</html>
  `;

  // Render HTML to PNG using Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const screenshot = await page.screenshot({ type: "png" });
    await browser.close();

    // Upload to S3
    const filename = `slide_${params.projectId}_${params.sceneNumber}_${params.slideNumber}.png`;
    const fileKey = `video-slides/${params.userId}/${params.projectId}/${filename}`;
    const { url } = await storagePut(fileKey, screenshot, "image/png");

    console.log("[Video Generator] Slide image generated:", url);
    return url;
  } catch (error) {
    await browser.close();
    throw error;
  }
}

/**
 * Generate audio from script using TTS (placeholder - will use Whisper API in future)
 */
export async function generateAudioFromScript(params: {
  script: string;
  userId: number;
  projectId: number;
  sceneNumber: number;
}): Promise<{ url: string; duration: number }> {
  console.log("[Video Generator] Generating audio from script...");

  // TODO: Implement TTS using Whisper API or other TTS service
  // For now, return a placeholder

  // Estimate duration based on script length (rough estimate: 150 words per minute)
  const wordCount = params.script.split(/\s+/).length;
  const duration = Math.ceil((wordCount / 150) * 60); // seconds

  console.log("[Video Generator] Audio generation placeholder (duration:", duration, "seconds)");

  return {
    url: "", // Placeholder - will be implemented with TTS
    duration,
  };
}

/**
 * Combine slides and audio into video using ffmpeg (placeholder)
 */
export async function combineIntoVideo(params: {
  projectId: number;
  userId: number;
  scenes: Array<{
    audioUrl: string;
    duration: number;
    slides: Array<{ imageUrl: string }>;
  }>;
}): Promise<string> {
  console.log("[Video Generator] Combining slides and audio into video...");

  // TODO: Implement video generation using ffmpeg
  // For now, return a placeholder

  const videoUrl = ""; // Placeholder - will be implemented with ffmpeg

  console.log("[Video Generator] Video generation placeholder");

  return videoUrl;
}
