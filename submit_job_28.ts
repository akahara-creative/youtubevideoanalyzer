
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

async function submitJob28() {
  try {
    console.log("=== Job 28 Submission (Strict Structure Adherence) ===\n");

    const theme = "案件をとっても、SNS集客しても、動画編集で稼げない人へ";
    const targetWordCount = 20000;
    const authorName = "赤原";
    
    // User provided details (Same as Job 27)
    const targetPersona = `40代男性。サラリーマン。妻と子ども２人の４人家族。両親の介護が始まりそうでびくびくして副業に手を出すも、稼げず悩んでいる。`;
    
    const remarks = `
〇：要件
自分のコミュニティーに来た人から相談された内容として書いてください。『その人は、動画編集界隈で苦しんでいた。ただ、メルマガで書いているとある事を教えた結果、人生の自由が得られた。この記事は、もしもあの時、動画界隈から出なかったらゾッとする。そう言われた内容をまとめた内容です。』そんなスタンスで書いてください。

〇：書いて欲しい内容
動画編集は、結局のところ案件をもらう下請けでしかない。結果、営業を辞めることもできないし、走り続けるしかない。それはSNSの投稿も同じ。真似・パクリ・テンプレで埋もれることが前提。結果知名度を上げるしかないが、それは炎上リスクでもあり身バレリスクでもある。スクールをするにも人間関係で疲弊する。だから、手離れする仕組み化がおすすめ。そんな記事にして下さい。仕組み化とか、そっち系でSEOのキーワードを並べるのではなく、動画編集　副業とかそっちでSEOキーワードを積み上げて下さい。仕組み化の詳細な解説はしなくていいです。むしろ、仕組み化を学びたい！という気分にして、メルマガに登録する。そんな流れをつくって下さい。

オファー：メルマガ登録』これで、テストを行っています。文字数は、変わらず２００００でお願いします。
`;

    const offer = "メルマガ登録";

    console.log(`📝 Theme: ${theme}`);
    console.log(`📊 Target Word Count: ${targetWordCount}`);
    console.log(`👤 Persona: ${targetPersona}`);
    console.log(`🎁 Offer: ${offer}`);
    console.log(`ℹ️  Remarks: (See script for details)\n`);

    console.log("1️⃣  Creating Job...");
    const input = {
      theme,
      targetWordCount,
      authorName,
      targetPersona,
      remarks,
      offer,
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

submitJob28();
