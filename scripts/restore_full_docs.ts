import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { ragDocuments } from '../drizzle/schema.ts';
import { inArray } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  await db.update(ragDocuments)
    .set({ pickedUp: 1 })
    .where(inArray(ragDocuments.id, [4, 1756]));
    
  console.log('Restored ID 4 and 1756');
}

main();
