import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const result = await connection.query(`
  SELECT id, theme, status, createdAt, updatedAt 
  FROM seo_article_jobs 
  ORDER BY createdAt DESC 
  LIMIT 20
`);

console.log('SEO記事生成履歴（最新20件）:');
console.log(JSON.stringify(result[0], null, 2));

await connection.end();
