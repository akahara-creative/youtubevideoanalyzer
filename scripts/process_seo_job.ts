import 'dotenv/config';
import { processSeoArticleJob } from '../server/seoArticleJobProcessor';
import { getDb } from '../server/db';

// Force Local LLM settings (ensure they are passed from parent or set here)
// We rely on the parent process (Worker) to pass env vars, or .env file.
// But explicitly setting critical ones is safer if they are missing.
if (!process.env.OLLAMA_NUM_CTX) {
  process.env.OLLAMA_NUM_CTX = '20480';
}
if (!process.env.OLLAMA_TIMEOUT) {
  process.env.OLLAMA_TIMEOUT = '3600000';
}

async function main() {
  const args = process.argv.slice(2);
  const jobId = parseInt(args[0], 10);

  if (isNaN(jobId)) {
    console.error('Usage: npx tsx scripts/process_seo_job.ts <JOB_ID>');
    process.exit(1);
  }

  console.log(`[ChildProcess] Starting SEO Job ${jobId}`);
  console.log(`[ChildProcess] OLLAMA_NUM_CTX: ${process.env.OLLAMA_NUM_CTX}`);

  const db = await getDb();
  if (!db) {
    console.error('[ChildProcess] DB connection failed');
    process.exit(1);
  }

  try {
    await processSeoArticleJob(jobId);
    console.log(`[ChildProcess] Job ${jobId} completed successfully`);
    process.exit(0);
  } catch (error) {
    console.error(`[ChildProcess] Job ${jobId} failed:`, error);
    process.exit(1);
  }
}

main();
