import 'dotenv/config';
import { getDb } from '../server/db.ts';
import { ragDocuments } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  await db.update(ragDocuments)
    .set({ pickedUp: 0 })
    .where(eq(ragDocuments.id, 1756));
    
  console.log('Unchecked ID 1756');
}

main();
