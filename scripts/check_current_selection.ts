import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { ragDocuments } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const docs = await db.select().from(ragDocuments).where(eq(ragDocuments.pickedUp, 1));
  
  console.log('--- Current Priority Docs ---');
  let totalLength = 0;
  docs.forEach(d => {
    console.log(`ID: ${d.id} | Length: ${d.content.length} | Title: ${d.content.substring(0, 30).replace(/\n/g, '')}...`);
    totalLength += d.content.length;
  });
  console.log(`Total Length: ${totalLength} chars`);
  
  // Check ID 4 specifically (if not in list)
  const doc4 = await db.select().from(ragDocuments).where(eq(ragDocuments.id, 4)).limit(1);
  if (doc4.length > 0) {
    console.log(`ID 4 Length: ${doc4[0].content.length} chars`);
  }
}

main();
