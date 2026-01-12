
import { createConnection } from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function inspectJob111() {
  const connection = await createConnection({
    host: 'localhost',
    user: 'root',
    database: 'youtube_analyzer',
    password: process.env.DB_PASSWORD || undefined,
  });

  try {
    const [rows] = await connection.execute(
      'SELECT id, status, article, structure FROM seoArticleJobs WHERE id = 111'
    );

    const jobs = rows as any[];
    if (jobs.length === 0) {
      console.log('Job 111 not found.');
      return;
    }

    const job = jobs[0];
    console.log('Job 111 Status:', job.status);
    console.log('Error:', job.error);
    console.log('Created At:', job.created_at);
    console.log('Updated At:', job.updated_at);

    if (job.structure) {
      const structureObj = JSON.parse(job.structure);
      const structureMd = structureObj.structure || '';
      console.log('\n--- Structure Markdown (First 500 chars) ---');
      console.log(structureMd.substring(0, 500));
      fs.writeFileSync('job_111_structure.md', structureMd);
      console.log('Saved structure to job_111_structure.md');
    }

    if (job.article) {
      console.log('\n--- Article Content (First 500 chars) ---');
      console.log(job.article.substring(0, 500));
      console.log(`\nTotal Length: ${job.article.length} chars`);
      fs.writeFileSync('job_111_article.md', job.article);
      console.log('Saved article to job_111_article.md');
    } else {
      console.log('No article content found.');
    }

  } catch (error) {
    console.error('Error inspecting job:', error);
  } finally {
    await connection.end();
  }
}

inspectJob111();
