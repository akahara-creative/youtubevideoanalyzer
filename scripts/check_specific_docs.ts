import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { ragDocuments } from '../drizzle/schema.ts';
import { inArray } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  // Check IDs 4, 5, 7
  const targetIds = [4, 5, 7];
  const docs = await db.select().from(ragDocuments).where(inArray(ragDocuments.id, targetIds));
  
  console.log('Selected Docs:');
  let currentTotal = 0;
  docs.forEach(d => {
    console.log(`ID: ${d.id} | Length: ${d.content.length} chars | Title: ${d.content.substring(0, 30).replace(/\n/g, '')}...`);
    currentTotal += d.content.length;
  });
  
  console.log(`Current Total: ${currentTotal} chars`);
  console.log(`Remaining Budget (Target 25000): ${25000 - currentTotal} chars`);
}

main();
