import { invokeLLM } from "./_core/llm";
import { getContentImportsByUser } from "./db";

/**
 * Writing style analysis result
 */
export interface WritingStyle {
  tone: string; // e.g., "フォーマル", "カジュアル", "親しみやすい"
  vocabulary: string[]; // Frequently used words/phrases
  sentenceStructure: string; // e.g., "短文が多い", "長文が多い", "混在"
  punctuation: string; // e.g., "句読点が多い", "感嘆符が多い"
  perspective: string; // e.g., "一人称", "二人称", "三人称"
  characteristics: string[]; // Unique characteristics
  styleGuide: string; // Comprehensive style guide for content generation
}

/**
 * Analyze writing style from RAG content
 * @param userId User ID to fetch content from
 * @returns Writing style analysis result
 */
export async function analyzeWritingStyle(userId: number): Promise<WritingStyle> {
  try {
    // Fetch user's imported content
    const imports = await getContentImportsByUser(userId);

    if (imports.length === 0) {
      throw new Error("No content found for analysis");
    }

    // Combine all extracted text (limit to first 50,000 characters to avoid token limits)
    const combinedText = imports
      .map((imp: any) => imp.extractedText)
      .join("\n\n")
      .substring(0, 50000);

    // Analyze writing style using LLM
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a professional writing style analyst. Analyze the provided text and extract detailed writing style characteristics.",
        },
        {
          role: "user",
          content: `Analyze the following text and extract the writing style characteristics. Focus on tone, vocabulary, sentence structure, punctuation, perspective, and unique characteristics. Provide a comprehensive style guide that can be used to generate content in the same style.\n\nText:\n${combinedText}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "writing_style_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tone: {
                type: "string",
                description: "Overall tone of the writing (e.g., formal, casual, friendly)",
              },
              vocabulary: {
                type: "array",
                items: { type: "string" },
                description: "Frequently used words and phrases",
              },
              sentenceStructure: {
                type: "string",
                description: "Sentence structure pattern (e.g., short sentences, long sentences, mixed)",
              },
              punctuation: {
                type: "string",
                description: "Punctuation usage pattern (e.g., frequent commas, exclamation marks)",
              },
              perspective: {
                type: "string",
                description: "Narrative perspective (e.g., first person, second person, third person)",
              },
              characteristics: {
                type: "array",
                items: { type: "string" },
                description: "Unique writing characteristics",
              },
              styleGuide: {
                type: "string",
                description: "Comprehensive style guide for content generation",
              },
            },
            required: [
              "tone",
              "vocabulary",
              "sentenceStructure",
              "punctuation",
              "perspective",
              "characteristics",
              "styleGuide",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in LLM response");
    }

    const contentText = typeof content === 'string' ? content : JSON.stringify(content);
    const parsed = JSON.parse(contentText);
    return {
      tone: parsed.tone || "不明",
      vocabulary: parsed.vocabulary || [],
      sentenceStructure: parsed.sentenceStructure || "不明",
      punctuation: parsed.punctuation || "不明",
      perspective: parsed.perspective || "不明",
      characteristics: parsed.characteristics || [],
      styleGuide: parsed.styleGuide || "スタイルガイドを生成できませんでした。",
    };
  } catch (error) {
    console.error("[StyleAnalyzer] Error analyzing writing style:", error);
    throw new Error(`Failed to analyze writing style: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate content with specific writing style
 * @param prompt Content generation prompt
 * @param style Writing style to apply
 * @param contentType Type of content (email, blog, script, etc.)
 * @returns Generated content
 */
export async function generateWithStyle(
  prompt: string,
  style: WritingStyle,
  contentType: string = "general"
): Promise<string> {
  try {
    const styleInstructions = `
あなたは以下の執筆スタイルに従ってコンテンツを生成してください：

**トーン**: ${style.tone}
**文体**: ${style.sentenceStructure}
**句読点**: ${style.punctuation}
**視点**: ${style.perspective}

**よく使う語彙**:
${style.vocabulary.slice(0, 20).join(", ")}

**特徴**:
${style.characteristics.join("\n")}

**スタイルガイド**:
${style.styleGuide}

上記のスタイルを厳密に守り、読者にとって違和感のないコンテンツを生成してください。
`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: styleInstructions,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return "";
    }
    return typeof content === 'string' ? content : JSON.stringify(content);
  } catch (error) {
    console.error("[StyleAnalyzer] Error generating content with style:", error);
    throw new Error(`Failed to generate content with style: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Compare two writing styles
 * @param style1 First writing style
 * @param style2 Second writing style
 * @returns Comparison result
 */
export function compareStyles(style1: WritingStyle, style2: WritingStyle): {
  similarities: string[];
  differences: string[];
} {
  const similarities: string[] = [];
  const differences: string[] = [];

  // Compare tone
  if (style1.tone === style2.tone) {
    similarities.push(`トーンが同じ: ${style1.tone}`);
  } else {
    differences.push(`トーンが異なる: ${style1.tone} vs ${style2.tone}`);
  }

  // Compare sentence structure
  if (style1.sentenceStructure === style2.sentenceStructure) {
    similarities.push(`文体が同じ: ${style1.sentenceStructure}`);
  } else {
    differences.push(`文体が異なる: ${style1.sentenceStructure} vs ${style2.sentenceStructure}`);
  }

  // Compare perspective
  if (style1.perspective === style2.perspective) {
    similarities.push(`視点が同じ: ${style1.perspective}`);
  } else {
    differences.push(`視点が異なる: ${style1.perspective} vs ${style2.perspective}`);
  }

  // Compare vocabulary overlap
  const vocab1Set = new Set(style1.vocabulary);
  const vocab2Set = new Set(style2.vocabulary);
  const commonVocab = style1.vocabulary.filter((word) => vocab2Set.has(word));
  
  if (commonVocab.length > 0) {
    similarities.push(`共通の語彙: ${commonVocab.slice(0, 5).join(", ")}`);
  }

  return { similarities, differences };
}
