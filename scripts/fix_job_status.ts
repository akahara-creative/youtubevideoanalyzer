import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  console.log("Fixing Job Statuses...");

  // 1. Resurrect #100 (It is actually running)
  console.log("Resurrecting #100 to 'processing'...");
  await db.update(seoArticleJobs)
    .set({ status: "processing", errorMessage: null })
    .where(eq(seoArticleJobs.id, 100));

  // 2. Cancel #102 and #103 (Noise)
  console.log("Cancelling #102 and #103...");
  await db.update(seoArticleJobs)
    .set({ status: "cancelled", errorMessage: "Duplicate request cancelled" })
    .where(inArray(seoArticleJobs.id, [102, 103]));

  console.log("Status fixed. #100 is now the only active job.");
  process.exit(0);
}

main().catch(console.error);
