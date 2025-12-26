import { invokeLLM } from "./_core/llm";
import { analyzeCompetitors, CompetitorAnalysisResult } from "./competitorAnalyzer";

export interface KeywordWithAnalysis {
  id: number;
  keyword: string;
  searchVolume: number | null;
  competition: string | null;
  targetCount: number | null;
  seoAnalysisData: any;
}

export interface StrategyRecommendation {
  prioritizedKeywords: Array<{
    keyword: string;
    priority: "high" | "medium" | "low";
    reason: string;
    estimatedDifficulty: string;
    suggestedContentLength: number;
    suggestedArticleTitles: string[];
    competitorData?: {
      averageWordCount: number;
      recommendedWordCount: number;
      coOccurringKeywords: string[];
      relatedKeywords: string[];
      expertVocabulary: string[];
      recommendedSections: string[];
    };
  }>;
  contentPlan: {
    phase1: string[];
    phase2: string[];
    phase3: string[];
  };
  overallStrategy: string;
  estimatedTimeline: string;
  competitorInsights: string;
}

/**
 * ブログ成長戦略を提案する（競合分析を含む）
 */
export async function generateBlogStrategy(
  projectName: string,
  projectDescription: string | null,
  keywords: KeywordWithAnalysis[],
  enableCompetitorAnalysis: boolean = true
): Promise<StrategyRecommendation> {
  // 競合分析を実行
  const competitorAnalysisResults: Map<string, CompetitorAnalysisResult> = new Map();
  
  if (enableCompetitorAnalysis) {
    console.log("[BlogStrategyAdvisor] Starting competitor analysis for", keywords.length, "keywords");
    for (const kw of keywords) {
      try {
        const analysis = await analyzeCompetitors(kw.keyword, 10);
        competitorAnalysisResults.set(kw.keyword, analysis);
        console.log(`[BlogStrategyAdvisor] Completed competitor analysis for: ${kw.keyword}`);
      } catch (error) {
        console.error(`[BlogStrategyAdvisor] Failed to analyze competitors for ${kw.keyword}:`, error);
      }
    }
  }
  // キーワード情報を整形（競合分析結果を含む）
  const keywordSummary = keywords
    .map((kw) => {
      const analysis = kw.seoAnalysisData
        ? JSON.parse(kw.seoAnalysisData as any)
        : null;
      const competitorData = competitorAnalysisResults.get(kw.keyword);
      
      let summary = `- ${kw.keyword}
  検索ボリューム: ${kw.searchVolume || "不明"}
  競合性: ${kw.competition || "不明"}
  推奨出現回数: ${kw.targetCount || "不明"}
  平均文字数: ${analysis?.averageWordCount || "不明"}
  インサイト: ${analysis?.insights || "なし"}`;
      
      if (competitorData) {
        summary += `
  
  **競合分析結果:**
  - 上位記事の平均文字数: ${competitorData.averageWordCount}文字
  - 推奨文字数: ${competitorData.recommendedWordCount}文字
  - 共起語（頑出キーワード）: ${competitorData.coOccurringKeywords.slice(0, 10).join(", ")}
  - 関連キーワード: ${competitorData.relatedKeywords.slice(0, 10).join(", ")}
  - 専門語彙: ${competitorData.expertVocabulary.slice(0, 10).join(", ")}
  - 推奨セクション: ${competitorData.contentStructure.recommendedSections.slice(0, 5).join(", ")}`;
      }
      
      return summary;
    })
    .join("\n\n");

  const prompt = `あなたはSEOとコンテンツマーケティングの専門家です。以下のブログプロジェクトの成長戦略を提案してください。

## プロジェクト情報
プロジェクト名: ${projectName}
説明: ${projectDescription || "なし"}

## 登録キーワード一覧
${keywordSummary}

## 重要な注意事項
上記のキーワード情報には、**実際の競合記事を分析した結果**が含まれています。
「競合分析結果」セクションのデータ（平均文字数、共起語、関連キーワード、専門語彙、推奨セクション）は、
上位10記事から抽出した実データです。これらを必ず考慮して戦略を立ててください。

## 提案してほしい内容
1. **キーワードの優先順位付け**
   - 各キーワードを「high」「medium」「low」の優先度に分類
   - 優先度の理由を説明（競合性、検索ボリューム、難易度、**競合分析結果**を考慮）
   - 各キーワードの推定難易度（初心者向け/中級者向け/上級者向け）
   - 推奨コンテンツ文字数（**競合分析の推奨文字数を参考に**）
   - **競合記事の共起語・関連キーワードを活用した具体的な記事タイトル案**

2. **コンテンツ計画**
   - フェーズ1（最初の1-2ヶ月）: どのキーワードから始めるべきか（具体的な記事タイトル付き）
   - フェーズ2（3-4ヶ月目）: 次に取り組むキーワード（具体的な記事タイトル付き）
   - フェーズ3（5-6ヶ月目以降）: 最後に取り組むキーワード（具体的な記事タイトル付き）

3. **全体戦略**
   - ブログ全体の成長戦略の概要（**競合分析で発見した専門語彙を活用した権威性構築戦略**）
   - 内部リンク戦略の提案（**共起語・関連キーワードを活用したクラスター戦略**）
   - コンテンツの関連性を高める方法

4. **推定タイムライン**
   - 各フェーズの期間と目標

以下のJSON形式で回答してください：
{
  "prioritizedKeywords": [
    {
      "keyword": "キーワード名",
      "priority": "high" | "medium" | "low",
      "reason": "優先度の理由（競合分析結果を必ず言及）",
      "estimatedDifficulty": "初心者向け" | "中級者向け" | "上級者向け",
      "suggestedContentLength": 推奨文字数（数値、競合分析の推奨文字数を参考に）,
      "suggestedArticleTitles": ["記事タイトル案1", "記事タイトル案2", "記事タイトル案3"]
    }
  ],
  "contentPlan": {
    "phase1": ["キーワード1: 記事タイトル", "キーワード2: 記事タイトル"],
    "phase2": ["キーワード3: 記事タイトル", "キーワード4: 記事タイトル"],
    "phase3": ["キーワード5: 記事タイトル"]
  },
  "overallStrategy": "全体戦略の説明（日本語で詳しく、競合分析で発見した専門語彙・共起語を具体的に言及）",
  "estimatedTimeline": "推定タイムライン（日本語で詳しく）"
}`;

  try {
    console.log("[BlogStrategyAdvisor] Starting LLM strategy generation...");
    console.log("[BlogStrategyAdvisor] Keyword summary length:", keywordSummary.length, "characters");
    console.log("[BlogStrategyAdvisor] Prompt length:", prompt.length, "characters");
    
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "あなたはSEOとコンテンツマーケティングの専門家です。JSON形式で回答してください。",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "blog_strategy",
          strict: true,
          schema: {
            type: "object",
            properties: {
              prioritizedKeywords: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    keyword: { type: "string" },
                    priority: { type: "string", enum: ["high", "medium", "low"] },
                    reason: { type: "string" },
                    estimatedDifficulty: { type: "string" },
                    suggestedContentLength: { type: "number" },
                    suggestedArticleTitles: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "競合分析で発見した共起語・関連キーワードを活用した具体的な記事タイトル案（3-5個）" 
                    },
                  },
                  required: [
                    "keyword",
                    "priority",
                    "reason",
                    "estimatedDifficulty",
                    "suggestedContentLength",
                    "suggestedArticleTitles",
                  ],
                  additionalProperties: false,
                },
              },
              contentPlan: {
                type: "object",
                properties: {
                  phase1: { type: "array", items: { type: "string" } },
                  phase2: { type: "array", items: { type: "string" } },
                  phase3: { type: "array", items: { type: "string" } },
                },
                required: ["phase1", "phase2", "phase3"],
                additionalProperties: false,
              },
              overallStrategy: { type: "string" },
              estimatedTimeline: { type: "string" },
            },
            required: [
              "prioritizedKeywords",
              "contentPlan",
              "overallStrategy",
              "estimatedTimeline",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    console.log("[BlogStrategyAdvisor] LLM response received");
    const content = response.choices[0].message.content;
    console.log("[BlogStrategyAdvisor] Response content length:", content?.length || 0, "characters");
    
    if (!content) {
      throw new Error("LLMからの応答が空です");
    }

    console.log("[BlogStrategyAdvisor] Parsing JSON response...");
    const strategy: StrategyRecommendation = JSON.parse(content);
    console.log("[BlogStrategyAdvisor] Successfully parsed strategy with", strategy.prioritizedKeywords.length, "keywords");
    
    // 競合分析結果を各キーワードにcompetitorDataとして付加
    strategy.prioritizedKeywords = strategy.prioritizedKeywords.map((kw) => {
      const competitorData = competitorAnalysisResults.get(kw.keyword);
      if (competitorData) {
        return {
          ...kw,
          competitorData: {
            averageWordCount: competitorData.averageWordCount,
            recommendedWordCount: competitorData.recommendedWordCount,
            coOccurringKeywords: competitorData.coOccurringKeywords,
            relatedKeywords: competitorData.relatedKeywords,
            expertVocabulary: competitorData.expertVocabulary,
            recommendedSections: competitorData.contentStructure.recommendedSections,
          },
        };
      }
      return kw;
    });
    
    console.log("[BlogStrategyAdvisor] Strategy generation completed successfully");
    return strategy;
  } catch (error) {
    console.error("[BlogStrategyAdvisor] Error generating strategy:", error);
    console.error("[BlogStrategyAdvisor] Error stack:", error instanceof Error ? error.stack : "N/A");
    throw error;
  }
}
