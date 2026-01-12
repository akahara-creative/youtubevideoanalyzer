
import 'dotenv/config';
import { updateSeoArticleJob } from "../server/db";

async function cancelJob113() {
  console.log("Cancelling Job 113...");
  await updateSeoArticleJob(113, {
    status: 'cancelled',
    errorMessage: 'Cancelled by user request'
  });
  console.log("Job 113 cancelled.");
  process.exit(0);
}

cancelJob113();
