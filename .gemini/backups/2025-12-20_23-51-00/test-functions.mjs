/**
 * 機能テストスクリプト
 * 
 * 以下の機能をテストします：
 * 1. 動画分析の機能チェック
 * 2. 動画分析のバッチ処理のテスト
 * 3. SEO記事生成のテスト
 * 4. SEO記事生成のバッチ処理のテスト
 */

import { processYouTubeVideo } from "./server/videoProcessor.ts";
import { processSeoArticleJob } from "./server/seoArticleJobProcessor.ts";
import { getDb } from "./server/db.ts";
import { seoArticleJobs } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

const BASE_URL = "http://localhost:3000";
const TEST_YOUTUBE_URL = "https://youtu.be/Z1uNCAu0y_8?si=B8NbrOLrAYnMFqI3";

/**
 * サーバーのヘルスチェック
 */
async function checkServerHealth() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    console.log("✅ サーバーは正常に動作しています");
    console.log("サーバー情報:", data);
    return true;
  } catch (error) {
    console.error("❌ サーバーに接続できません:", error.message);
    return false;
  }
}

/**
 * テスト1: 動画分析の機能チェック
 */
async function testVideoAnalysis() {
  console.log("\n=== テスト1: 動画分析の機能チェック ===");
  try {
    console.log(`動画URL: ${TEST_YOUTUBE_URL}`);
    console.log("動画分析を開始します...");
    
    const result = await processYouTubeVideo(TEST_YOUTUBE_URL);
    
    console.log("✅ 動画分析が完了しました");
    console.log(`タイトル: ${result.title}`);
    console.log(`文字起こしセグメント数: ${result.transcriptionSegments.length}`);
    console.log(`フレーム分析数: ${result.frameAnalyses.length}`);
    
    if (result.transcriptionSegments.length > 0) {
      console.log("\n文字起こしの最初の3セグメント:");
      result.transcriptionSegments.slice(0, 3).forEach((seg, i) => {
        console.log(`  [${i + 1}] ${seg.text.substring(0, 50)}...`);
      });
    }
    
    if (result.frameAnalyses.length > 0) {
      console.log("\nフレーム分析の最初の1つ:");
      const firstFrame = result.frameAnalyses[0];
      console.log(`  タイムスタンプ: ${firstFrame.timestamp}s`);
      console.log(`  視覚的説明: ${firstFrame.visualDescription.substring(0, 100)}...`);
    }
    
    return { success: true, result };
  } catch (error) {
    console.error("❌ 動画分析でエラーが発生しました:", error);
    return { success: false, error: error.message };
  }
}

/**
 * テスト2: 動画分析のバッチ処理のテスト
 */
