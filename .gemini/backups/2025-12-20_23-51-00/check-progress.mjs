/**
 * 動画分析の進捗を確認するスクリプト
 * データベースから直接状態を確認
 */

import mysql from "mysql2/promise";

const DB_CONFIG = {
  host: process.env.DATABASE_URL?.match(/@([^:]+):/)?.[1] || "localhost",
  port: parseInt(process.env.DATABASE_URL?.match(/:(\d+)\//)?.[1] || "3306"),
  user: process.env.DATABASE_URL?.match(/\/\/([^:]+):/)?.[1] || "root",
  password: process.env.DATABASE_URL?.match(/:[^@]+@/)?.[0]?.slice(1, -1) || "",
  database: process.env.DATABASE_URL?.match(/\/([^?]+)/)?.[1] || "youtube_analyzer",
};

async function checkProgress() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    
    console.log("=== 動画分析の進捗確認 ===\n");
    
    // 最新の分析を取得
    const [rows] = await connection.execute(
      "SELECT id, youtubeUrl, status, title, currentStep, progress, errorMessage, createdAt, updatedAt FROM videoAnalyses ORDER BY createdAt DESC LIMIT 5"
    );
    
    if (rows.length === 0) {
      console.log("分析結果が見つかりませんでした");
      return;
    }
    
    console.log(`最新の${rows.length}件の分析結果:\n`);
    
    for (const row of rows) {
      console.log(`分析ID: ${row.id}`);
      console.log(`URL: ${row.youtubeUrl}`);
      console.log(`ステータス: ${row.status}`);
      console.log(`タイトル: ${row.title || "(未設定)"}`);
      console.log(`現在のステップ: ${row.currentStep || "(未設定)"}`);
      console.log(`進捗: ${row.progress || 0}%`);
      
      if (row.errorMessage) {
        console.log(`❌ エラー: ${row.errorMessage}`);
      }
      
      const createdAt = new Date(row.createdAt);
      const updatedAt = new Date(row.updatedAt);
      const elapsed = Math.floor((updatedAt - createdAt) / 1000 / 60);
      console.log(`経過時間: ${elapsed}分`);
      console.log(`更新日時: ${updatedAt.toLocaleString("ja-JP")}`);
      console.log("---\n");
    }
  } catch (error) {
    console.error("エラー:", error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkProgress();

