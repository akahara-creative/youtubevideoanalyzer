
import { getDb } from './server/db';
import { ragDocuments } from './drizzle/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import 'dotenv/config';

async function fetchRagDoc() {
  const db = await getDb();
  const doc = await db.select().from(ragDocuments).where(eq(ragDocuments.id, 1326)).limit(1);
  
  if (doc.length > 0) {
    fs.writeFileSync('temp_reference_article.txt', doc[0].content);
    console.log("Saved content to temp_reference_article.txt");
  } else {
    console.log("Document not found");
  }
  process.exit(0);
}

fetchRagDoc();
