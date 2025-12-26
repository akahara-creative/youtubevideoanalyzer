import { invokeLLM } from "./_core/llm";

/**
 * 競合分析エンジン
 * キーワードで上位1-10位の記事を検索し、全キーワードを抽出する
 */

export interface CompetitorArticle {
  url: string;
  title: string;
  rank: number;
  wordCount: number;
  keywords: Record<string, number>; // キーワード: 出現回数
  headings: string[]; // 見出し一覧
}

export interface CompetitorAnalysisResult {
  keyword: string;
  topArticles: CompetitorArticle[];
  allKeywords: Record<string, number>; // 全記事から抽出したキーワード: 合計出現回数
  coOccurringKeywords: string[]; // 共起語（頻出キーワード）
  relatedKeywords: string[]; // 関連キーワード
  expertVocabulary: string[]; // 専門性確立のための語彙
  averageWordCount: number;
  recommendedWordCount: number;
  contentStructure: {
    commonHeadings: string[]; // 共通の見出し
    recommendedSections: string[]; // 推奨セクション
  };
}

/**
 * キーワードで上位記事を検索してURLを取得
 */
async function searchTopArticles(keyword: string, count: number = 10): Promise<{ url: string; title: string; rank: number }[]> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたは検索エンジンのエキスパートです。指定されたキーワードで検索した場合の上位記事のURLとタイトルを返してください。
実際の検索結果に基づいて、信頼性の高い情報源（公式サイト、大手メディア、専門サイト）を優先してください。`,
      },
      {
        role: "user",
        content: `キーワード「${keyword}」で検索した場合の上位${count}件の記事のURLとタイトルを教えてください。
実際に存在する記事のURLを返してください。`,
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
            articles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: { type: "string", description: "記事のURL" },
                  title: { type: "string", description: "記事のタイトル" },
                  rank: { type: "integer", description: "検索順位（1-10）" },
                },
                required: ["url", "title", "rank"],
                additionalProperties: false,
              },
            },
          },
          required: ["articles"],
          additionalProperties: false,
        },
      },
    },
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return result.articles || [];
}

/**
 * 記事のコンテンツを取得してキーワードを抽出
 */
async function analyzeArticleContent(url: string, title: string, rank: number, targetKeyword: string): Promise<CompetitorArticle> {
  // 実際のブラウザ自動化でコンテンツを取得する代わりに、
  // LLMを使用して記事の構造とキーワードを推定
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたはSEOアナリストです。指定された記事のタイトルとURLから、記事の内容、キーワード、見出し構成を推定してください。
キーワード「${targetKeyword}」に関連する記事として、どのようなキーワードが含まれているか、どのような見出し構成になっているかを分析してください。`,
      },
      {
        role: "user",
        content: `記事タイトル: ${title}
URL: ${url}
ターゲットキーワード: ${targetKeyword}

この記事に含まれていると推定されるキーワードと見出し構成を分析してください。`,
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
            wordCount: { type: "integer", description: "推定文字数" },
            keywords: {
              type: "object",
              description: "キーワード: 出現回数のマップ",
              additionalProperties: { type: "integer" },
            },
            headings: {
              type: "array",
              items: { type: "string" },
              description: "見出し一覧",
            },
          },
          required: ["wordCount", "keywords", "headings"],
          additionalProperties: false,
        },
      },
    },
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return {
    url,
    title,
    rank,
    wordCount: result.wordCount || 3000,
    keywords: result.keywords || {},
    headings: result.headings || [],
  };
}

/**
 * 競合記事を分析して全キーワードを抽出
 */
