import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { ragDocuments } from '../drizzle/schema.ts';
import { desc } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const docs = await db.select().from(ragDocuments).orderBy(desc(ragDocuments.createdAt)).limit(5);
  
  docs.forEach(d => {
    console.log(`ID: ${d.id}, SourceId: ${d.sourceId}, CreatedAt: ${d.createdAt}`);
    if (d.sourceId && d.sourceId.includes('ローカルモードテスト')) {
      console.log('\n--- Content Preview ---');
      console.log(d.content.substring(0, 500));
    }
  });
}

main();
