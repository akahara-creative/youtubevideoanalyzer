import "dotenv/config";
import { eq, not, inArray, and, or } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to DB");
    process.exit(1);
  }

  console.log("Cleaning up SEO Job Queue...");

  // 1. Get the ID of the latest job (Job 95) or just keep the most recent one.
  // Actually, let's just keep the job with ID 95 explicitly if we know it.
  // Or better, keep jobs created in the last 10 minutes.
  
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  // Find old pending/processing jobs
  const oldJobs = await db
    .select()
    .from(seoArticleJobs)
    .where(
      and(
        or(eq(seoArticleJobs.status, "pending"), eq(seoArticleJobs.status, "processing")),
        lt(seoArticleJobs.createdAt, tenMinutesAgo)
      )
    );

  console.log(`Found ${oldJobs.length} old jobs to cancel.`);

  if (oldJobs.length > 0) {
    const jobIds = oldJobs.map(j => j.id);
    
    await db
      .update(seoArticleJobs)
      .set({
        status: "cancelled",
        errorMessage: "Cleaned up by system to prioritize new jobs",
        updatedAt: new Date(),
      })
      .where(inArray(seoArticleJobs.id, jobIds));

    console.log(`Cancelled jobs: ${jobIds.join(", ")}`);
  } else {
    console.log("No old jobs found.");
  }

  // Also specifically check Job 24 just in case
  const job24 = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 24));
  if (job24.length > 0 && (job24[0].status === 'pending' || job24[0].status === 'processing')) {
     await db.update(seoArticleJobs).set({ status: 'cancelled' }).where(eq(seoArticleJobs.id, 24));
     console.log("Explicitly cancelled Job 24.");
  }

  process.exit(0);
}

// Helper for 'lt' (less than) since I didn't import it
import { lt } from "drizzle-orm";

main().catch(console.error);
