
import 'dotenv/config';
import { processSeoArticleJob } from "./server/seoArticleJobProcessor";
import { getDb } from "./server/db";

async function main() {
  console.log("Resuming Job 23...");
  try {
    await processSeoArticleJob(23);
    console.log("Job 23 finished (or at least the process function returned).");
  } catch (error) {
    console.error("Error resuming job:", error);
  }
  process.exit(0);
}

main();
