/**
 * 分析をリセットして再試行するスクリプト
 */

import mysql from "mysql2/promise";

const DB_CONFIG = {
  host: process.env.DATABASE_URL?.match(/@([^:]+):/)?.[1] || "localhost",
  port: parseInt(process.env.DATABASE_URL?.match(/:(\d+)\//)?.[1] || "3306"),
  user: process.env.DATABASE_URL?.match(/\/\/([^:]+):/)?.[1] || "root",
  password: process.env.DATABASE_URL?.match(/:[^@]+@/)?.[0]?.slice(1, -1) || "",
  database: process.env.DATABASE_URL?.match(/\/([^?]+)/)?.[1] || "youtube_analyzer",
};

const ANALYSIS_ID = 2;
const BASE_URL = "http://localhost:3000";

async function resetAndRetry() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    
    console.log(`=== 分析ID ${ANALYSIS_ID} をリセットして再試行します ===\n`);
    
    // 現在の分析を取得
    const [rows] = await connection.execute(
      "SELECT id, youtubeUrl, status FROM videoAnalyses WHERE id = ?",
      [ANALYSIS_ID]
    );
    
    if (rows.length === 0) {
      console.error("分析が見つかりませんでした");
      return;
    }
    
    const analysis = rows[0];
    console.log(`現在の状態: ${analysis.status}`);
    console.log(`URL: ${analysis.youtubeUrl}\n`);
    
    // 状態をfailedに変更（retryエンドポイントを使用するため）
    await connection.execute(
      "UPDATE videoAnalyses SET status = 'failed', errorMessage = '手動でリセット' WHERE id = ?",
      [ANALYSIS_ID]
    );
    console.log("✅ 分析の状態を 'failed' に変更しました\n");
    
    // 再試行
    const url = `${BASE_URL}/api/trpc/video.retry?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { "json": { "analysisId": ANALYSIS_ID } } }))}`;
    
    console.log("再試行を開始します...");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    
    const data = await response.json();
    
    // バックグラウンド処理を開始
    console.log("✅ 再試行が開始されました！");
    console.log(`\n📊 進捗を確認:`);
    console.log(`  - URL: http://localhost:3000/analysis/${ANALYSIS_ID}`);
    console.log(`  - 分析ID: ${ANALYSIS_ID}`);
    console.log(`\n💡 サーバーのログで進捗を確認できます`);
    
  } catch (error) {
    console.error("❌ エラーが発生しました:", error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

resetAndRetry().catch(console.error);

