import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  // Reset Job 95
  await db
    .update(seoArticleJobs)
    .set({
      status: "pending",
      currentStep: 1, // Restart from beginning
      progress: 0,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(seoArticleJobs.id, 95));

  console.log("Reset Job 95 to pending.");
  process.exit(0);
}

main().catch(console.error);
