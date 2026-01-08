import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  await db.update(seoArticleJobs)
    .set({ status: 'pending', errorMessage: null })
    .where(eq(seoArticleJobs.id, 97));
    
  console.log("Reset Job 97 to pending.");
  process.exit(0);
}

main().catch(console.error);