async function testVideoAnalysisBatch() {
  console.log("\n=== テスト2: 動画分析のバッチ処理のテスト ===");
  try {
    const youtubeUrls = [
      TEST_YOUTUBE_URL,
      // 必要に応じて追加のURLを追加
    ];
    
    console.log(`バッチ処理を開始します（${youtubeUrls.length}件）...`);
    
    const results = [];
    for (const url of youtubeUrls) {
      console.log(`\n処理中: ${url}`);
      try {
        const result = await processYouTubeVideo(url);
        results.push({ url, success: true, result });
        console.log(`✅ 完了: ${result.title}`);
      } catch (error) {
        results.push({ url, success: false, error: error.message });
        console.error(`❌ エラー: ${error.message}`);
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\n✅ バッチ処理が完了しました（成功: ${successCount}/${results.length}）`);
    
    return { success: true, results };
  } catch (error) {
    console.error("❌ バッチ処理でエラーが発生しました:", error);
    return { success: false, error: error.message };
  }
}

/**
 * テスト3: SEO記事生成のテスト
 */
async function testSeoArticleGeneration() {
  console.log("\n=== テスト3: SEO記事生成のテスト ===");
  try {
    const theme = "TypeScriptの型安全性について";
    const userId = 1; // テスト用のユーザーID
    
    console.log(`テーマ: ${theme}`);
    console.log("SEO記事生成を開始します...");
    
    // ジョブを作成
    const db = await getDb();
    if (!db) {
      throw new Error("データベースに接続できません");
    }
    
    const [job] = await db.insert(seoArticleJobs).values({
      userId,
      theme,
      targetWordCount: 5000,
      authorName: "テストユーザー",
      autoEnhance: 0,
      status: "pending",
      currentStep: 1,
      progress: 0,
    });
    
    const jobId = job.insertId;
    console.log(`ジョブID: ${jobId}`);
    
    // バックグラウンド処理を開始
    await processSeoArticleJob(jobId);
    
    // ジョブの状態を確認
    const [updatedJob] = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, jobId));
    
    console.log(`✅ SEO記事生成が完了しました`);
    console.log(`ステータス: ${updatedJob.status}`);
    console.log(`進捗: ${updatedJob.progress}%`);
    console.log(`現在のステップ: ${updatedJob.currentStep}`);
    
    if (updatedJob.article) {
      console.log(`記事の文字数: ${updatedJob.article.length}`);
    }
    
    return { success: true, jobId, job: updatedJob };
  } catch (error) {
    console.error("❌ SEO記事生成でエラーが発生しました:", error);
    return { success: false, error: error.message };
  }
}

/**
 * テスト4: SEO記事生成のバッチ処理のテスト
 */
async function testSeoArticleBatch() {
  console.log("\n=== テスト4: SEO記事生成のバッチ処理のテスト ===");
  try {
    const themes = [
      "TypeScriptの型安全性について",
      "React Hooksの使い方",
      "Node.jsの非同期処理",
    ];
    const userId = 1; // テスト用のユーザーID
    
    console.log(`バッチ処理を開始します（${themes.length}件）...`);
    
    const db = await getDb();
    if (!db) {
      throw new Error("データベースに接続できません");
    }
    
    const jobIds = [];
    for (const theme of themes) {
      console.log(`\n処理中: ${theme}`);
      try {
        const [job] = await db.insert(seoArticleJobs).values({
          userId,
          theme,
          targetWordCount: 5000,
          authorName: "テストユーザー",
          autoEnhance: 0,
          status: "pending",
          currentStep: 1,
          progress: 0,
        });
        
        const jobId = job.insertId;
        jobIds.push(jobId);
        
        // バックグラウンド処理を開始（非同期）
        processSeoArticleJob(jobId).catch(error => {
          console.error(`[SEO Job ${jobId}] エラー:`, error);
        });
        
        console.log(`✅ ジョブ作成完了: ${jobId}`);
      } catch (error) {
        console.error(`❌ エラー: ${error.message}`);
      }
    }
    
    console.log(`\n✅ バッチ処理が開始されました（${jobIds.length}件）`);
    console.log(`ジョブID: ${jobIds.join(", ")}`);
    console.log("\n注意: バッチ処理はバックグラウンドで実行されます。");
    console.log("進捗はデータベースで確認してください。");
    
    return { success: true, jobIds };
  } catch (error) {
    console.error("❌ バッチ処理でエラーが発生しました:", error);
    return { success: false, error: error.message };
  }
}

/**
 * メイン実行関数
 */
async function main() {
  console.log("=== 機能テスト開始 ===\n");
  
  // サーバーのヘルスチェック
  const serverOk = await checkServerHealth();
  if (!serverOk) {
    console.error("\n❌ サーバーが起動していません。テストを中断します。");
    process.exit(1);
  }
  
  const results = {
    videoAnalysis: null,
    videoAnalysisBatch: null,
    seoArticle: null,
    seoArticleBatch: null,
  };
  
  // テスト1: 動画分析
  results.videoAnalysis = await testVideoAnalysis();
  
  // テスト2: 動画分析のバッチ処理
  results.videoAnalysisBatch = await testVideoAnalysisBatch();
  
  // テスト3: SEO記事生成
  results.seoArticle = await testSeoArticleGeneration();
  
  // テスト4: SEO記事生成のバッチ処理
  results.seoArticleBatch = await testSeoArticleBatch();
  
  // 結果サマリー
  console.log("\n=== テスト結果サマリー ===");
  console.log(`動画分析: ${results.videoAnalysis?.success ? "✅ 成功" : "❌ 失敗"}`);
  console.log(`動画分析バッチ: ${results.videoAnalysisBatch?.success ? "✅ 成功" : "❌ 失敗"}`);
  console.log(`SEO記事生成: ${results.seoArticle?.success ? "✅ 成功" : "❌ 失敗"}`);
  console.log(`SEO記事生成バッチ: ${results.seoArticleBatch?.success ? "✅ 成功" : "❌ 失敗"}`);
  
  const allSuccess = Object.values(results).every(r => r?.success);
  if (allSuccess) {
    console.log("\n✅ すべてのテストが成功しました！");
  } else {
    console.log("\n⚠️ 一部のテストが失敗しました。詳細を確認してください。");
  }
}

// 実行
main().catch(console.error);

