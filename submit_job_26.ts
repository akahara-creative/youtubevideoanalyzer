
import "dotenv/config";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

const BASE_URL = process.env.VITE_API_URL || "http://localhost:3000";

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

async function submitJob26() {
  try {
    console.log("=== Job 26 Submission (Verification) ===\n");

    const testTheme = "YouTubeショート動画の作り方";
    const targetWordCount = 20000;
    const authorName = "赤原";

    console.log(`📝 Theme: ${testTheme}`);
    console.log(`📊 Target Word Count: ${targetWordCount}`);
    console.log(`✍️  Author: ${authorName}\n`);

    console.log("1️⃣  Creating Job...");
    const input = {
      theme: testTheme,
      targetWordCount,
      authorName,
      autoEnhance: false,
    };
    const { jobId } = await trpc.seoArticle.createJob.mutate(input);

    console.log(`✅ Job Created: Job ID = ${jobId}\n`);
    console.log("Exiting. Use check_latest_job.ts to monitor.");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

submitJob26();
