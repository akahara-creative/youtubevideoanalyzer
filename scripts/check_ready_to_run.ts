import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { ragDocuments } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const docs = await db.select().from(ragDocuments).where(eq(ragDocuments.pickedUp, 1));
  
  console.log('--- READY TO RUN: Current Priority Docs ---');
  let totalLength = 0;
  docs.forEach(d => {
    console.log(`ID: ${d.id} | Length: ${d.content.length} | Title: ${d.content.substring(0, 30).replace(/\n/g, '')}...`);
    totalLength += d.content.length;
  });
  console.log(`Total Length: ${totalLength} chars`);
  
  const expectedIds = [4, 5, 1756, 1766];
  const currentIds = docs.map(d => d.id).sort((a, b) => a - b);
  const missing = expectedIds.filter(id => !currentIds.includes(id));
  const extra = currentIds.filter(id => !expectedIds.includes(id));
  
  if (missing.length === 0 && extra.length === 0) {
    console.log('STATUS: PERFECT MATCH');
  } else {
    console.log('STATUS: MISMATCH');
    if (missing.length > 0) console.log(`Missing IDs: ${missing.join(', ')}`);
    if (extra.length > 0) console.log(`Extra IDs: ${extra.join(', ')}`);
  }
}

main();
