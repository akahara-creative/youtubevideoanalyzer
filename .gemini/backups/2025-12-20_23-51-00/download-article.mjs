
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import fs from "fs/promises";
import path from "path";

// Native fetch is available in Node.js v18+

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

const client = createTRPCClient({
  links: [
    httpBatchLink({
      url: `${BASE_URL}/api/trpc`,
      headers: {
        "x-user-id": "1", // Master user ID for development
      },
      transformer: superjson.default,
    }),
  ],
});

async function main() {
  const jobId = 9; // Target Job ID
  console.log(`Fetching article for Job ID: ${jobId}...`);

  try {
    const job = await client.seoArticle.getJobStatus.query({ jobId });

    if (!job || !job.article) {
      console.error("Article not found or content is empty.");
      return;
    }

    const filename = `seo_article_${jobId}_${new Date().toISOString().split('T')[0]}.md`;
    const outputPath = path.join(process.cwd(), filename);

    // Add some metadata at the top
    const content = `---
title: ${job.theme}
author: ${job.authorName}
date: ${new Date(job.createdAt).toLocaleString()}
job_id: ${job.id}
word_count: ${job.article.length}
---

${job.article}
`;

    await fs.writeFile(outputPath, content, "utf-8");
    console.log(`Successfully saved article to: ${outputPath}`);

  } catch (error) {
    console.error("Error downloading article:", error);
  }
}

main();
