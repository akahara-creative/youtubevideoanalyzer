
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function check() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows] = await connection.execute('SELECT id, status, currentStep, LENGTH(analyses) as analyses_len, LENGTH(structure) as structure_len, LENGTH(article) as article_len FROM seoArticleJobs WHERE id = 100');
  console.log(rows);
  await connection.end();
}

check().catch(console.error);
