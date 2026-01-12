
import 'dotenv/config';
import { updateSeoArticleJob } from "../server/db";

async function cancelJob112() {
  console.log("Cancelling Job 112...");
  try {
    await updateSeoArticleJob(112, {
      status: 'cancelled',
      errorMessage: 'Cancelled by user request during investigation.'
    });
    console.log("Job 112 status updated to 'cancelled'.");
  } catch (e) {
    console.error("Failed to cancel Job 112:", e);
  }
  process.exit(0);
}

cancelJob112();
