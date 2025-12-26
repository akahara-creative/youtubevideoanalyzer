import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

try {
  // speakerIdカラムを追加
  await connection.query(`
    ALTER TABLE videoGenerationJobs 
    ADD COLUMN speakerId INT DEFAULT 3 
    COMMENT 'VoiceVox speaker ID (デフォルト: 3 = ずんだもん・ノーマル)'
  `);
  console.log('✅ speakerIdカラムを追加しました');
} catch (error) {
  if (error.code === 'ER_DUP_FIELDNAME') {
    console.log('ℹ️  speakerIdカラムは既に存在します');
  } else {
    console.error('❌ エラー:', error.message);
    throw error;
  }
} finally {
  await connection.end();
}
