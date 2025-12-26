import { getDb } from './server/db.js';

const db = await getDb();
const result = await db.execute('SELECT id, theme, article FROM seoArticleJobs ORDER BY createdAt DESC LIMIT 1');
const article = result[0][0].article;
console.log(article);
