import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { ragDocuments } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const docs = await db.select().from(ragDocuments).where(eq(ragDocuments.pickedUp, 1));
  console.log(`Number of Priority (pickedUp) Docs: ${docs.length}`);
  
  let totalLength = 0;
  docs.forEach(d => totalLength += d.content.length);
  console.log(`Total Content Length (chars): ${totalLength}`);
}

main();
