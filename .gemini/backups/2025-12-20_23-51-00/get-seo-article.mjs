import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
// fetch is built-in in recent Node.js versions

const BASE_URL = process.env.VITE_API_URL || "http://localhost:3001";

const trpc = createTRPCClient({
  links: [
    httpBatchLink({
      url: `${BASE_URL}/api/trpc`,
      headers: {
        "x-user-id": "master-user",
      },
      transformer: superjson.default,
    }),
  ],
});

async function main() {
  const jobId = 9; // The ID from the successful Claude run
  console.log(`Fetching article for Job ID: ${jobId}...`);

  try {
    const job = await trpc.seoArticle.getJobStatus.query({ jobId });
    
    if (job.status === "completed" && job.article) {
      console.log("\n=== Generated Article ===\n");
      console.log(job.article);
      console.log("\n=========================\n");
    } else {
      console.log(`Job status: ${job.status}`);
      if (job.errorMessage) {
        console.error(`Error: ${job.errorMessage}`);
      } else {
        console.log("Article content not found or job not completed.");
      }
    }
  } catch (error) {
    console.error("Error fetching article:", error);
  }
}

main();
