import 'dotenv/config';
import { getMysqlPool } from '../server/db.ts';

async function main() {
  const pool = await getMysqlPool();
  if (!pool) return;

  console.log('Fixing timestamps for jobs >= 40...');
  
  // Subtract 9 hours from createdAt and updatedAt for jobs 40 to 48
  // This assumes the data was stored as "Future JST" (UTC + 9 displayed as UTC + 9 + 9)
  // Wait, if it's stored as "20:45" (JST value) and treated as UTC...
  // Then retrieved as "20:45 UTC" -> +9 -> "05:45 JST".
  // To make it display "20:45 JST", we need the retrieval to be "11:45 UTC" -> +9 -> "20:45 JST".
  // So we need to subtract 9 hours from the stored value.
  // "20:45" -> "11:45".
  
  try {
    const [result] = await pool.execute(`
      UPDATE seoArticleJobs 
      SET createdAt = DATE_SUB(createdAt, INTERVAL 9 HOUR),
          updatedAt = DATE_SUB(updatedAt, INTERVAL 9 HOUR)
      WHERE id >= 40 AND id <= 48
    `);
    console.log('Result:', result);
  } catch (error) {
    console.error('Failed to update:', error);
  }
  
  process.exit(0);
}

main();
