import "dotenv/config";
import { inArray } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  console.log("Cancelling all pending/processing jobs...");
  
  await db.update(seoArticleJobs)
    .set({ status: "cancelled", errorMessage: "User requested cleanup of concurrent jobs" })
    .where(inArray(seoArticleJobs.status, ["pending", "processing"]));
    
  console.log("All active jobs cancelled.");
  process.exit(0);
}

main().catch(console.error);
