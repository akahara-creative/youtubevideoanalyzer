import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments, tags, ragDocumentTags } from '../drizzle/schema';
import { inArray, eq } from 'drizzle-orm';

async function main() {
  try {
    console.log('Connecting to database...');
    const db = await getDb();
    
    // IDs to inspect
    const targetIds = [1856, 1896, 1841];
    
    console.log(`Fetching RAG documents: ${targetIds.join(', ')}...`);
    
    const docs = await db.select().from(ragDocuments).where(inArray(ragDocuments.id, targetIds));
    
    console.log(`Found ${docs.length} documents.`);
    
    for (const doc of docs) {
      console.log(`\n=== Document ID: ${doc.id} (Type: ${doc.type}) ===`);
      // console.log(`Tags: ${doc.tags ? doc.tags.join(', ') : 'None'}`);
      console.log('--- Content Start ---');
      console.log(doc.content.substring(0, 1000)); // Show first 1000 chars
      console.log('--- Content End ---');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main().catch(console.error).finally(() => process.exit());
