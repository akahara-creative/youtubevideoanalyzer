import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { seoArticleJobs, ragDocuments } from '../drizzle/schema.ts';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobId = 64;
  const job = (await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, jobId)).limit(1))[0];
  
  if (!job) {
    console.log('Job 64 not found');
    return;
  }

  // Simulate RAG Context Construction
  const ragDocs = await db.select()
    .from(ragDocuments)
    .where(eq(ragDocuments.pickedUp, 1));
    
  let ragContext = '';
  if (ragDocs.length > 0) {
    ragContext = ragDocs.map(doc => `### RAGドキュメント\n${doc.content}`).join('\n\n---\n\n') + '\n\n';
  }
  
  console.log(`RAG Docs Count: ${ragDocs.length}`);
  console.log(`RAG Docs IDs: ${ragDocs.map(d => d.id).join(', ')}`);
  console.log(`ragContext Length (Docs Only): ${ragContext.length}`);
  
  // Competitor Context
  // In the code, we check competitorDocIds.
  // Job 64 likely has none.
  
  // Fallback Logic (The one I commented out)
  // I need to check if the code running on server actually has it commented out.
  // I can't check the running memory, but I can check the file on disk.
  // I already checked the file on disk with `replace_file_content`.
  
  // Pain Points etc.
  const painPoints = JSON.parse(job.painPoints || '[]');
  const storyKeywords = JSON.parse(job.storyKeywords || '[]');
  const offerBridge = JSON.parse(job.offerBridge || '[]');
  const realVoices = JSON.parse(job.realVoices || '[]');
  
  ragContext += `\n\n### 読者の痛み・報われない希望\n${painPoints.join('\n')}\n\n### 生の声\n${realVoices.join('\n')}\n\n### 苦労したエピソードに繋げやすいキーワード\n${storyKeywords.join('\n')}\n\n### オファーへの橋渡し\n${offerBridge.join('\n')}`;
  
  console.log(`Final ragContext Length: ${ragContext.length}`);
}

main();