export async function analyzeCompetitors(keyword: string, articleCount: number = 10): Promise<CompetitorAnalysisResult> {
  console.log(`[CompetitorAnalyzer] Analyzing competitors for keyword: ${keyword}`);

  // 1. 上位記事を検索
  const topArticles = await searchTopArticles(keyword, articleCount);
  console.log(`[CompetitorAnalyzer] Found ${topArticles.length} top articles`);

  // 2. 各記事を分析
  const analyzedArticles: CompetitorArticle[] = [];
  for (const article of topArticles) {
    try {
      const analyzed = await analyzeArticleContent(article.url, article.title, article.rank, keyword);
      analyzedArticles.push(analyzed);
      console.log(`[CompetitorAnalyzer] Analyzed article ${article.rank}: ${article.title}`);
    } catch (error) {
      console.error(`[CompetitorAnalyzer] Failed to analyze article ${article.rank}:`, error);
    }
  }

  // 3. 全キーワードを集計
  const allKeywords: Record<string, number> = {};
  for (const article of analyzedArticles) {
    for (const [kw, count] of Object.entries(article.keywords)) {
      allKeywords[kw] = (allKeywords[kw] || 0) + count;
    }
  }

  // 4. 共起語を抽出（出現回数が多いキーワード）
  const coOccurringKeywords = Object.entries(allKeywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([kw]) => kw);

  // 5. 関連キーワードを抽出（LLM使用）
  const relatedKeywordsResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "あなたはSEOキーワードアナリストです。指定されたキーワードに関連するキーワードを提案してください。",
      },
      {
        role: "user",
        content: `キーワード「${keyword}」に関連するキーワードを20個提案してください。
共起語: ${coOccurringKeywords.join(", ")}

これらの共起語を参考に、さらに関連性の高いキーワードを提案してください。`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "related_keywords",
        strict: true,
        schema: {
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: { type: "string" },
              description: "関連キーワード一覧",
            },
          },
          required: ["keywords"],
          additionalProperties: false,
        },
      },
    },
  });

  const relatedKeywordsResult = JSON.parse(relatedKeywordsResponse.choices[0].message.content || "{}");
  const relatedKeywords = relatedKeywordsResult.keywords || [];

  // 6. 専門性確立のための語彙を抽出
  const expertVocabularyResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "あなたはSEOコンテンツストラテジストです。指定されたキーワードの分野で専門家として認識されるために必要な語彙を提案してください。",
      },
      {
        role: "user",
        content: `キーワード「${keyword}」の分野で専門家として認識されるために、記事に含めるべき専門用語や重要な概念を20個提案してください。
共起語: ${coOccurringKeywords.join(", ")}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "expert_vocabulary",
        strict: true,
        schema: {
          type: "object",
          properties: {
            vocabulary: {
              type: "array",
              items: { type: "string" },
              description: "専門語彙一覧",
            },
          },
          required: ["vocabulary"],
          additionalProperties: false,
        },
      },
    },
  });

  const expertVocabularyResult = JSON.parse(expertVocabularyResponse.choices[0].message.content || "{}");
  const expertVocabulary = expertVocabularyResult.vocabulary || [];

  // 7. 平均文字数と推奨文字数を計算
  const averageWordCount = Math.round(
    analyzedArticles.reduce((sum, article) => sum + article.wordCount, 0) / analyzedArticles.length
  );
  const recommendedWordCount = Math.round(averageWordCount * 1.2); // 平均の120%を推奨

  // 8. 共通の見出しを抽出
  const headingCounts: Record<string, number> = {};
  for (const article of analyzedArticles) {
    for (const heading of article.headings) {
      headingCounts[heading] = (headingCounts[heading] || 0) + 1;
    }
  }

  const commonHeadings = Object.entries(headingCounts)
    .filter(([, count]) => count >= 3) // 3記事以上で使用されている見出し
    .sort((a, b) => b[1] - a[1])
    .map(([heading]) => heading);

  // 9. 推奨セクションを生成
  const recommendedSectionsResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "あなたはSEOコンテンツストラテジストです。指定されたキーワードの記事に含めるべきセクション（見出し）を提案してください。",
      },
      {
        role: "user",
        content: `キーワード「${keyword}」の記事に含めるべきセクション（見出し）を10個提案してください。
共通の見出し: ${commonHeadings.join(", ")}

これらの共通見出しを参考に、読者にとって価値のあるセクションを提案してください。`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "recommended_sections",
        strict: true,
        schema: {
          type: "object",
          properties: {
            sections: {
              type: "array",
              items: { type: "string" },
              description: "推奨セクション一覧",
            },
          },
          required: ["sections"],
          additionalProperties: false,
        },
      },
    },
  });

  const recommendedSectionsResult = JSON.parse(recommendedSectionsResponse.choices[0].message.content || "{}");
  const recommendedSections = recommendedSectionsResult.sections || [];

  return {
    keyword,
    topArticles: analyzedArticles,
    allKeywords,
    coOccurringKeywords,
    relatedKeywords,
    expertVocabulary,
    averageWordCount,
    recommendedWordCount,
    contentStructure: {
      commonHeadings,
      recommendedSections,
    },
  };
}
