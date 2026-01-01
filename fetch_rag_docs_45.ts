
import { getDb } from './server/db';
import { ragDocuments } from './drizzle/schema';
import { eq, inArray } from 'drizzle-orm';
import fs from 'fs';
import 'dotenv/config';

async function main() {
  const db = await getDb();
  if (!db) {
    console.error('Database connection failed');
    return;
  }

  const docs = await db.select().from(ragDocuments).where(inArray(ragDocuments.id, [4, 5]));

  for (const doc of docs) {
    console.log(`\n--- Document ID: ${doc.id} ---`);
    console.log(doc.content);
    fs.writeFileSync(`rag_doc_${doc.id}.txt`, doc.content);
  }
}

main().catch(console.error);
