import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  // Set pickedUp = 1 for 4, 5, 1756, 1840
  await db.update(ragDocuments)
    .set({ pickedUp: 1 })
    .where(inArray(ragDocuments.id, [4, 5, 1756, 1840]));

  // Set pickedUp = 0 for 1766
  await db.update(ragDocuments)
    .set({ pickedUp: 0 })
    .where(eq(ragDocuments.id, 1766));

  console.log('RAG documents updated for Job 69.');
  
  // Verify
  const picked = await db.select({ id: ragDocuments.id, length: ragDocuments.content })
    .from(ragDocuments)
    .where(eq(ragDocuments.pickedUp, 1));
    
  console.log('Currently Picked Up:');
  let totalLen = 0;
  for (const p of picked) {
    console.log(`ID: ${p.id}, Length: ${p.length.length}`);
    totalLen += p.length.length;
  }
  console.log(`Total Length: ${totalLen}`);
}

main();
