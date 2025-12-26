/**
 * RAG Feedback System
 * 
 * Captures user edits and successful patterns to improve future generations.
 */

import { getDb } from "./db";
import { saveToRAGWithTags } from "./ragWithTags";
import { videoStrategy, videoScenario, videoSlideDesign, videoBenchmarkAnalysis } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Save edited strategy to RAG for future reference
 */
export async function saveStrategyFeedback(params: {
  strategyId: number;
  userId: number;
  editedFields: string[];
  successLevel?: "high" | "medium" | "low";
}): Promise<void> {
  const { strategyId, userId, editedFields, successLevel = "medium" } = params;

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get strategy data
  const strategies = await db
    .select()
    .from(videoStrategy)
    .where(eq(videoStrategy.id, strategyId));

  if (strategies.length === 0) {
    throw new Error("Strategy not found");
  }

  const strategy = strategies[0];

  // Create RAG content
  const ragContent = `
# 戦略設計フィードバック

## テーマ
${strategy.theme}

## 集客源ネタ
${strategy.trafficSources}

## 解決策ネタ
${strategy.solutionTopics}

## ターゲット視聴者
${strategy.targetAudience}

## 痛み・問題点
${strategy.painPoints}

## 期待する成果
${strategy.desiredOutcomes}

## 独自の価値提案
${strategy.uniqueValueProposition}

## 編集されたフィールド
${editedFields.join(", ")}

## 成功レベル
${successLevel}

## メタデータ
- ユーザーID: ${userId}
- 戦略ID: ${strategyId}
- 編集日時: ${new Date().toISOString()}
`.trim();

  // Save to RAG
  await saveToRAGWithTags({
    content: ragContent,
    type: "strategy_feedback",
    sourceId: `strategy_${strategyId}`,
    successLevel: successLevel === "high" ? "高" : successLevel === "medium" ? "中" : "低",
    tags: {
      contentType: ["戦略フィードバック"],
    },
  });

  console.log(`[RAGFeedback] Strategy feedback saved to RAG (ID: ${strategyId})`);
}

/**
 * Save edited scenario to RAG for future reference
 */
export async function saveScenarioFeedback(params: {
  scenarioId: number;
  userId: number;
  editedFields: string[];
  successLevel?: "high" | "medium" | "low";
}): Promise<void> {
  const { scenarioId, userId, editedFields, successLevel = "medium" } = params;

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get scenario data
  const scenarios = await db
    .select()
    .from(videoScenario)
    .where(eq(videoScenario.id, scenarioId));

  if (scenarios.length === 0) {
    throw new Error("Scenario not found");
  }

  const scenario = scenarios[0];

  // Create RAG content
  const ragContent = `
# シナリオフィードバック

## フック（${scenario.hookDuration}秒）
${scenario.hookContent}

目的: ${scenario.hookPurpose}

## 問題提起（${scenario.problemDuration}秒）
${scenario.problemContent}

目的: ${scenario.problemPurpose}

## 解決策（${scenario.solutionDuration}秒）
${scenario.solutionContent}

目的: ${scenario.solutionPurpose}

## 行動喚起（${scenario.ctaDuration}秒）
${scenario.ctaContent}

目的: ${scenario.ctaPurpose}

## 編集されたフィールド
${editedFields.join(", ")}

## 成功レベル
${successLevel}

## メタデータ
- ユーザーID: ${userId}
- シナリオID: ${scenarioId}
- 編集日時: ${new Date().toISOString()}
`.trim();

  // Save to RAG
  await saveToRAGWithTags({
    content: ragContent,
    type: "scenario_feedback",
    sourceId: `scenario_${scenarioId}`,
    successLevel: successLevel === "high" ? "高" : successLevel === "medium" ? "中" : "低",
    tags: {
      contentType: ["シナリオフィードバック"],
    },
  });

  console.log(`[RAGFeedback] Scenario feedback saved to RAG (ID: ${scenarioId})`);
}

/**
 * Save edited slides to RAG for future reference
 */
