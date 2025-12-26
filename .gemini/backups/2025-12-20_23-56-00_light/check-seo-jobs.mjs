
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

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
      transformer: superjson.default, // Use superjson.default as the transformer
    }),
  ],
});

async function main() {
  console.log("Fetching SEO Article Jobs from database...");

  try {
    const jobs = await client.seoArticle.listJobs.query();

    if (jobs.length === 0) {
      console.log("No jobs found.");
      return;
    }

    console.log(`Found ${jobs.length} jobs:`);
    console.log("----------------------------------------------------------------");
    console.log("| ID | Status     | Theme                                      | Length | Created At          |");
    console.log("----------------------------------------------------------------");

    jobs.forEach((job) => {
      const theme = job.theme.length > 40 ? job.theme.substring(0, 37) + "..." : job.theme.padEnd(40);
      const status = job.status.padEnd(10);
      const length = job.article ? job.article.length.toString().padEnd(6) : "0     ";
      const date = new Date(job.createdAt).toLocaleString();
      
      console.log(`| ${job.id.toString().padEnd(2)} | ${status} | ${theme} | ${length} | ${date} |`);
    });
    console.log("----------------------------------------------------------------");

    // Show details for the latest job
    const latestJob = jobs[0];
    if (latestJob && latestJob.article) {
        console.log("\nLatest Job Details (ID: " + latestJob.id + "):");
        console.log("Theme:", latestJob.theme);
        console.log("Keywords:", latestJob.keywords ? JSON.parse(latestJob.keywords).join(", ") : "None");
        console.log("Article Preview (first 200 chars):");
        console.log(latestJob.article.substring(0, 200) + "...");
    }

  } catch (error) {
    console.error("Error fetching jobs:", error);
  }
}

main();
