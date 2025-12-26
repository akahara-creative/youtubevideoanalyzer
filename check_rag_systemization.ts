import 'dotenv/config';
import { getDb } from './server/db';
import { ragDocuments, ragDocumentTags, tags } from './drizzle/schema';
import { eq, like, or, and } from 'drizzle-orm';

async function checkRagSystemization() {
  const db = await getDb();
  if (!db) {
    console.error('Database connection failed');
    process.exit(1);
  }

  const keyword = "仕組み化";
  console.log(`Checking for RAG documents related to "${keyword}"...`);

  // 1. Check if tag exists
  const tagResults = await db.select().from(tags).where(like(tags.value, `%${keyword}%`));
  console.log(`Found ${tagResults.length} tags matching "${keyword}":`);
  tagResults.forEach(t => console.log(`- ID: ${t.id}, Value: ${t.value}, Display: ${t.displayName}`));

  // 2. Find documents with these tags
  if (tagResults.length > 0) {
    const tagIds = tagResults.map(t => t.id);
    // In drizzle, we can't easily do "inArray" without importing it, so let's loop or use raw query if needed.
    // But for simplicity, let's just iterate.
    for (const tag of tagResults) {
      const docTags = await db.select().from(ragDocumentTags).where(eq(ragDocumentTags.tagId, tag.id));
      console.log(`Found ${docTags.length} documents with tag "${tag.value}" (ID: ${tag.id})`);
      
      if (docTags.length > 0) {
        // Show a sample document
        const sampleDocId = docTags[0].documentId;
        const doc = await db.select().from(ragDocuments).where(eq(ragDocuments.id, sampleDocId));
        if (doc.length > 0) {
           console.log(`Sample Document (ID: ${doc[0].id}):`);
           console.log(doc[0].content.substring(0, 100) + "...");
        }
      }
    }
  }

  // 3. Find documents containing the keyword in content
  const contentResults = await db.select().from(ragDocuments).where(like(ragDocuments.content, `%${keyword}%`)).limit(5);
  console.log(`\nFound ${contentResults.length} documents containing "${keyword}" in content (showing top 5):`);
  contentResults.forEach(d => {
    console.log(`- ID: ${d.id}, Type: ${d.type}`);
    console.log(`  Content: ${d.content.substring(0, 100).replace(/\n/g, ' ')}...`);
  });

  process.exit(0);
}

checkRagSystemization();
