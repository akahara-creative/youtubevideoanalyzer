/**
 * アプリ経由でのテストスクリプト
 * 
 * tRPCエンドポイントを使用してテストを実行し、
 * アプリの画面で進捗を確認できるようにします
 */

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';

const BASE_URL = "http://localhost:3000";

// tRPCクライアントを作成（認証バイパスを使用）
const trpc = createTRPCProxyClient({
  links: [
    httpBatchLink({
      url: `${BASE_URL}/api/trpc`,
      headers: () => ({
        // 認証バイパス（開発環境）
        // サーバー側でENABLE_AUTH_BYPASS=trueの場合、これらのヘッダーで認証をバイパス
        'x-open-id': 'master-user',
        'x-name': 'Master User',
        'x-email': 'master@localhost',
      }),
    }),
  ],
});

const TEST_YOUTUBE_URL = "https://youtu.be/Z1uNCAu0y_8?si=B8NbrOLrAYnMFqI3";

/**
 * テスト1: 動画分析の機能チェック（アプリ経由）
 */
async function testVideoAnalysisViaApp() {
  console.log("\n=== テスト1: 動画分析の機能チェック（アプリ経由） ===");
  console.log(`動画URL: ${TEST_YOUTUBE_URL}`);
  
  try {
    // 動画分析を開始
    console.log("動画分析を開始します...");
    const { analysisId } = await trpc.video.analyze.mutate({
      youtubeUrl: TEST_YOUTUBE_URL,
    });
    
    console.log(`✅ 動画分析が開始されました（分析ID: ${analysisId}）`);
    console.log(`\nアプリの画面で進捗を確認できます:`);
    console.log(`  - 分析ID: ${analysisId}`);
    console.log(`  - ステータス確認: video.getAnalysis({ analysisId: ${analysisId} })`);
    console.log(`  - 一覧確認: video.listAnalyses()`);
    
    // 進捗をポーリング
    console.log("\n進捗を確認中...");
    let attempts = 0;
    const maxAttempts = 60; // 最大5分間待機（5秒間隔）
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒待機
      
      try {
        const result = await trpc.video.getAnalysis.query({ analysisId });
        const { analysis } = result;
        
        console.log(`[${attempts + 1}/${maxAttempts}] ステータス: ${analysis.status}`);
        
        if (analysis.status === "completed") {
          console.log("\n✅ 動画分析が完了しました！");
          console.log(`タイトル: ${analysis.title}`);
          console.log(`要約: ${analysis.summary?.substring(0, 100)}...`);
          console.log(`タイムラインセグメント数: ${result.segments.length}`);
          return { success: true, analysisId, analysis, segments: result.segments };
        } else if (analysis.status === "failed") {
          console.error("\n❌ 動画分析が失敗しました");
          console.error(`エラー: ${analysis.errorMessage}`);
          return { success: false, analysisId, error: analysis.errorMessage };
        }
      } catch (error) {
        console.error(`進捗確認エラー: ${error.message}`);
      }
      
      attempts++;
    }
    
    console.log("\n⚠️ タイムアウト: 分析が完了しませんでした");
    return { success: false, analysisId, error: "Timeout" };
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    return { success: false, error: error.message };
  }
}

/**
 * テスト2: 動画分析のバッチ処理のテスト（アプリ経由）
 */
async function testVideoAnalysisBatchViaApp() {
  console.log("\n=== テスト2: 動画分析のバッチ処理のテスト（アプリ経由） ===");
  
  const youtubeUrls = [
    TEST_YOUTUBE_URL,
    // 必要に応じて追加のURLを追加
  ];
  
  try {
    console.log(`バッチ処理を開始します（${youtubeUrls.length}件）...`);
    const { results } = await trpc.video.analyzeBatch.mutate({ youtubeUrls });
    
    console.log("\n✅ バッチ処理が開始されました");
    results.forEach((result, index) => {
      if (result.status === "started") {
        console.log(`  [${index + 1}] ${result.youtubeUrl} - 分析ID: ${result.analysisId}`);
      } else {
        console.log(`  [${index + 1}] ${result.youtubeUrl} - エラー: ${result.error}`);
      }
    });
    
    return { success: true, results };
  } catch (error) {
    console.error("❌ バッチ処理でエラーが発生しました:", error);
    return { success: false, error: error.message };
  }
}

/**
 * メイン実行関数
 */
async function main() {
  console.log("=== アプリ経由での機能テスト開始 ===\n");
  
  // サーバーのヘルスチェック
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    console.log("✅ サーバーは正常に動作しています");
  } catch (error) {
    console.error("❌ サーバーに接続できません:", error.message);
    process.exit(1);
  }
  
  const results = {
    videoAnalysis: null,
    videoAnalysisBatch: null,
  };
  
  // テスト1: 動画分析
  results.videoAnalysis = await testVideoAnalysisViaApp();
  
  // テスト2: 動画分析のバッチ処理
  results.videoAnalysisBatch = await testVideoAnalysisBatchViaApp();
  
  // 結果サマリー
  console.log("\n=== テスト結果サマリー ===");
  console.log(`動画分析: ${results.videoAnalysis?.success ? "✅ 成功" : "❌ 失敗"}`);
  console.log(`動画分析バッチ: ${results.videoAnalysisBatch?.success ? "✅ 成功" : "❌ 失敗"}`);
  
  if (results.videoAnalysis?.analysisId) {
    console.log(`\n📊 アプリの画面で確認:`);
    console.log(`  - 分析ID: ${results.videoAnalysis.analysisId}`);
    console.log(`  - URL: http://localhost:3000 (動画分析ページ)`);
  }
}

// 実行
main().catch(console.error);

