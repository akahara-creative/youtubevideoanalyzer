import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { inArray } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  // Reset all pickedUp to 0
  await db.update(ragDocuments).set({ pickedUp: 0 });

  // Set pickedUp = 1 for 1856, 4, 1845, 1841
  const targetIds = [1856, 4, 1845, 1841];
  await db.update(ragDocuments)
    .set({ pickedUp: 1 })
    .where(inArray(ragDocuments.id, targetIds));

  console.log('RAG documents updated for Job 70.');
  
  // Verify
  const picked = await db.select({ id: ragDocuments.id, length: ragDocuments.content })
    .from(ragDocuments)
    .where(inArray(ragDocuments.id, targetIds));
    
  console.log('Currently Picked Up:');
  let totalLen = 0;
  for (const p of picked) {
    console.log(`ID: ${p.id}, Length: ${p.length.length}`);
    totalLen += p.length.length;
  }
  console.log(`Total Length: ${totalLen}`);
}

main();
