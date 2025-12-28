import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs } from '../drizzle/schema.ts';
import { processSeoArticleJob } from '../server/seoArticleJobProcessor.ts';

// Force Local LLM settings
process.env.USE_OLLAMA = 'true';
process.env.OLLAMA_MODEL = 'qwen2.5:32b';
// Increase timeout for local LLM
process.env.OLLAMA_TIMEOUT = '600000'; 

async function main() {
  console.log('Starting Local LLM Test with Qwen2.5:32b...');
  const db = await getDb();
  if (!db) {
    console.error('DB connection failed');
    return;
  }

  // Job 33 Data
  const theme = "動画編集で稼げない人が、SNS集客を始めても地獄を見る理由";
  const authorName = "赤原";
  const targetPersona = "30代男性、会社員、副業で動画編集を始めたが稼げずに悩んでいる。将来への不安がある。";
  const keywords = {
    "conclusionKeywords": ["仕組み化","ステップメール","メルマガ","自動化","DRM"],
    "trafficKeywords": ["動画編集 稼げない","動画編集 副業 稼げない","動画編集 SNS集客 稼げない","動画編集 案件 稼げない","動画編集 営業 疲れた","動画編集 下請け","動画編集 スクール 疲弊","動画編集 身バレ リスク","動画編集 炎上 リスク","動画編集 埋もれる","動画編集 テンプレ 埋もれる","動画編集 走り続ける しんどい"],
    "searchKeywords": ["動画編集 稼げない","動画編集 副業 稼げない","動画編集 SNS集客 稼げない","動画編集 案件 稼げない","動画編集 営業 疲れた","動画編集 下請け","動画編集 スクール 疲弊","動画編集 身バレ リスク","動画編集 炎上 リスク","動画編集 埋もれる","動画編集 テンプレ 埋もれる","動画編集 走り続ける しんどい"]
  };

  // Create new job
  const [result] = await db.insert(seoArticleJobs).values({
    userId: 1, // Assuming user ID 1 exists
    theme,
    targetWordCount: 5000,
    authorName,
    targetPersona,
    keywords: JSON.stringify(keywords), // Pre-set keywords to skip research step if possible? 
    // Actually, processSeoArticleJob starts from step 0 usually.
    // If I want to skip research, I should set status/step.
    // But let's run full flow to test local LLM capability on research too.
    // So I'll just pass theme and let it do research.
    // Wait, if I pass keywords, does it skip research?
    // In createJob, keywords are usually empty.
    // Let's just pass theme and let it run from scratch.
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