export async function saveSlidesFeedback(params: {
  jobId: number;
  userId: number;
  editedSlides: number[];
  successLevel?: "high" | "medium" | "low";
}): Promise<void> {
  const { jobId, userId, editedSlides, successLevel = "medium" } = params;

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get slides data
  const slides = await db
    .select()
    .from(videoSlideDesign)
    .where(eq(videoSlideDesign.jobId, jobId));

  if (slides.length === 0) {
    throw new Error("Slides not found");
  }

  // Create RAG content
  const ragContent = `
# スライドフィードバック

## 編集されたスライド
${editedSlides.map(slideNum => {
  const slide = slides.find(s => s.slideNumber === slideNum);
  if (!slide) return "";
  
  return `
### スライド ${slide.slideNumber}: ${slide.title}

内容:
${JSON.parse(slide.content || "[]").join("\n")}

視覚的要素:
${JSON.stringify(JSON.parse(slide.visualElements || "{}"), null, 2)}

デザイン注意事項:
${slide.designNotes}

所要時間: ${slide.duration}秒
`;
}).join("\n")}

## 成功レベル
${successLevel}

## メタデータ
- ユーザーID: ${userId}
- ジョブID: ${jobId}
- 編集されたスライド数: ${editedSlides.length}
- 編集日時: ${new Date().toISOString()}
`.trim();

  // Save to RAG
  await saveToRAGWithTags({
    content: ragContent,
    type: "slides_feedback",
    sourceId: `job_${jobId}`,
    successLevel: successLevel === "high" ? "高" : successLevel === "medium" ? "中" : "低",
    tags: {
      contentType: ["スライドフィードバック"],
    },
  });

  console.log(`[RAGFeedback] Slides feedback saved to RAG (Job ID: ${jobId})`);
}

/**
 * Save successful video generation pattern to RAG
 */
export async function saveSuccessPattern(params: {
  jobId: number;
  userId: number;
  metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    watchTime?: number;
  };
}): Promise<void> {
  const { jobId, userId, metrics } = params;

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all related data
  const [strategyData, scenarioData, slidesData, benchmarkData] = await Promise.all([
    db.select().from(videoStrategy).where(eq(videoStrategy.jobId, jobId)),
    db.select().from(videoScenario).where(eq(videoScenario.jobId, jobId)),
    db.select().from(videoSlideDesign).where(eq(videoSlideDesign.jobId, jobId)),
    db.select().from(videoBenchmarkAnalysis).where(eq(videoBenchmarkAnalysis.jobId, jobId)),
  ]);

  if (strategyData.length === 0) {
    throw new Error("Strategy not found");
  }

  const strategy = strategyData[0];
  const scenario = scenarioData[0];
  const slides = slidesData;
  const benchmarks = benchmarkData;

  // Create comprehensive RAG content
  const ragContent = `
# 成功パターン

## パフォーマンス指標
- 視聴回数: ${metrics.views || "N/A"}
- 高評価数: ${metrics.likes || "N/A"}
- コメント数: ${metrics.comments || "N/A"}
- シェア数: ${metrics.shares || "N/A"}
- 視聴時間: ${metrics.watchTime || "N/A"}秒

## 戦略
- テーマ: ${strategy.theme}
- 集客源ネタ: ${strategy.trafficSources}
- 解決策ネタ: ${strategy.solutionTopics}
- ターゲット視聴者: ${strategy.targetAudience}

## シナリオ構成
- フック: ${scenario?.hookDuration || 0}秒
- 問題提起: ${scenario?.problemDuration || 0}秒
- 解決策: ${scenario?.solutionDuration || 0}秒
- 行動喚起: ${scenario?.ctaDuration || 0}秒

## スライド数
${slides.length}枚

## ベンチマーク分析
${benchmarks.length}件の動画を分析

## メタデータ
- ユーザーID: ${userId}
- ジョブID: ${jobId}
- 記録日時: ${new Date().toISOString()}
`.trim();

  // Save to RAG with high success level
  await saveToRAGWithTags({
    content: ragContent,
    type: "success_pattern",
    sourceId: `job_${jobId}`,
    successLevel: "高",
    tags: {
      contentType: ["成功パターン"],
    },
  });

  console.log(`[RAGFeedback] Success pattern saved to RAG (Job ID: ${jobId})`);
}
