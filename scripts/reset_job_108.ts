import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function resetJob108() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'youtube_analyzer',
  });

  try {
    console.log('Resetting Job 108...');
    const [result] = await connection.execute(
      'UPDATE seoArticleJobs SET status = ?, errorMessage = ?, progress = ?, currentStep = ?, updatedAt = ? WHERE id = ?',
      ['pending', null, 0, 1, new Date(), 108]
    );
    
    console.log('Job 108 reset successfully:', result);
  } catch (error) {
    console.error('Failed to reset job:', error);
  } finally {
    await connection.end();
  }
}

resetJob108();
