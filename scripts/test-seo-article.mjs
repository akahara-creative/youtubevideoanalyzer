import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

// global.fetch is available in Node 18+

const client = createTRPCProxyClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      transformer: superjson.default,
    }),
  ],
});

async function main() {
  try {
    console.log("Starting SEO article job...");
    const job = await client.seoArticle.createJob.mutate({
      theme: "動画編集 副業 始め方",
      targetWordCount: 8000,
      authorName: "赤原"
    });
    console.log("Job started:", job);

    const jobId = job.jobId;

    // Poll status
    const interval = setInterval(async () => {
      try {
        const status = await client.seoArticle.getJobStatus.query({ jobId: jobId });
        console.log(`Job ${jobId}: Step ${status.currentStep} - ${status.status} (${status.progress}%)`);
        
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          console.log("Job finished:", status);
          if (status.status === 'completed') {
             console.log("Quality Check:", status.qualityCheck);
             try {
               const structure = JSON.parse(status.structure);
               console.log("Structure Estimates:", structure.estimates);
             } catch (e) {
               console.log("Structure (raw):", status.structure);
             }
          }
        }
      } catch (e) {
        console.error("Error polling status:", e);
      }
    }, 5000);

  } catch (e) {
    console.error("Error:", e);
  }
}

main();
