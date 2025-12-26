/**
 * 動画分析の状態を確認するスクリプト
 */

import { getDb } from "./server/db.ts";
import { videoAnalyses } from "./drizzle/schema.ts";
import { eq, desc } from "drizzle-orm";

async function checkAnalysisStatus() {
  const db = await getDb();
  if (!db) {
    console.error("データベースに接続できません");
    process.exit(1);
  }

  console.log("=== 動画分析の状態確認 ===\n");

  // 最新の分析を取得
  const analyses = await db
    .select()
    .from(videoAnalyses)
    .orderBy(desc(videoAnalyses.createdAt))
    .limit(5);

  if (analyses.length === 0) {
    console.log("分析結果が見つかりませんでした");
    return;
  }

  console.log(`最新の${analyses.length}件の分析結果:\n`);

  for (const analysis of analyses) {
    console.log(`分析ID: ${analysis.id}`);
    console.log(`URL: ${analysis.youtubeUrl}`);
    console.log(`ステータス: ${analysis.status}`);
    console.log(`タイトル: ${analysis.title || "(未設定)"}`);
    console.log(`現在のステップ: ${analysis.currentStep || "(未設定)"}`);
    console.log(`進捗: ${analysis.progress || 0}%`);
    
    if (analysis.errorMessage) {
      console.log(`エラー: ${analysis.errorMessage}`);
    }
    
    if (analysis.errorDetails) {
      try {
        const details = JSON.parse(analysis.errorDetails);
        console.log(`エラー詳細: ${details.message || "N/A"}`);
      } catch (e) {
        console.log(`エラー詳細: ${analysis.errorDetails.substring(0, 100)}...`);
      }
    }
    
    console.log(`作成日時: ${analysis.createdAt}`);
    console.log(`更新日時: ${analysis.updatedAt}`);
    console.log("---\n");
  }
}

checkAnalysisStatus().catch(console.error);

