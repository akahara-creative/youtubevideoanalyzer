import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments, tags, ragDocumentTags } from '../drizzle/schema';
import { inArray, eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const akaharaTags = await db.select().from(tags).where(eq(tags.displayName, "赤原"));
  if (akaharaTags.length === 0) return;
  const tagId = akaharaTags[0].id;

  const docs = await db.select({
    content: ragDocuments.content,
    id: ragDocuments.id,
    type: ragDocuments.type
  })
  .from(ragDocuments)
  .innerJoin(ragDocumentTags, eq(ragDocuments.id, ragDocumentTags.documentId))
  .where(eq(ragDocumentTags.tagId, tagId));
  
  docs.forEach(doc => {
    if (doc.content.includes("MyASP")) {
      console.log(`!!! ID ${doc.id} Contains MyASP !!!`);
    }
  });
}

main().catch(console.error).finally(() => process.exit());
