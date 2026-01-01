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
  
  let ragContext = "";
  for (const doc of docs) {
    ragContext += `\n\n--- Document ID ${doc.id} ---\n${doc.content}`;
  }

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

  const prompt = getStructureSystemPromptLocal(authorName, seoCriteria, ragContext, remarks, offer);

  console.log(`\n--- ANALYSIS ---`);
  console.log(`Total Prompt Length: ${prompt.length} characters`);
  console.log(`Estimated Tokens (Chars / 0.7): ${Math.ceil(prompt.length / 0.7)}`);
  console.log(`Is > 20000 chars? ${prompt.length > 20000 ? 'YES' : 'NO'}`);
}

main();
