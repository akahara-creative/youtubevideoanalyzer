import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { inArray, notInArray } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  // Include #1896 (Flow Template) but exclude #1895 (Garbage)
  const targetIds = [4, 1841, 1856, 1896];

  // 1. Set pickedUp = 1 for target IDs
  await db.update(ragDocuments)
    .set({ pickedUp: 1 })
    .where(inArray(ragDocuments.id, targetIds));

  // 2. Set pickedUp = 0 for others
  await db.update(ragDocuments)
    .set({ pickedUp: 0 })
    .where(notInArray(ragDocuments.id, targetIds));

  console.log(`Updated RAG selection for Job 81.`);
  console.log(`Active IDs: ${targetIds.join(', ')}`);

  // Verify Total Length
  const docs = await db.select().from(ragDocuments).where(inArray(ragDocuments.id, targetIds));
  let totalLength = 0;
  for (const doc of docs) {
    console.log(`ID ${doc.id}: ${doc.content.length} chars`);
    totalLength += doc.content.length;
  }
  console.log(`Total RAG Length: ${totalLength} chars`);
}

main();
