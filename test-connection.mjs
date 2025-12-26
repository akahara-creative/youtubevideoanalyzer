#!/usr/bin/env node

/**
 * ローカルサーバーへの接続をテストするスクリプト
 * 使用方法: node test-connection.mjs [port]
 */

const port = process.argv[2] || process.env.PORT || 3000;
// IPv4で明示的に接続（IPv6の問題を回避）
const baseUrl = `http://127.0.0.1:${port}`;

console.log(`\n🔍 接続テストを開始します...`);
console.log(`対象URL: ${baseUrl}\n`);

async function testConnection() {
  try {
    // ヘルスチェックエンドポイントをテスト
    console.log("1. ヘルスチェックエンドポイントをテスト中...");
    
    // Node.jsのfetchがIPv6を優先しないように、明示的にIPv4を使用
    const healthResponse = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // IPv4を優先
      signal: AbortSignal.timeout(5000),
    });

    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log("✅ ヘルスチェック成功:");
      console.log(`   - ステータス: ${healthData.status}`);
      console.log(`   - 環境: ${healthData.environment}`);
      console.log(`   - ポート: ${healthData.port}`);
      console.log(`   - タイムスタンプ: ${healthData.timestamp}`);
    } else {
      console.log(`❌ ヘルスチェック失敗: ${healthResponse.status} ${healthResponse.statusText}`);
      return false;
    }

    // tRPCエンドポイントをテスト
    console.log("\n2. tRPCエンドポイントをテスト中...");
    const trpcResponse = await fetch(`${baseUrl}/api/trpc/auth.me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (trpcResponse.ok || trpcResponse.status === 401) {
      // 401は認証エラーなので、エンドポイント自体は動作している
      console.log("✅ tRPCエンドポイントは応答しています");
      if (trpcResponse.status === 401) {
        console.log("   (認証が必要なエンドポイントです)");
      }
    } else {
      console.log(`⚠️  tRPCエンドポイントの応答: ${trpcResponse.status} ${trpcResponse.statusText}`);
    }

    console.log("\n✅ 接続テスト完了: サーバーは正常に動作しています\n");
    return true;
  } catch (error) {
    console.error("\n❌ 接続エラーが発生しました:");
    console.error(`   エラー: ${error.message}\n`);
    
    console.log("【対処法】");
    console.log("1. サーバーが起動しているか確認:");
    console.log("   pnpm dev");
    console.log("\n2. ポートが正しいか確認:");
    console.log(`   現在のポート: ${port}`);
    console.log("   環境変数PORTが設定されている場合は、そのポートを使用します");
    console.log("\n3. ファイアウォールやVPNが接続をブロックしていないか確認");
    console.log("\n4. 別のプロセスが同じポートを使用していないか確認:");
    console.log(`   lsof -i :${port}  # macOS/Linux`);
    console.log(`   netstat -ano | findstr :${port}  # Windows\n`);
    
    return false;
  }
}

testConnection().then((success) => {
  process.exit(success ? 0 : 1);
});

