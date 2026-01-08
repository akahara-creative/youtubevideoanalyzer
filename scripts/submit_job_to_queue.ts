import "dotenv/config";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to DB");
    process.exit(1);
  }

  console.log("Submitting Job 94 to Queue...");

  // Job 94 Configuration
  // Theme: 案件をとっても、SNS集客しても、動画編集で稼げない人へ
  // Target: 20000 chars
  // Persona: 40代男性...
  
  const result = await db.insert(seoArticleJobs).values({
    userId: 1, // Assuming User ID 1 exists
    theme: "案件をとっても、SNS集客しても、動画編集で稼げない人へ",
    targetWordCount: 20000,
    authorName: "赤原",
    autoEnhance: 1, // Enable enhancement
    status: "pending", // Worker will pick this up
    currentStep: 1,
    progress: 0,
    targetPersona: "40代男性。サラリーマン。妻と子ども２人の４人家族。両親の介護が始まりそうでびくびくして副業に手を出すも、稼げず悩んでいる。",
    offer: "メルマガ登録",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Drizzle insert result handling
  const insertId = Array.isArray(result) && result[0]?.insertId 
    ? Number(result[0].insertId) 
    : (result as any).insertId 
    ? Number((result as any).insertId)
    : NaN;

  console.log(`Job Submitted! ID: ${insertId}`);
  console.log("The Server Worker should pick this up automatically.");
  process.exit(0);
}

main().catch(console.error);
