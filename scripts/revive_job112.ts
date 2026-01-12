
import 'dotenv/config';
import { getSeoArticleJobById, updateSeoArticleJob } from "../server/db";

async function reviveJob112() {
  console.log("Checking Job 112...");
  const job = await getSeoArticleJobById(112);
  if (!job) {
    console.log("Job 112 NOT FOUND.");
    return;
  }
  
  console.log(`Current Status: ${job.status}`);
  
  if (job.status === 'cancelled') {
    console.log("Reviving Job 112 to 'processing'...");
    await updateSeoArticleJob(112, {
      status: 'processing',
      errorMessage: null // Clear error message
    });
    console.log("Job 112 revived.");
  } else {
    console.log("Job 112 is not cancelled. No action needed.");
  }
  process.exit(0);
}

reviveJob112();
