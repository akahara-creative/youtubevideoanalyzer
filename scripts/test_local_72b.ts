import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs } from '../drizzle/schema.ts';
import { processSeoArticleJob } from '../server/seoArticleJobProcessor.ts';

// Force Local LLM settings
process.env.USE_OLLAMA = 'true';
process.env.OLLAMA_MODEL = 'qwen2.5:72b';
process.env.OLLAMA_NUM_CTX = '20480'; // 20k context: Fits ~14k docs + generation
process.env.OLLAMA_TIMEOUT = '3600000'; // 60 minutes

async function main() {
  console.log('Starting Local LLM Test (Job 81 - Deep Logic & Persona Check) with Qwen2.5:72b...');
  const db = await getDb();
  if (!db) {
    console.error('DB connection failed');
    return;
  }

  // Job Data
  const theme = "動画編集で稼げない人が、SNS集客を始めても地獄を見る理由";
  const authorName = "赤原";
  const targetPersona = "４０代男性。サラリーマン。妻と子ども２人の４人家族。両親の介護が始まりそうでびくびくして副業に手を出すも、稼げず悩んでいる。";
  
  // Create new job
  const [result] = await db.insert(seoArticleJobs).values({
    userId: 1,
    theme,
    targetWordCount: 5000,
    authorName,
    targetPersona,
    status: 'pending',
    progress: 0,
    currentStep: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }).$returningId();

  const jobId = result.id;
  console.log(`Created Job ID: ${jobId}`);

  // Run processor
  try {
    await processSeoArticleJob(jobId);
    console.log('Job completed successfully');
  } catch (error) {
    console.error('Job failed:', error);
  }
}

main();
