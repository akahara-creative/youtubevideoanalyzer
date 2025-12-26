/**
 * Content Strategy
 * 
 * Designs content strategy, generates scenarios, and creates slides
 * based on benchmark analysis and RAG knowledge.
 */

import { invokeLLM } from "./_core/llm";
import { searchRAGWithTags } from "./ragWithTags";

export interface ThemeBreakdown {
  theme: string;
  attractionSources: string[]; // 集客源となるネタ
  solutionTopics: string[]; // 解決策となるネタ
}

export interface ContentStrategy {
  themeBreakdown: ThemeBreakdown;
  targetAudience: string;
  painPoints: string[];
  desiredOutcome: string;
  uniqueValueProposition: string;
}

export interface Scenario {
  hook: {
    content: string;
    duration: number; // seconds
    purpose: string;
  };
  problemPresentation: {
    content: string;
    duration: number;
    purpose: string;
  };
  solution: {
    content: string;
    duration: number;
    purpose: string;
  };
  callToAction: {
    content: string;
    duration: number;
    purpose: string;
  };
}

export interface Slide {
  slideNumber: number;
  title: string;
  content: string[];
  visualElements: {
    images?: string[];
    icons?: string[];
    charts?: string[];
  };
  designNotes: string;
  duration: number; // seconds
}

/**
 * Break down theme into attraction sources and solution topics
 */
