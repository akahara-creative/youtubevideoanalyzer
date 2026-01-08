import "dotenv/config";
import { isNotNull, ne, and } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  console.log("Rescuing jobs with content...");

  // Find jobs that have content but are not completed
  const jobsToRescue = await db
    .select()
    .from(seoArticleJobs)
    .where(
      and(
        isNotNull(seoArticleJobs.article),
        ne(seoArticleJobs.article, ""),
        ne(seoArticleJobs.status, "completed")
      )
    );

  console.log(`Found ${jobsToRescue.length} jobs to rescue.`);

  for (const job of jobsToRescue) {
    console.log(`Rescuing Job ${job.id} (${job.article?.length} chars)...`);
    
    await db
      .update(seoArticleJobs)
      .set({
        status: "completed",
        errorMessage: null, // Clear error
        updatedAt: new Date(),
      })
      .where(eq(seoArticleJobs.id, job.id));
  }

  console.log("Rescue complete.");
  process.exit(0);
}

// Helper for 'eq'
import { eq } from "drizzle-orm";

main().catch(console.error);
