import "dotenv/config";
import { eq, or } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db
    .select()
    .from(seoArticleJobs)
    .where(or(eq(seoArticleJobs.id, 95), eq(seoArticleJobs.id, 93)));

  for (const job of jobs) {
    console.log(`\n=== Job ${job.id} ===`);
    console.log(`Theme: ${job.theme}`);
    console.log(`Status: ${job.status}`);
    console.log(`Created: ${job.createdAt}`);
    console.log(`Updated: ${job.updatedAt}`);
    console.log(`Target Word Count: ${job.targetWordCount}`);
    console.log(`Article Length: ${job.article ? job.article.length : 0}`);
    
    if (job.article) {
      console.log(`--- Start of Article ---`);
      console.log(job.article.substring(0, 500));
      console.log(`--- End of Article ---`);
      console.log(job.article.substring(job.article.length - 500));
    } else {
      console.log("(No article content)");
    }
  }
  process.exit(0);
}

main().catch(console.error);
