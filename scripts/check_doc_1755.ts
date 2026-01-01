import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { ragDocuments } from '../drizzle/schema.ts';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  // Check ID 1755
  const newDoc = await db.select().from(ragDocuments).where(eq(ragDocuments.id, 1755)).limit(1);
  
  if (newDoc.length > 0) {
    const d = newDoc[0];
    console.log(`ID: ${d.id}`);
    console.log(`Title: ${d.content.substring(0, 50).replace(/\n/g, '')}...`);
    console.log(`Length: ${d.content.length} chars`);
    console.log(`PickedUp: ${d.pickedUp}`);
    console.log('--- Content Preview ---');
    console.log(d.content.substring(0, 500));
  } else {
    console.log('ID 1755 not found');
  }

  // Check Total Priority Docs (should be 4, 5, 7, 1755)
  const priorityDocs = await db.select().from(ragDocuments).where(eq(ragDocuments.pickedUp, 1));
  console.log('\n--- Current Priority Docs ---');
  let totalLength = 0;
  priorityDocs.forEach(d => {
    console.log(`ID: ${d.id} | Length: ${d.content.length}`);
    totalLength += d.content.length;
  });
  console.log(`Total Priority Length: ${totalLength} chars`);
}

main();
