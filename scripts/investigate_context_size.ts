
import 'dotenv/config';
import { getDb } from "../server/db";
import { ragDocuments, ragDocumentTags, tags } from "../drizzle/schema";
import { eq, inArray, and, notInArray } from "drizzle-orm";

async function investigateContextSize() {
  console.log("Starting Context Size Investigation...");
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to DB");
    return;
  }

  // 1. Analyze RAG Context (pickedUp = 1)
  const priorityDocs = await db.select().from(ragDocuments).where(eq(ragDocuments.pickedUp, 1));
  console.log(`\n[RAG Context] Priority Docs (pickedUp=1): ${priorityDocs.length} docs`);
  
  let ragContextLength = 0;
  const priorityDocIds: number[] = [];
  
  for (const doc of priorityDocs) {
    ragContextLength += doc.content.length;
    priorityDocIds.push(doc.id);
    console.log(`  - ID ${doc.id}: ${doc.content.length} chars`);
  }
  console.log(`  > Total RAG Context (Priority Docs): ${ragContextLength} chars`);

  // 2. Analyze Writer Persona (Voice Samples)
  // Logic from generateWriterPersona: Tag="赤原", Exclude 1856, 1896, 1841, Limit 20
  const akaharaTags = await db.select().from(tags).where(eq(tags.displayName, "赤原"));
  if (akaharaTags.length === 0) {
    console.error("Tag '赤原' not found");
    return;
  }
  const tagId = akaharaTags[0].id;

  const voiceDocs = await db.select({
    id: ragDocuments.id,
    content: ragDocuments.content
  })
  .from(ragDocuments)
  .innerJoin(ragDocumentTags, eq(ragDocuments.id, ragDocumentTags.documentId))
  .where(and(
    eq(ragDocumentTags.tagId, tagId),
    notInArray(ragDocuments.id, [1856, 1896, 1841])
  ))
  .limit(20);

  console.log(`\n[Writer Persona] Voice Docs (Tag='赤原', Limit 20): ${voiceDocs.length} docs`);
  
  let personaContextLength = 0;
  const voiceDocIds: number[] = [];
  
  for (const doc of voiceDocs) {
    // cleanContent logic simulation (remove HTML tags roughly)
    const cleaned = doc.content.replace(/<[^>]*>/g, '').trim();
    personaContextLength += cleaned.length;
    voiceDocIds.push(doc.id);
    // console.log(`  - ID ${doc.id}: ${cleaned.length} chars`);
  }
  console.log(`  > Total Writer Persona Description: ~${personaContextLength} chars`);

  // 3. Analyze Overlap (Duplication)
  const overlapIds = priorityDocIds.filter(id => voiceDocIds.includes(id));
  console.log(`\n[Duplication Analysis]`);
  console.log(`  > Overlapping IDs (In BOTH RAG and Persona): ${overlapIds.join(', ')}`);
  
  let duplicationLength = 0;
  for (const id of overlapIds) {
    const doc = priorityDocs.find(d => d.id === id);
    if (doc) duplicationLength += doc.content.length;
  }
  console.log(`  > Wasted Space (Duplication): ${duplicationLength} chars`);

  // 4. Competitor Context Estimate
  const competitorContextLength = 10 * 1000; // 10 docs * 1000 chars
  console.log(`\n[Competitor Context] Estimated: ${competitorContextLength} chars`);

  // 5. Other Components Estimate
  const systemPromptLength = 2000;
  const structureLength = 3000;
  const historyLength = 3000;
  const otherRAGLength = 2000; // (PainPoints, etc.)
  
  // 6. Total Calculation
  const totalChars = 
    ragContextLength + 
    competitorContextLength + 
    personaContextLength + 
    systemPromptLength + 
    structureLength + 
    historyLength + 
    otherRAGLength;

  console.log(`\n[Total Context Size Estimate]`);
  console.log(`  RAG Priority Docs: ${ragContextLength}`);
  console.log(`  Competitor Summaries: ${competitorContextLength}`);
  console.log(`  Writer Persona: ${personaContextLength}`);
  console.log(`  System Prompt: ${systemPromptLength}`);
  console.log(`  Structure: ${structureLength}`);
  console.log(`  Previous Context: ${historyLength}`);
  console.log(`  Other (PainPoints etc): ${otherRAGLength}`);
  console.log(`  --------------------------------`);
  console.log(`  TOTAL CHARACTERS: ${totalChars}`);
  
  // Token Estimate (Conservative: 1 char = 1 token for Japanese mixed)
  // Qwen 2.5 tokenizer is efficient, maybe 0.8 tokens/char?
  // But let's use 1.0 for safety.
  console.log(`  TOTAL TOKENS (Est 1.0/char): ${Math.ceil(totalChars * 1.0)}`);
  console.log(`  TOTAL TOKENS (Est 0.8/char): ${Math.ceil(totalChars * 0.8)}`);
  
  const limit = 20480;
  console.log(`\n[Verdict]`);
  if (totalChars * 0.8 > limit) {
    console.log(`  🚨 DANGER: Likely exceeded 20k tokens! (${Math.ceil(totalChars * 0.8)} > ${limit})`);
  } else if (totalChars * 1.0 > limit) {
    console.log(`  ⚠️ WARNING: Close to limit, depends on tokenizer. (${Math.ceil(totalChars * 1.0)} > ${limit})`);
  } else {
    console.log(`  ✅ SAFE: Should fit. (${Math.ceil(totalChars * 1.0)} < ${limit})`);
  }
  
  process.exit(0);
}

investigateContextSize();
