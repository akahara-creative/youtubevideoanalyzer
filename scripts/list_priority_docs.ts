import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { ragDocuments } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const docs = await db.select().from(ragDocuments).where(eq(ragDocuments.pickedUp, 1));
  
  console.log('Current Priority Docs:');
  docs.forEach(d => {
    console.log(`ID: ${d.id} | Length: ${d.content.length} chars | Title: ${d.content.substring(0, 30).replace(/\n/g, '')}...`);
  });
  
  const total = docs.reduce((sum, d) => sum + d.content.length, 0);
  console.log(`Total: ${total} chars`);
}

main();
