/**
 * HTTP直接リクエストでのテストスクリプト
 * 
 * tRPCエンドポイントに直接HTTPリクエストを送信してテストを実行します
 */

const BASE_URL = "http://localhost:3000";
const TEST_YOUTUBE_URL = "https://youtu.be/Z1uNCAu0y_8?si=B8NbrOLrAYnMFqI3";

/**
 * tRPCリクエストを送信
 */
async function trpcRequest(procedure, input, method = "mutation") {
  const url = `${BASE_URL}/api/trpc/${procedure}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`;
  
  const response = await fetch(url, {
    method: method === "mutation" ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  const data = await response.json();
  // tRPCのバッチレスポンス形式: [{result: {data: ...}}]
  if (Array.isArray(data) && data[0]?.result?.data) {
    return data[0].result.data;
  }
  if (data[0]?.error) {
    throw new Error(data[0].error.message || "tRPC error");
  }
  return data;
}

/**
 * テスト1: 動画分析の機能チェック（HTTP経由）
 */
async function testVideoAnalysisViaHttp() {
  console.log("\n=== テスト1: 動画分析の機能チェック（HTTP経由） ===");
  console.log(`動画URL: ${TEST_YOUTUBE_URL}`);
  
  try {
    // 動画分析を開始
    console.log("動画分析を開始します...");
    const result = await trpcRequest("video.analyze", {
      youtubeUrl: TEST_YOUTUBE_URL,
    }, "mutation");
    
    const analysisId = result.analysisId;
    console.log(`✅ 動画分析が開始されました（分析ID: ${analysisId}）`);
    console.log(`\n📊 アプリの画面で進捗を確認できます:`);
    console.log(`  - URL: http://localhost:3000/analysis/${analysisId}`);
    console.log(`  - 分析ID: ${analysisId}`);
    
    // 進捗をポーリング
    console.log("\n進捗を確認中...");
    let attempts = 0;
    const maxAttempts = 120; // 最大10分間待機（5秒間隔）
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒待機
      
      try {
        const queryResult = await trpcRequest("video.getAnalysis", {
          analysisId,
        }, "query");
        
        const analysis = queryResult.analysis;
        const segments = queryResult.segments || [];
        
        console.log(`[${attempts + 1}/${maxAttempts}] ステータス: ${analysis.status}`);
        
        if (analysis.status === "completed") {
          console.log("\n✅ 動画分析が完了しました！");
          console.log(`タイトル: ${analysis.title}`);
          if (analysis.summary) {
            console.log(`要約: ${analysis.summary.substring(0, 100)}...`);
          }
          console.log(`タイムラインセグメント数: ${segments.length}`);
          return { success: true, analysisId, analysis, segments };
        } else if (analysis.status === "failed") {
          console.error("\n❌ 動画分析が失敗しました");
          console.error(`エラー: ${analysis.errorMessage || "Unknown error"}`);
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
 * テスト2: 動画分析のバッチ処理のテスト（HTTP経由）
 */
async function testVideoAnalysisBatchViaHttp() {
  console.log("\n=== テスト2: 動画分析のバッチ処理のテスト（HTTP経由） ===");
  
  const youtubeUrls = [
    TEST_YOUTUBE_URL,
  ];
  
  try {
    console.log(`バッチ処理を開始します（${youtubeUrls.length}件）...`);
    const result = await trpcRequest("video.analyzeBatch", {
      youtubeUrls,
    }, "mutation");
    
    console.log("\n✅ バッチ処理が開始されました");
    result.results.forEach((r, index) => {
      if (r.status === "started") {
        console.log(`  [${index + 1}] ${r.youtubeUrl} - 分析ID: ${r.analysisId}`);
        console.log(`      → 進捗確認: http://localhost:3000/analysis/${r.analysisId}`);
      } else {
        console.log(`  [${index + 1}] ${r.youtubeUrl} - エラー: ${r.error}`);
      }
    });
    
    return { success: true, results: result.results };
  } catch (error) {
    console.error("❌ バッチ処理でエラーが発生しました:", error);
    return { success: false, error: error.message };
  }
}

/**
 * メイン実行関数
 */
async function main() {
  console.log("=== HTTP経由での機能テスト開始 ===\n");
  
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
  results.videoAnalysis = await testVideoAnalysisViaHttp();
  
  // テスト2: 動画分析のバッチ処理
  results.videoAnalysisBatch = await testVideoAnalysisBatchViaHttp();
  
  // 結果サマリー
  console.log("\n=== テスト結果サマリー ===");
  console.log(`動画分析: ${results.videoAnalysis?.success ? "✅ 成功" : "❌ 失敗"}`);
  console.log(`動画分析バッチ: ${results.videoAnalysisBatch?.success ? "✅ 成功" : "❌ 失敗"}`);
  
  if (results.videoAnalysis?.analysisId) {
    console.log(`\n📊 アプリの画面で確認:`);
    console.log(`  - 分析ID: ${results.videoAnalysis.analysisId}`);
    console.log(`  - URL: http://localhost:3000/analysis/${results.videoAnalysis.analysisId}`);
  }
}

// 実行
main().catch(console.error);

