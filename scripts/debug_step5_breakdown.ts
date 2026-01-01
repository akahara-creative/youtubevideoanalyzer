import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { inArray } from 'drizzle-orm';
import { getStructureSystemPromptLocal } from '../server/prompts/seoPrompts';
import { SEOCriteria } from '../server/seoArticleGenerator';

async function main() {
  const db = await getDb();
  if (!db) return;

  const targetIds = [1856, 4, 1845, 1841];
  const docs = await db.select().from(ragDocuments).where(inArray(ragDocuments.id, targetIds));
  
  // Sort docs to match the order we likely use (or just sum them)
  // Let's print individual lengths
  let ragTotal = 0;
  let ragContext = "";
  
  console.log('\n--- RAG Breakdown ---');
  for (const doc of docs) {
    console.log(`ID ${doc.id}: ${doc.content.length} chars`);
    ragTotal += doc.content.length;
    ragContext += `\n\n--- Document ID ${doc.id} ---\n${doc.content}`;
  }
  console.log(`RAG Context Overhead (headers): ${ragContext.length - ragTotal} chars`);
  console.log(`Total RAG Context: ${ragContext.length} chars`);

  const authorName = "赤原";
  const seoCriteria: SEOCriteria = {
    targetKeywords: ["動画編集 稼げない", "SNS集客 失敗"],
    targetWordCount: 5000,
    targetH2Count: 7,
    targetH3Count: 15,
    searchIntent: "稼げない現状を変えたい",
    targetAudience: "動画編集者",
    competitorAnalysis: "競合はノウハウばかり書いている"
  };
  const remarks = "特になし";
  const offer = "メルマガ登録";

  // Generate Prompt WITHOUT RAG to measure System Prompt size
  const emptyRagPrompt = getStructureSystemPromptLocal(authorName, seoCriteria, "", remarks, offer);
  console.log(`\n--- System Prompt Breakdown ---`);
  console.log(`System Prompt (Template + Variables): ${emptyRagPrompt.length} chars`);

  // Total
  const fullPrompt = getStructureSystemPromptLocal(authorName, seoCriteria, ragContext, remarks, offer);
  console.log(`\n--- Total ---`);
  console.log(`Full Prompt: ${fullPrompt.length} chars`);
  console.log(`(Check: ${ragContext.length} + ${emptyRagPrompt.length} = ${ragContext.length + emptyRagPrompt.length})`);
}

main();
