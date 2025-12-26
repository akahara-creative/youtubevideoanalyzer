/**
 * 分析を再試行するスクリプト
 */

const BASE_URL = "http://localhost:3000";
const ANALYSIS_ID = 2;

async function retryAnalysis() {
  console.log(`=== 分析ID ${ANALYSIS_ID} を再試行します ===\n`);
  
  try {
    // サーバーのヘルスチェック
    const healthResponse = await fetch(`${BASE_URL}/api/health`);
    if (!healthResponse.ok) {
      throw new Error("サーバーに接続できません");
    }
    console.log("✅ サーバーは正常に動作しています\n");
    
    // 分析を再試行
    const url = `${BASE_URL}/api/trpc/video.retry?batch=1&input=${encodeURIComponent(JSON.stringify({ analysisId: ANALYSIS_ID }))}`;
    
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
    console.log("✅ 再試行が開始されました！");
    console.log(`\n📊 進捗を確認:`);
    console.log(`  - URL: http://localhost:3000/analysis/${ANALYSIS_ID}`);
    console.log(`  - 分析ID: ${ANALYSIS_ID}`);
    console.log(`\n💡 サーバーのログで進捗を確認できます:`);
    console.log(`  - [processYouTubeVideo] で処理の進行状況が表示されます`);
    console.log(`  - [analyzeFrame] でフレーム分析の進捗が表示されます`);
    
    return { success: true };
  } catch (error) {
    console.error("❌ エラーが発生しました:", error.message);
    return { success: false, error: error.message };
  }
}

retryAnalysis().catch(console.error);

