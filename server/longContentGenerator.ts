import { invokeLLM } from "./_core/llm";
import {
  createContentChunk,
  getContentChunksByLongContentId,
  getLongContentById,
  updateContentChunk,
  updateLongContent,
} from "./db";
import { addToRAG } from "./rag";

/**
 * Generate long-form content in chunks
 * @param contentId The ID of the long content record
 * @param onProgress Callback function to report progress
 */
export async function generateLongContent(
  contentId: number,
  onProgress?: (progress: {
    chunkIndex: number;
    totalChunks: number;
    content: string;
    status: "generating" | "completed";
  }) => void
): Promise<void> {
  try {
    // Get the content record
    const content = await getLongContentById(contentId);
    if (!content) {
      throw new Error("Content not found");
    }

    // Update status to generating
    await updateLongContent(contentId, { status: "generating" });

    // Analyze writing style if useRAGStyle is enabled
    let writingStyle: any = null;
    if (content.useRAGStyle === 1) {
      try {
        const { analyzeWritingStyle } = await import("./styleAnalyzer");
        writingStyle = await analyzeWritingStyle(content.userId);
      } catch (error) {
        console.error("[LongContentGenerator] Failed to analyze writing style:", error);
        // Continue without style analysis
      }
    }

    // Calculate number of chunks needed
    const targetWordCount = content.targetWordCount || 20000;
    const wordsPerChunk = 5000; // Generate 5000 words per chunk
    const totalChunks = Math.ceil(targetWordCount / wordsPerChunk);

    let fullContent = "";
    let previousContext = "";

    // Generate each chunk
    for (let i = 0; i < totalChunks; i++) {
      const isFirstChunk = i === 0;
      const isLastChunk = i === totalChunks - 1;

      // Create chunk record
      const chunkId = await createContentChunk({
        longContentId: contentId,
        chunkIndex: i,
        content: "",
        wordCount: 0,
        status: "generating",
      });

      // Build prompt for this chunk
      const chunkPrompt = buildChunkPrompt({
        originalPrompt: content.prompt,
        title: content.title,
        contentType: content.contentType,
        tone: content.tone || undefined,
        keywords: content.keywords ? JSON.parse(content.keywords) : undefined,
        chunkIndex: i,
        totalChunks,
        previousContext,
        targetWords: isLastChunk
          ? targetWordCount - i * wordsPerChunk
          : wordsPerChunk,
      });

      // Generate chunk content
      const systemPrompt = writingStyle
        ? `You are a professional content writer. Generate high-quality, engaging content based on the user's requirements.

**執筆スタイルガイド**:
トーン: ${writingStyle.tone}
文体: ${writingStyle.sentenceStructure}
句読点: ${writingStyle.punctuation}
視点: ${writingStyle.perspective}

よく使う語彙: ${writingStyle.vocabulary.slice(0, 20).join(", ")}

特徴:
${writingStyle.characteristics.join("\n")}

${writingStyle.styleGuide}

上記のスタイルを厳密に守ってコンテンツを生成してください。`
        : `You are a professional content writer. Generate high-quality, engaging content based on the user's requirements.`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: chunkPrompt,
          },
        ],
      });

      const chunkContent = typeof response.choices[0].message.content === "string" 
        ? response.choices[0].message.content 
        : "";
      const chunkWordCount = chunkContent.split(/\s+/).length;

      // Update chunk record
      await updateContentChunk(chunkId, {
        content: chunkContent,
        wordCount: chunkWordCount,
        status: "completed",
      });

      // Accumulate content
      fullContent += (fullContent ? "\n\n" : "") + chunkContent;
      previousContext = chunkContent.slice(-1000); // Keep last 1000 chars as context

      // Report progress
      if (onProgress) {
        onProgress({
          chunkIndex: i,
          totalChunks,
          content: chunkContent,
          status: "generating",
        });
      }
    }

    // Calculate final word count
    const actualWordCount = fullContent.split(/\s+/).length;

    // Count keyword occurrences
    const keywordCounts = content.keywords
      ? countKeywords(fullContent, JSON.parse(content.keywords))
      : {};

    // Update content record with full content
    await updateLongContent(contentId, {
      content: fullContent,
      actualWordCount,
      status: "completed",
      completedAt: new Date(),
      metadata: JSON.stringify({ keywordCounts }),
    });

    // Add to RAG
    const ragId = `longcontent_${contentId}`;
    await addToRAG({
      id: ragId,
      text: fullContent,
      metadata: {
        type: "mailmag", // Using mailmag type for now
        title: content.title,
        createdAt: new Date().toISOString(),
        contentType: content.contentType,
        wordCount: actualWordCount,
      },
    });

    await updateLongContent(contentId, { ragId });

    // Final progress report
    if (onProgress) {
      onProgress({
        chunkIndex: totalChunks - 1,
        totalChunks,
        content: fullContent,
        status: "completed",
      });
    }
  } catch (error) {
    console.error("[LongContentGenerator] Error:", error);
    await updateLongContent(contentId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Build prompt for a specific chunk
 */
function buildChunkPrompt(params: {
  originalPrompt: string;
  title: string;
  contentType: string;
  tone?: string;
  keywords?: string[];
  chunkIndex: number;
  totalChunks: number;
  previousContext: string;
  targetWords: number;
}): string {
  const {
    originalPrompt,
    title,
    contentType,
    tone,
    keywords,
    chunkIndex,
    totalChunks,
    previousContext,
    targetWords,
  } = params;

  const isFirstChunk = chunkIndex === 0;
  const isLastChunk = chunkIndex === totalChunks - 1;

  let prompt = `# Task: Generate ${contentType} content\n\n`;
  prompt += `## Title: ${title}\n\n`;
  prompt += `## Requirements:\n`;
  prompt += `- Target word count: approximately ${targetWords} words\n`;
  if (tone) prompt += `- Tone: ${tone}\n`;
  if (keywords && keywords.length > 0) {
    prompt += `- Keywords to include: ${keywords.join(", ")}\n`;
  }
  prompt += `\n## Original Prompt:\n${originalPrompt}\n\n`;

  if (isFirstChunk) {
    prompt += `## Instructions:\n`;
    prompt += `This is the FIRST part of a ${totalChunks}-part ${contentType}. `;
    prompt += `Start with an engaging introduction that hooks the reader. `;
    prompt += `Set the context and outline what will be covered.\n\n`;
  } else if (isLastChunk) {
    prompt += `## Previous Context:\n${previousContext}\n\n`;
    prompt += `## Instructions:\n`;
    prompt += `This is the FINAL part (${chunkIndex + 1}/${totalChunks}) of the ${contentType}. `;
    prompt += `Provide a strong conclusion that summarizes key points and leaves a lasting impression. `;
    prompt += `Make sure the content flows naturally from the previous section.\n\n`;
  } else {
    prompt += `## Previous Context:\n${previousContext}\n\n`;
    prompt += `## Instructions:\n`;
    prompt += `This is part ${chunkIndex + 1} of ${totalChunks} of the ${contentType}. `;
    prompt += `Continue the content naturally from where the previous section ended. `;
    prompt += `Develop the main ideas with detailed explanations, examples, and insights.\n\n`;
  }

  prompt += `Generate the content now. Write naturally and engagingly. Do NOT include meta-commentary like "Here is part X" or "To be continued".`;

  return prompt;
}

/**
 * Count keyword occurrences in content
 */
function countKeywords(content: string, keywords: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const lowerContent = content.toLowerCase();

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    // Count occurrences (case-insensitive)
    const regex = new RegExp(lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = lowerContent.match(regex);
    counts[keyword] = matches ? matches.length : 0;
  }

  return counts;
}
