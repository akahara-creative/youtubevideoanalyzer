import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  // 1. Restore Job 95
  console.log("Restoring Job 95...");
  await db
    .update(seoArticleJobs)
    .set({
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(seoArticleJobs.id, 95));
  console.log("Job 95 restored to 'completed'.");

  // 2. Clone Job 95 to Job 96
  console.log("Creating Job 96 (Clone of 95)...");
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
    
    // Get the new ID (should be 96, but we check)
    const insertId = Array.isArray(result) ? result[0].insertId : result.insertId;
    console.log(`Job ${insertId} created.`);
  }

  process.exit(0);
}

main().catch(console.error);
