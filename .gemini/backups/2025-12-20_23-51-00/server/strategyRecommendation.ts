import { invokeLLM } from "./_core/llm";
import { searchRAGWithTags } from "./ragWithTags";

export interface RecommendationRequest {
  purpose: string; // e.g., "教育動画を作りたい", "商品紹介動画を作りたい"
  targetAudience?: string; // e.g., "初心者", "専門家"
  duration?: string; // e.g., "5分", "10分"
  style?: string; // e.g., "カジュアル", "フォーマル"
}

export interface StrategyRecommendation {
  category: string;
  strategies: Array<{
    title: string;
    description: string;
    source: string;
    successLevel?: string;
    tags: string[];
  }>;
  summary: string;
}

/**
 * Recommend strategies based on user's purpose
 */
export async function recommendStrategies(
  request: RecommendationRequest
): Promise<{
  recommendations: StrategyRecommendation[];
  overallSummary: string;
}> {
  const { purpose, targetAudience, duration, style } = request;

  // Build search context
  const searchContext = [
    purpose,
    targetAudience && `対象: ${targetAudience}`,
    duration && `長さ: ${duration}`,
    style && `スタイル: ${style}`,
  ]
    .filter(Boolean)
    .join(", ");

  // Search RAG for relevant strategies
  const ragResults = await searchRAGWithTags({
    query: searchContext,
    tagFilters: {
      // Filter by relevant content types
      contentType: [
        "構成パターン",
        "スライドデザイン",
        "タイミング戦略",
        "説明パターン",
      ],
    },
    limit: 20,
  });

  if (ragResults.strategies.length === 0) {
    return {
      recommendations: [],
      overallSummary: "関連する戦略が見つかりませんでした。",
    };
  }

  // Group strategies by category
  const strategyGroups = new Map<string, any[]>();
  for (const strategy of ragResults.strategies) {
    const category = strategy.type || "その他";
    if (!strategyGroups.has(category)) {
      strategyGroups.set(category, []);
    }
    strategyGroups.get(category)!.push(strategy);
  }

  // Use LLM to analyze and summarize strategies
  const llmPrompt = `
あなたは動画制作のエキスパートです。以下のユーザーの目的に基づいて、RAGから取得した戦略を分析し、具体的な推奨事項を提供してください。

**ユーザーの目的:**
${searchContext}

**取得した戦略:**
${ragResults.strategies
  .map(
    (s: any, i: number) =>
      `${i + 1}. [${s.type}] ${s.content.substring(0, 200)}${s.content.length > 200 ? "..." : ""}`
  )
  .join("\n")}

**タスク:**
1. 各カテゴリー（構成パターン、スライドデザイン、タイミング戦略、説明パターン）ごとに、最も重要な戦略を3つ選び、要約してください。
2. ユーザーの目的に最適な全体的な推奨事項を提供してください。

**出力形式（JSON）:**
\`\`\`json
{
  "recommendations": [
    {
      "category": "構成パターン",
      "strategies": [
        {
          "title": "戦略のタイトル",
          "description": "戦略の説明（100文字以内）",
          "reason": "この戦略を推奨する理由"
        }
      ]
    }
  ],
  "overallSummary": "全体的な推奨事項（200文字以内）"
}
\`\`\`
`;

  const llmResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "あなたは動画制作のエキスパートです。ユーザーの目的に基づいて、最適な戦略を推奨してください。",
      },
      { role: "user", content: llmPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "strategy_recommendations",
        strict: true,
        schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  strategies: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        reason: { type: "string" },
                      },
                      required: ["title", "description", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["category", "strategies"],
                additionalProperties: false,
              },
            },
            overallSummary: { type: "string" },
          },
          required: ["recommendations", "overallSummary"],
          additionalProperties: false,
        },
      },
    },
  });

  const messageContent = llmResponse.choices[0].message.content;
  const result = JSON.parse(typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent) || "{}");

  // Enrich recommendations with source data
  const enrichedRecommendations: StrategyRecommendation[] =
    result.recommendations.map((rec: any) => ({
      category: rec.category,
      strategies: rec.strategies.map((s: any) => ({
        title: s.title,
        description: s.description,
        source: s.reason,
        tags: [],
      })),
      summary: rec.strategies.map((s: any) => s.reason).join(" "),
    }));

  return {
    recommendations: enrichedRecommendations,
    overallSummary: result.overallSummary,
  };
}
