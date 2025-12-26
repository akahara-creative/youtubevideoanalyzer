import googleTrends from "google-trends-api";

/**
 * Keyword research result
 */
export interface KeywordResearchResult {
  keyword: string;
  relatedQueries: string[];
  trendData: {
    date: string;
    value: number;
  }[];
  averageInterest: number;
}

/**
 * Get related keywords from Google Trends
 * @param keyword Main keyword to research
 * @param geo Geographic location (default: "JP" for Japan)
 * @returns Related keywords and trend data
 */
export async function getRelatedKeywords(
  keyword: string,
  geo: string = "JP"
): Promise<KeywordResearchResult> {
  try {
    // Get related queries
    const relatedQueriesData = await googleTrends.relatedQueries({
      keyword,
      geo,
      hl: "ja",
    });

    const relatedQueriesJson = JSON.parse(relatedQueriesData);
    const relatedQueries: string[] = [];

    // Extract top related queries
    if (relatedQueriesJson.default?.rankedList?.[0]?.rankedKeyword) {
      const topQueries = relatedQueriesJson.default.rankedList[0].rankedKeyword;
      for (const item of topQueries.slice(0, 10)) {
        if (item.query) {
          relatedQueries.push(item.query);
        }
      }
    }

    // Get interest over time
    const interestOverTimeData = await googleTrends.interestOverTime({
      keyword,
      geo,
      hl: "ja",
    });

    const interestOverTimeJson = JSON.parse(interestOverTimeData);
    const trendData: { date: string; value: number }[] = [];
    let totalInterest = 0;

    if (interestOverTimeJson.default?.timelineData) {
      for (const item of interestOverTimeJson.default.timelineData) {
        const value = item.value?.[0] || 0;
        trendData.push({
          date: item.formattedTime,
          value,
        });
        totalInterest += value;
      }
    }

    const averageInterest =
      trendData.length > 0 ? totalInterest / trendData.length : 0;

    return {
      keyword,
      relatedQueries,
      trendData,
      averageInterest,
    };
  } catch (error) {
    console.error("[KeywordResearch] Error:", error);
    throw new Error(`Failed to fetch keyword data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get multiple keyword research results in parallel
 * @param keywords Array of keywords to research
 * @param geo Geographic location (default: "JP" for Japan)
 * @returns Array of keyword research results
 */
export async function getMultipleKeywords(
  keywords: string[],
  geo: string = "JP"
): Promise<KeywordResearchResult[]> {
  const results = await Promise.allSettled(
    keywords.map((keyword) => getRelatedKeywords(keyword, geo))
  );

  return results
    .filter((result): result is PromiseFulfilledResult<KeywordResearchResult> => result.status === "fulfilled")
    .map((result) => result.value);
}

/**
 * Compare multiple keywords and rank by interest
 * @param keywords Array of keywords to compare
 * @param geo Geographic location (default: "JP" for Japan)
 * @returns Ranked keywords by average interest
 */
export async function compareKeywords(
  keywords: string[],
  geo: string = "JP"
): Promise<{ keyword: string; averageInterest: number; rank: number }[]> {
  const results = await getMultipleKeywords(keywords, geo);

  const ranked = results
    .map((result) => ({
      keyword: result.keyword,
      averageInterest: result.averageInterest,
      rank: 0,
    }))
    .sort((a, b) => b.averageInterest - a.averageInterest)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  return ranked;
}