export async function breakdownTheme(theme: string): Promise<ThemeBreakdown> {
  console.log(`[ContentStrategy] Breaking down theme: ${theme}`);

  const prompt = `以下のテーマを分解してください：

テーマ: ${theme}

テーマを以下の2つの要素に分解してください：

1. **集客源となるネタ**: 視聴者の興味を引く、入り口となるトピック（例: SEO、バズ、プレゼント企画、SNSマーケ）
2. **解決策となるネタ**: 視聴者の問題を解決する、核心となるトピック（例: ステップメール）

JSON形式で返してください：
{
  "attractionSources": ["ネタ1", "ネタ2", ...],
  "solutionTopics": ["ネタ1", "ネタ2", ...]
}`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "あなたはコンテンツ戦略の専門家です。テーマを集客源と解決策に分解します。",
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "theme_breakdown",
        strict: true,
        schema: {
          type: "object",
          properties: {
            attractionSources: {
              type: "array",
              items: { type: "string" },
            },
            solutionTopics: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["attractionSources", "solutionTopics"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content || "{}";
  const parsed = JSON.parse(content);

  return {
    theme,
    attractionSources: parsed.attractionSources || [],
    solutionTopics: parsed.solutionTopics || [],
  };
}

/**
 * Design content strategy based on theme breakdown and RAG knowledge
 */
export async function designStrategy(
  themeBreakdown: ThemeBreakdown,
  benchmarkAnalysisId?: number
): Promise<ContentStrategy> {
  console.log("[ContentStrategy] Designing content strategy");

  // Search RAG for relevant knowledge
  const ragResults = await searchRAGWithTags({ query: themeBreakdown.theme, limit: 5 });
  const ragKnowledge = ragResults.map((r) => r.content).join("\n\n");

  const prompt = `以下のテーマ分解とRAG知識から、コンテンツ戦略を設計してください。

【テーマ分解】
テーマ: ${themeBreakdown.theme}
集客源となるネタ: ${themeBreakdown.attractionSources.join(", ")}
解決策となるネタ: ${themeBreakdown.solutionTopics.join(", ")}

【RAG知識（過去の成功パターン）】
${ragKnowledge}

以下の要素を含むコンテンツ戦略を設計してください：

1. **ターゲット視聴者**: 誰に向けたコンテンツか
2. **痛み・問題点**: ターゲット視聴者が抱えている問題（3〜5個）
3. **期待する成果**: 視聴者が得られる成果
4. **独自の価値提案**: 市場の他のコンテンツとの差別化ポイント

JSON形式で返してください：
{
  "targetAudience": "ターゲット視聴者",
  "painPoints": ["問題1", "問題2", ...],
  "desiredOutcome": "期待する成果",
  "uniqueValueProposition": "独自の価値提案"
}`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "あなたはコンテンツ戦略の専門家です。RAG知識を活用して効果的な戦略を設計します。",
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "content_strategy",
        strict: true,
        schema: {
          type: "object",
          properties: {
            targetAudience: { type: "string" },
            painPoints: {
              type: "array",
              items: { type: "string" },
            },
            desiredOutcome: { type: "string" },
            uniqueValueProposition: { type: "string" },
          },
          required: [
            "targetAudience",
            "painPoints",
            "desiredOutcome",
            "uniqueValueProposition",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content || "{}";
  const parsed = JSON.parse(content);

  return {
    themeBreakdown,
    targetAudience: parsed.targetAudience || "",
    painPoints: parsed.painPoints || [],
    desiredOutcome: parsed.desiredOutcome || "",
    uniqueValueProposition: parsed.uniqueValueProposition || "",
  };
}

/**
 * Generate scenario based on content strategy and RAG knowledge
 */
export async function generateScenario(
  strategy: ContentStrategy
): Promise<Scenario> {
  console.log("[ContentStrategy] Generating scenario");

  // Search RAG for scenario patterns
  const ragResults = await searchRAGWithTags({
    query: `シナリオ フック 問題提起 解決策 ${strategy.themeBreakdown.theme}`,
    limit: 5
  });
  const ragKnowledge = ragResults.map((r) => r.content).join("\n\n");

  const prompt = `以下のコンテンツ戦略とRAG知識から、効果的なシナリオを生成してください。

【コンテンツ戦略】
テーマ: ${strategy.themeBreakdown.theme}
ターゲット視聴者: ${strategy.targetAudience}
痛み・問題点: ${strategy.painPoints.join(", ")}
期待する成果: ${strategy.desiredOutcome}
独自の価値提案: ${strategy.uniqueValueProposition}

【RAG知識（過去の成功パターン）】
${ragKnowledge}

以下の4つのセクションからなるシナリオを生成してください：

1. **フック（Hook）**: 最初の15秒で視聴者の注意を引く
   - 顕在的興味を引く要素
   - 潜在的興味を引く要素
   - 目安時間: 15秒

2. **問題提起（Problem Presentation）**: 視聴者の問題を明確化
   - 視聴者が抱えている問題の提示
   - 市場の他社が解決できていない点の指摘
   - 目安時間: 45秒

3. **解決策（Solution）**: 本当の問題解決方法を提示
   - 根本的な解決策の提示
   - 具体的なステップや方法
   - 目安時間: 4分

4. **行動喚起（Call to Action）**: 視聴者に次のアクションを促す
   - 具体的な行動の提案
   - 目安時間: 30秒

各セクションについて、以下を含めてください：
- content: セクションの内容（台本）
- duration: 目安時間（秒）
- purpose: セクションの目的

JSON形式で返してください：
{
  "hook": {
    "content": "フックの内容",
    "duration": 15,
    "purpose": "フックの目的"
  },
  "problemPresentation": {
    "content": "問題提起の内容",
    "duration": 45,
    "purpose": "問題提起の目的"
  },
  "solution": {
    "content": "解決策の内容",
    "duration": 240,
    "purpose": "解決策の目的"
  },
  "callToAction": {
    "content": "行動喚起の内容",
    "duration": 30,
    "purpose": "行動喚起の目的"
  }
}`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "あなたはシナリオ作成の専門家です。RAG知識を活用して効果的なシナリオを生成します。",
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "scenario",
        strict: true,
        schema: {
          type: "object",
          properties: {
            hook: {
              type: "object",
              properties: {
                content: { type: "string" },
                duration: { type: "number" },
                purpose: { type: "string" },
              },
              required: ["content", "duration", "purpose"],
              additionalProperties: false,
            },
            problemPresentation: {
              type: "object",
              properties: {
                content: { type: "string" },
                duration: { type: "number" },
                purpose: { type: "string" },
              },
              required: ["content", "duration", "purpose"],
              additionalProperties: false,
            },
            solution: {
              type: "object",
              properties: {
                content: { type: "string" },
                duration: { type: "number" },
                purpose: { type: "string" },
              },
              required: ["content", "duration", "purpose"],
              additionalProperties: false,
            },
            callToAction: {
              type: "object",
              properties: {
                content: { type: "string" },
                duration: { type: "number" },
                purpose: { type: "string" },
              },
              required: ["content", "duration", "purpose"],
              additionalProperties: false,
            },
          },
          required: ["hook", "problemPresentation", "solution", "callToAction"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content || "{}";
  return JSON.parse(content);
}

/**
 * Generate slides based on scenario and RAG knowledge
 */
export async function generateSlides(
  scenario: Scenario,
  strategy: ContentStrategy
): Promise<Slide[]> {
  console.log("[ContentStrategy] Generating slides");

  // Search RAG for slide design patterns
  const ragResults = await searchRAGWithTags({
    query: `スライド デザイン フォント 色 配置 ${strategy.themeBreakdown.theme}`,
    limit: 5
  });
  const ragKnowledge = ragResults.map((r) => r.content).join("\n\n");

  const prompt = `以下のシナリオとRAG知識から、効果的なスライドを生成してください。

【シナリオ】
フック: ${scenario.hook.content}
問題提起: ${scenario.problemPresentation.content}
解決策: ${scenario.solution.content}
行動喚起: ${scenario.callToAction.content}

【コンテンツ戦略】
テーマ: ${strategy.themeBreakdown.theme}
ターゲット視聴者: ${strategy.targetAudience}
独自の価値提案: ${strategy.uniqueValueProposition}

【RAG知識（過去の成功パターン）】
${ragKnowledge}

シナリオに基づいて、8〜12枚のスライドを生成してください。各スライドには以下を含めてください：

1. **slideNumber**: スライド番号（1から開始）
2. **title**: スライドのタイトル
3. **content**: スライドの内容（箇条書き、3〜5項目）
4. **visualElements**: 視覚的要素
   - images: 使用する画像の説明（配列）
   - icons: 使用するアイコンの説明（配列）
   - charts: 使用するチャートの説明（配列）
5. **designNotes**: デザインに関する注意事項（フォント、色、配置など）
6. **duration**: スライドの表示時間（秒）

スライドのデザイン原則：
- フォントは大きく、読みやすく
- 色は視認性を重視
- 画像やアイコンで視覚的に訴求
- キーワードを強調
- 市場の中での独自性を表現

JSON形式で返してください：
{
  "slides": [
    {
      "slideNumber": 1,
      "title": "タイトル",
      "content": ["項目1", "項目2", ...],
      "visualElements": {
        "images": ["画像の説明"],
        "icons": ["アイコンの説明"],
        "charts": ["チャートの説明"]
      },
      "designNotes": "デザインに関する注意事項",
      "duration": 15
    },
    ...
  ]
}`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "あなたはスライドデザインの専門家です。RAG知識を活用して効果的なスライドを生成します。",
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "slides",
        strict: true,
        schema: {
          type: "object",
          properties: {
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slideNumber: { type: "number" },
                  title: { type: "string" },
                  content: {
                    type: "array",
                    items: { type: "string" },
                  },
                  visualElements: {
                    type: "object",
                    properties: {
                      images: {
                        type: "array",
                        items: { type: "string" },
                      },
                      icons: {
                        type: "array",
                        items: { type: "string" },
                      },
                      charts: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                    required: [],
                    additionalProperties: false,
                  },
                  designNotes: { type: "string" },
                  duration: { type: "number" },
                },
                required: [
                  "slideNumber",
                  "title",
                  "content",
                  "visualElements",
                  "designNotes",
                  "duration",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["slides"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content || "{}";
  const parsed = JSON.parse(content);
  return parsed.slides || [];
}

/**
 * Perform complete content strategy design
 */
export async function performContentStrategy(
  theme: string,
  benchmarkAnalysisId?: number
): Promise<{
  strategy: ContentStrategy;
  scenario: Scenario;
  slides: Slide[];
}> {
  console.log(`[ContentStrategy] Starting content strategy for: ${theme}`);

  // Step 1: Break down theme
  const themeBreakdown = await breakdownTheme(theme);

  // Step 2: Design strategy
  const strategy = await designStrategy(themeBreakdown, benchmarkAnalysisId);

  // Step 3: Generate scenario
  const scenario = await generateScenario(strategy);

  // Step 4: Generate slides
  const slides = await generateSlides(scenario, strategy);

  console.log("[ContentStrategy] Content strategy completed");

  return {
    strategy,
    scenario,
    slides,
  };
}
