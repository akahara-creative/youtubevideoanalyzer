import 'dotenv/config';
import { getDb } from './server/db';
import { sql } from 'drizzle-orm';

async function checkSchema() {
  const db = await getDb();
  if (!db) {
    console.error('Failed to connect to DB');
    return;
  }

  try {
    const result = await db.execute(sql`SHOW COLUMNS FROM seoArticleJobs`);
    console.log('Columns in seoArticleJobs:');
    // @ts-ignore
    result[0].forEach((col: any) => {
      console.log(`- ${col.Field} (${col.Type})`);
    });
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkSchema();
