/**
 * Ollamaを使用したLLM実装
 * ローカル開発環境で使用するオープンソースのLLM
 */

import type { InvokeParams, InvokeResult, Message, Role } from "./llm";

const OLLAMA_HOST = process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";
// Visionモデルが利用できない場合は、通常モデルでテキストのみ処理
// ユーザーはOLLAMA_VISION_MODEL環境変数で指定可能
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || "llava:13b";

/**
 * メッセージに画像コンテンツが含まれているかチェック
 */
function hasImageContent(messages: Message[]): boolean {
  return messages.some((msg) => {
    if (Array.isArray(msg.content)) {
      return msg.content.some((c) => 
        typeof c === "object" && c.type === "image_url"
      );
    }
    return typeof msg.content === "object" && msg.content.type === "image_url";
  });
}

/**
 * 画像URLをbase64に変換（ローカルファイルの場合）
 */
async function convertImageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    // URLがローカルファイルパスの場合
    if (imageUrl.startsWith("/uploads/") || imageUrl.startsWith("uploads/")) {
      const fs = await import("fs/promises");
      const path = await import("path");
      const filePath = path.join(process.cwd(), imageUrl.replace(/^\/uploads\//, "uploads/"));
      const buffer = await fs.readFile(filePath);
      return buffer.toString("base64");
    }
    
    // HTTP/HTTPS URLの場合、画像をダウンロード
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer).toString("base64");
    }
    
    // 既にbase64の場合
    if (imageUrl.startsWith("data:image")) {
      return imageUrl.split(",")[1] || imageUrl;
    }
    
    return imageUrl;
  } catch (error) {
    console.error("[Ollama] Failed to convert image URL to base64:", error);
    throw error;
  }
}

/**
 * Ollamaのメッセージ形式に変換（画像対応）
 * OllamaのVision APIは、画像をbase64文字列の配列として`images`フィールドに送信する必要があります
 */
async function convertToOllamaMessages(messages: Message[]): Promise<Array<{ role: Role; content: string; images?: string[] }>> {
  const hasImages = hasImageContent(messages);
  
  return Promise.all(messages.map(async (msg) => {
    // コンテンツが配列の場合
    if (Array.isArray(msg.content)) {
      const textParts: string[] = [];
      const imageBase64s: string[] = [];
      
      for (const part of msg.content) {
        if (typeof part === "string") {
          textParts.push(part);
        } else if (part.type === "text") {
          textParts.push(part.text);
        } else if (part.type === "image_url") {
          const base64Image = await convertImageUrlToBase64(part.image_url.url);
          imageBase64s.push(base64Image);
        }
      }
      
      const result: { role: Role; content: string; images?: string[] } = {
        role: msg.role,
        content: textParts.join(" "),
      };
      
      if (imageBase64s.length > 0) {
        result.images = imageBase64s;
      }
      
      return result;
    }
    
    // コンテンツが文字列の場合
    if (typeof msg.content === "string") {
      return { role: msg.role, content: msg.content };
    }
    
    // コンテンツがオブジェクトの場合
    if (typeof msg.content === "object") {
      if (msg.content.type === "text") {
        return { role: msg.role, content: msg.content.text };
      }
      if (msg.content.type === "image_url") {
        const base64Image = await convertImageUrlToBase64(msg.content.image_url.url);
        return { 
          role: msg.role, 
          content: "", 
          images: [base64Image] 
        };
      }
    }
    
    return { role: msg.role, content: JSON.stringify(msg.content) };
  }));
}

/**
 * Ollamaを使用してLLMを呼び出す
 */
export async function invokeOllama(params: InvokeParams): Promise<InvokeResult> {
  const { messages, maxTokens, max_tokens, response_format } = params;
  
  const hasImages = hasImageContent(messages);
  
  // Visionモデルが利用できない場合のフォールバック処理
  // 画像があるがVisionモデルが通常モデルの場合、警告を出してテキストのみ処理
  let model = hasImages ? OLLAMA_VISION_MODEL : OLLAMA_MODEL;
  const isVisionModel = hasImages && OLLAMA_VISION_MODEL !== OLLAMA_MODEL;
  
  if (hasImages && !isVisionModel) {
    console.warn(`[Ollama] Vision model not available, using text-only model: ${model}`);
    console.warn(`[Ollama] Image content will be ignored. Please install a vision model or update Ollama.`);
  } else {
    console.log(`[Ollama] Using model: ${model} (hasImages: ${hasImages})`);
  }
  
  // JSON形式が要求されている場合、最後のメッセージにJSON形式を要求するプロンプトを追加
  let ollamaMessages = await convertToOllamaMessages(messages);
  if (response_format?.type === "json_schema" && response_format?.json_schema) {
    const schema = response_format.json_schema.schema;
    const jsonPrompt = `\n\n重要: 以下のJSONスキーマに従ってデータを生成し、JSONのみを返してください（スキーマ定義自体は返さないでください）:\n${JSON.stringify(schema, null, 2)}`;
    
    // 最後のメッセージにJSON形式の要求を追加
    if (ollamaMessages.length > 0) {
      const lastMessage = ollamaMessages[ollamaMessages.length - 1];
      if (typeof lastMessage.content === "string") {
        lastMessage.content = lastMessage.content + jsonPrompt;
      }
    }
  }
  
  const requestBody: any = {
    model,
    messages: ollamaMessages,
    options: {
      num_predict: maxTokens || max_tokens || 4096,
      temperature: 0.7,
    },
    stream: false,
  };

  if (response_format?.type === "json_schema" || response_format?.type === "json_object") {
    requestBody.format = "json";
  }

  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Ollama API error: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const data = await response.json();
  
  let content = data.message.content || "";
  
  // JSON形式が要求されている場合、Markdownコードブロックを削除
  if (response_format?.type === "json_schema" || response_format?.type === "json_object") {
    content = content.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  // OllamaのレスポンスをInvokeResult形式に変換
  return {
    id: `ollama-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: data.message.role || "assistant",
          content,
        },
        finish_reason: data.done ? "stop" : null,
      },
    ],
    usage: data.eval_count
      ? {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        }
      : undefined,
  };
}

/**
 * Ollamaが利用可能かチェック
 */
export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}


