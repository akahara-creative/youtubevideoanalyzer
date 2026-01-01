import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';

async function main() {
  const db = await getDb();
  if (!db) return;

  const content = `ネットにあるのは全て労働収入でしかない。
使い捨てられて終わるよ。
だからこそ、ネットで資産を作ろう。
使い方をメルマガで教えるよ。`;

  const [result] = await db.insert(ragDocuments).values({
    content: content,
    type: 'summary',
    pickedUp: 1, // Mark as picked up immediately
    createdAt: new Date(),
    updatedAt: new Date()
  }).$returningId();

  console.log(`Created new RAG document with ID: ${result.id}`);
  console.log('Content:');
  console.log(content);
}

main();
