import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await connection.execute('SHOW TABLES');
console.log('Tables:', rows);

const [analysis] = await connection.execute('SELECT id, status FROM videoAnalyses WHERE id = 240001');
console.log('Analysis:', analysis);

await connection.end();
