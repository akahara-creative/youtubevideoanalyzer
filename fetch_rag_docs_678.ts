
import { getDb } from './server/db';
import { ragDocuments } from './drizzle/schema';
import { inArray } from 'drizzle-orm';
import fs from 'fs';
import 'dotenv/config';

async function fetchRagDocs() {
  const db = await getDb();
  const docs = await db.select().from(ragDocuments).where(inArray(ragDocuments.id, [6, 7, 8]));
  
  if (docs.length > 0) {
    docs.forEach(doc => {
      fs.writeFileSync(`rag_doc_${doc.id}.txt`, doc.content);
      console.log(`Saved content to rag_doc_${doc.id}.txt`);
    });
  } else {
    console.log("Documents not found");
  }
  process.exit(0);
}

fetchRagDocs();
