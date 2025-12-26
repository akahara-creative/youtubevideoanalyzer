import type { InvokeParams, InvokeResult, Message, Role } from "./llm";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620";

/**
 * Convert internal message format to Anthropic message format
 */
function convertToAnthropicMessages(messages: Message[]): { system: string, messages: any[] } {
  let system = "";
  const anthropicMessages: any[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      const content = typeof msg.content === "string" ? msg.content : 
                      Array.isArray(msg.content) ? msg.content.map(c => typeof c === "string" ? c : c.type === "text" ? c.text : "").join("") : 
                      JSON.stringify(msg.content);
      system += content + "\n\n";
    } else {
      // Anthropic supports user and assistant roles
      // Map 'tool' or 'function' roles if necessary, but for now assuming standard chat
      const role = msg.role === "assistant" ? "assistant" : "user";
      
      let content: any = msg.content;
      
      // Handle image content if present (Anthropic format)
      if (Array.isArray(msg.content)) {
        content = msg.content.map(part => {
          if (typeof part === "string") return { type: "text", text: part };
          if (part.type === "text") return { type: "text", text: part.text };
          if (part.type === "image_url") {
            // Extract base64 if present
            const url = part.image_url.url;
            if (url.startsWith("data:")) {
              const match = url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                return {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: match[1],
                    data: match[2]
                  }
                };
              }
            }
            // If URL is not base64, Anthropic might not support it directly in this way without downloading
            // For now, fallback to text or skip
            return { type: "text", text: "[Image]" };
          }
          return { type: "text", text: JSON.stringify(part) };
        });
      }
      
      anthropicMessages.push({
        role,
        content
      });
    }
  }

  return { system, messages: anthropicMessages };
}

export async function invokeAnthropic(params: InvokeParams): Promise<InvokeResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const { messages, maxTokens, max_tokens, response_format } = params;
  const { system, messages: anthropicMessages } = convertToAnthropicMessages(messages);

  let finalSystem = system;

  // Handle JSON response format via system prompt
  if (response_format?.type === "json_schema") {
    const schema = response_format.json_schema.schema;
    finalSystem += `\n\nIMPORTANT: You must output valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\n\nOutput ONLY the JSON. Do not include any markdown formatting or explanations.`;
  } else if (response_format?.type === "json_object") {
    finalSystem += `\n\nIMPORTANT: You must output valid JSON. Output ONLY the JSON. Do not include any markdown formatting or explanations.`;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens || max_tokens || 4096,
      system: finalSystem,
      messages: anthropicMessages,
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  let content = "";
  if (data.content && data.content.length > 0) {
    content = data.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  }

  // JSON形式が要求されている場合、Markdownコードブロックを削除
  if (response_format?.type === "json_schema" || response_format?.type === "json_object") {
    content = content.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  return {
    id: data.id,
    created: Math.floor(Date.now() / 1000),
    model: data.model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: content
      },
      finish_reason: data.stop_reason === "end_turn" ? "stop" : data.stop_reason
    }],
    usage: {
      prompt_tokens: data.usage.input_tokens,
      completion_tokens: data.usage.output_tokens,
      total_tokens: data.usage.input_tokens + data.usage.output_tokens
    }
  };
}

export async function checkAnthropicAvailable(): Promise<boolean> {
  return !!ANTHROPIC_API_KEY;
}
