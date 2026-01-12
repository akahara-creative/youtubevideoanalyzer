
import 'dotenv/config';
import { getDb, createSeoArticleJob } from "../server/db";
import { getSeoArticleJobById } from "../server/db";

async function createJob113() {
  console.log("Creating Job 113...");
  const db = await getDb();
  
  // Get Job 112 details
  const job112 = await getSeoArticleJobById(112);
  if (!job112) {
    console.error("Job 112 not found!");
    process.exit(1);
  }

  // Create Job 113
  const newJobId = await createSeoArticleJob({
    userId: job112.userId,
    theme: job112.theme,
    keywords: job112.keywords,
    targetWordCount: job112.targetWordCount,
    authorName: job112.authorName,
    remarks: job112.remarks, // Keep remarks (Akahara Logic intent)
    offer: job112.offer
  });

  console.log(`Created Job 113 (ID: ${newJobId})`);
  console.log(`Theme: ${job112.theme}`);
  console.log(`Status: processing`);
  
  process.exit(0);
}

createJob113();
