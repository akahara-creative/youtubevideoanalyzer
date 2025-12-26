import "dotenv/config";
import { getDb } from "./server/db.js";
import { videoAnalyses } from "./drizzle/schema.js";
import { eq, desc } from "drizzle-orm";

async function failCurrentAnalysis() {
  try {
    const db = await getDb();
    if (!db) {
      console.error("❌ データベースに接続できませんでした");
      process.exit(1);
    }

    // 最新のprocessing状態の分析を取得
    const processingAnalyses = await db
      .select()
      .from(videoAnalyses)
      .where(eq(videoAnalyses.status, "processing"))
      .orderBy(desc(videoAnalyses.createdAt))
      .limit(1);

    if (processingAnalyses.length === 0) {
      console.log("⚠️ 処理中の分析が見つかりませんでした");
      process.exit(0);
    }

    const analysis = processingAnalyses[0];
    console.log(`📋 分析ID: ${analysis.id}`);
    console.log(`📹 YouTube URL: ${analysis.youtubeUrl}`);
    console.log(`📊 現在のステータス: ${analysis.status}`);
    console.log(`📈 現在の進捗: ${analysis.progress || 0}%`);
    console.log(`🔄 現在のステップ: ${analysis.currentStep || "なし"}\n`);

    // 失敗状態に更新
    await db
      .update(videoAnalyses)
      .set({
        status: "failed",
        errorMessage: "手動で失敗状態に設定されました（再試行可能）",
        errorDetails: JSON.stringify({
          message: "手動で失敗状態に設定されました",
          timestamp: new Date().toISOString(),
          reason: "ユーザーリクエストによる手動設定",
        }),
        currentStep: null,
        progress: 0,
      })
      .where(eq(videoAnalyses.id, analysis.id));

    console.log("✅ 分析を失敗状態に更新しました");
    console.log(`📝 分析ID ${analysis.id} を再試行できます\n`);
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    process.exit(1);
  }
}

failCurrentAnalysis();

