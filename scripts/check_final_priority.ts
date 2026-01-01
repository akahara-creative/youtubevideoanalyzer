import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { ragDocuments } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const docs = await db.select().from(ragDocuments).where(eq(ragDocuments.pickedUp, 1));
  
  console.log('--- Final Priority Docs ---');
  let totalLength = 0;
  docs.forEach(d => {
    console.log(`ID: ${d.id} | Length: ${d.content.length} | Title: ${d.content.substring(0, 30).replace(/\n/g, '')}...`);
    totalLength += d.content.length;
  });
  console.log(`Total Length: ${totalLength} chars`);
  
  const limit = 25000;
  if (totalLength <= limit) {
    console.log(`SAFE: ${limit - totalLength} chars remaining.`);
  } else {
    console.log(`OVERFLOW: Exceeds limit by ${totalLength - limit} chars.`);
  }
}

main();
