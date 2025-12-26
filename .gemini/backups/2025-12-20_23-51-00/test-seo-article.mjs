import "dotenv/config";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

const BASE_URL = process.env.VITE_API_URL || "http://localhost:3000";

import superjson from "superjson";
console.log("superjson:", superjson);


// tRPCクライアントを作成
const trpc = createTRPCClient({
  links: [
    httpBatchLink({
      url: `${BASE_URL}/api/trpc`,
      transformer: superjson.default,
      headers: () => {
        // 認証バイパス用のヘッダー
        const masterOpenId = process.env.MASTER_OPEN_ID || "master-user";
        return {
          "x-user-id": masterOpenId,
        };
      },
    }),
  ],
});

async function testSEOArticle() {
  try {
    console.log("=== SEO記事生成機能のテスト ===\n");

    // テスト用のテーマ
    const testTheme = "YouTubeショート動画の作り方";
    const targetWordCount = 5000; // テスト用に短めに設定
    const authorName = "赤原";

    console.log(`📝 テーマ: ${testTheme}`);
    console.log(`📊 目標文字数: ${targetWordCount}`);
    console.log(`✍️  著者名: ${authorName}\n`);

    // ジョブを作成
    console.log("1️⃣  SEO記事生成ジョブを作成中...");
    const input = {
      theme: testTheme,
      targetWordCount,
      authorName,
      autoEnhance: false,
    };
    const { jobId } = await trpc.seoArticle.createJob.mutate(input);

    console.log(`✅ ジョブが作成されました: Job ID = ${jobId}\n`);

    // ジョブの状態をポーリング
    console.log("2️⃣  ジョブの進行状況を監視中...");
    console.log("（処理には数分かかる可能性があります）\n");

    let lastProgress = 0;
    let lastStep = 0;
    const maxWaitTime = 30 * 60 * 1000; // 30分
    const startTime = Date.now();

    while (true) {
      const status = await trpc.seoArticle.getJobStatus.query({ jobId });

      // 進捗が更新された場合のみ表示
      if (status.progress !== lastProgress || status.currentStep !== lastStep) {
        const stepNames = {
          1: "テーマ決定",
          2: "検索ワード想定",
          3: "上位記事分析",
          4: "SEO基準作成",
          5: "記事構成作成",
          6: "記事生成",
          7: "品質チェック",
          8: "完了",
        };

        const stepName = stepNames[status.currentStep] || `ステップ${status.currentStep}`;
        console.log(`📊 進捗: ${status.progress}% | ステップ: ${stepName} (${status.currentStep}/8)`);

        lastProgress = status.progress;
        lastStep = status.currentStep;
      }

      // 完了または失敗をチェック
      if (status.status === "completed") {
        console.log("\n✅ SEO記事生成が完了しました！\n");
        console.log(`📄 記事の長さ: ${status.article?.length || 0}文字`);
        
        if (status.qualityCheck) {
          const quality = typeof status.qualityCheck === 'string' 
            ? JSON.parse(status.qualityCheck) 
            : status.qualityCheck;
          console.log(`\n📊 品質チェック結果:`);
          console.log(`  - 文字数: ${quality.wordCount || 0}`);
          console.log(`  - H2数: ${quality.h2Count || 0}`);
          console.log(`  - H3数: ${quality.h3Count || 0}`);
          console.log(`  - 合格: ${quality.passed ? "✅" : "❌"}`);
          if (quality.issues && quality.issues.length > 0) {
            console.log(`  - 問題点: ${quality.issues.join(", ")}`);
          }
        }

        // 記事の一部を表示
        if (status.article) {
          console.log(`\n📝 記事の冒頭（最初の500文字）:`);
          console.log("─".repeat(60));
          console.log(status.article.substring(0, 500));
          console.log("─".repeat(60));
        }

        break;
      } else if (status.status === "failed") {
        console.log("\n❌ SEO記事生成が失敗しました");
        console.log(`エラーメッセージ: ${status.errorMessage || "不明なエラー"}`);
        break;
      }

      // タイムアウトチェック
      if (Date.now() - startTime > maxWaitTime) {
        console.log("\n⏰ タイムアウト: 30分経過しました");
        console.log(`現在の状態: ${status.status} (進捗: ${status.progress}%)`);
        break;
      }

      // 3秒待機してから再チェック
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    if (error.message) {
      console.error("エラーメッセージ:", error.message);
    }
    if (error.stack) {
      console.error("スタックトレース:", error.stack);
    }
    process.exit(1);
  }
}

testSEOArticle();


