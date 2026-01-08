import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  // Clone Job 95 (The original source) to Job 100
  console.log("Creating Job 100 (Clone of 95)...");
  const job95 = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 95));
  
  if (job95.length > 0) {
    const source = job95[0];
    const result = await db.insert(seoArticleJobs).values({
      userId: source.userId,
      theme: source.theme,
      targetKeyword: source.targetKeyword,
      targetPersona: source.targetPersona,
      authorName: source.authorName,
      remarks: source.remarks,
      offer: source.offer,
      targetWordCount: source.targetWordCount,
      status: "pending", // Start as pending
      autoEnhance: source.autoEnhance,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    const insertId = Array.isArray(result) ? result[0].insertId : result.insertId;
    console.log(`Job ${insertId} created successfully.`);
  }

  process.exit(0);
}

main().catch(console.error);
