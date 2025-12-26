import { invokeLLM } from "./_core/llm";

/**
 * SEO analysis result for a single article
 */
export interface ArticleAnalysis {
  url: string;
  title: string;
  wordCount: number;
  keywordFrequency: { [keyword: string]: number };
  headings: string[];
  metaDescription?: string;
}

/**
 * SEO analysis summary
 */
export interface SEOAnalysisSummary {
  keyword: string;
  topArticles: ArticleAnalysis[];
  averageWordCount: number;
  recommendedKeywordFrequency: { [keyword: string]: number };
  insights: string;
}

/**
 * Search for top articles using LLM with web search
 * @param keyword Target keyword
 * @param limit Number of articles to analyze (default: 10)
 * @returns Array of article URLs
 */
async function searchTopArticles(keyword: string, limit: number = 10): Promise<string[]> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an SEO research assistant. Your task is to find top-ranking articles for a given keyword.",
        },
        {
          role: "user",
          content: `Find the top ${limit} articles ranking for the keyword "${keyword}" in Japanese. Return only the URLs, one per line, without any additional text or numbering.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "search_results",
          strict: true,
          schema: {
            type: "object",
            properties: {
              urls: {
                type: "array",
                items: { type: "string" },
                description: "Array of article URLs",
              },
            },
            required: ["urls"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in LLM response");
    }

    const parsed = JSON.parse(content);
    return parsed.urls || [];
  } catch (error) {
    console.error("[SEOAnalyzer] Error searching articles:", error);
    throw new Error(`Failed to search articles: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Analyze a single article's content
 * @param url Article URL
 * @param targetKeywords Keywords to track frequency
 * @returns Article analysis result
 */
async function analyzeArticle(url: string, targetKeywords: string[]): Promise<ArticleAnalysis> {
  try {
    // Use LLM to fetch and analyze the article
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an SEO content analyzer. Extract key information from web articles.",
        },
        {
          role: "user",
          content: `Analyze the article at ${url}. Extract the title, word count, keyword frequencies for [${targetKeywords.join(", ")}], headings (H1-H3), and meta description if available.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "article_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              wordCount: { type: "number" },
              keywordFrequency: {
                type: "object",
                additionalProperties: { type: "number" },
              },
              headings: {
                type: "array",
                items: { type: "string" },
              },
              metaDescription: { type: "string" },
            },
            required: ["title", "wordCount", "keywordFrequency", "headings"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in LLM response");
    }

    const parsed = JSON.parse(content);
    return {
      url,
      title: parsed.title || "Unknown",
      wordCount: parsed.wordCount || 0,
      keywordFrequency: parsed.keywordFrequency || {},
      headings: parsed.headings || [],
      metaDescription: parsed.metaDescription,
    };
  } catch (error) {
    console.error(`[SEOAnalyzer] Error analyzing article ${url}:`, error);
    // Return a placeholder result instead of throwing
    return {
      url,
      title: "Analysis failed",
      wordCount: 0,
      keywordFrequency: {},
      headings: [],
    };
  }
}

/**
 * Perform comprehensive SEO analysis for a keyword
 * @param keyword Target keyword
 * @param relatedKeywords Related keywords to track
 * @param limit Number of top articles to analyze (default: 10)
 * @returns SEO analysis summary
 */
export async function analyzeSEO(
  keyword: string,
  relatedKeywords: string[] = [],
  limit: number = 10
): Promise<SEOAnalysisSummary> {
  try {
    // Search for top articles
    const urls = await searchTopArticles(keyword, limit);

    if (urls.length === 0) {
      throw new Error("No articles found");
    }

    // Analyze each article
    const allKeywords = [keyword, ...relatedKeywords];
    const analyses = await Promise.all(
      urls.map((url) => analyzeArticle(url, allKeywords))
    );

    // Filter out failed analyses
    const validAnalyses = analyses.filter((a) => a.wordCount > 0);

    if (validAnalyses.length === 0) {
      throw new Error("All article analyses failed");
    }

    // Calculate average word count
    const totalWordCount = validAnalyses.reduce((sum, a) => sum + a.wordCount, 0);
    const averageWordCount = Math.round(totalWordCount / validAnalyses.length);

    // Calculate recommended keyword frequency
    const keywordFrequencySum: { [keyword: string]: number } = {};
    for (const analysis of validAnalyses) {
      for (const [kw, freq] of Object.entries(analysis.keywordFrequency)) {
        keywordFrequencySum[kw] = (keywordFrequencySum[kw] || 0) + freq;
      }
    }

    const recommendedKeywordFrequency: { [keyword: string]: number } = {};
    for (const [kw, sum] of Object.entries(keywordFrequencySum)) {
      recommendedKeywordFrequency[kw] = Math.round(sum / validAnalyses.length);
    }

    // Generate insights using LLM
    const insightsResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an SEO expert providing actionable insights based on competitor analysis.",
        },
        {
          role: "user",
          content: `Based on the analysis of ${validAnalyses.length} top-ranking articles for "${keyword}":
- Average word count: ${averageWordCount}
- Recommended keyword frequencies: ${JSON.stringify(recommendedKeywordFrequency)}

Provide 3-5 actionable SEO insights in Japanese to help rank higher for this keyword.`,
        },
      ],
    });

    const insights = insightsResponse.choices[0].message.content || "分析結果から具体的なインサイトを生成できませんでした。";

    return {
      keyword,
      topArticles: validAnalyses,
      averageWordCount,
      recommendedKeywordFrequency,
      insights,
    };
  } catch (error) {
    console.error("[SEOAnalyzer] Error in analyzeSEO:", error);
    throw new Error(`SEO analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Compare an article's keyword usage against recommended frequencies
 * @param content Article content
 * @param recommendedFrequencies Recommended keyword frequencies
 * @returns Comparison result with suggestions
 */
export async function compareKeywordUsage(
  content: string,
  recommendedFrequencies: { [keyword: string]: number }
): Promise<{ keyword: string; current: number; recommended: number; difference: number }[]> {
  const results: { keyword: string; current: number; recommended: number; difference: number }[] = [];

  for (const [keyword, recommended] of Object.entries(recommendedFrequencies)) {
    // Count keyword occurrences in content (case-insensitive)
    const regex = new RegExp(keyword, "gi");
    const matches = content.match(regex);
    const current = matches ? matches.length : 0;
    const difference = current - recommended;

    results.push({
      keyword,
      current,
      recommended,
      difference,
    });
  }

  return results.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
}
