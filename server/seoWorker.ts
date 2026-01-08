import { eq, and, lt } from "drizzle-orm";
import { getDb } from "./db";
import { seoArticleJobs } from "../drizzle/schema";
import { processSeoArticleJob } from "./seoArticleJobProcessor";

// Job processing state
let isProcessing = false;

/**
 * Start the SEO worker
 * This function should be called when the server starts
 */
export async function startSeoWorker() {
  console.log("[SeoWorker] Starting SEO article generation worker...");
  console.log("[SeoWorker] Worker is ready to spawn child processes.");
  
  // Resume any incomplete jobs (stuck in processing)
  // For now, we might want to reset them to pending or just leave them.
  // Let's reset "processing" jobs that haven't been updated in a while (e.g., > 1 hour)
  // to avoid stuck jobs from server crashes.
  await resumeStuckJobs();
  
  // Start polling for new jobs
  pollForJobs();
}

/**
 * Resume stuck jobs
 */
async function resumeStuckJobs() {
  const db = await getDb();
  if (!db) return;

  try {
    // Find jobs that are stuck in 'processing' state
    const stuckJobs = await db
      .select()
      .from(seoArticleJobs)
      .where(eq(seoArticleJobs.status, "processing"));

    if (stuckJobs.length > 0) {
      console.log(`[SeoWorker] Found ${stuckJobs.length} stuck jobs.`);
      
      for (const job of stuckJobs) {
        // SAFETY CHECK: If the job already has content, DO NOT RESTART IT.
        // Instead, mark it as completed so the user can see the result.
        if (job.article && job.article.length > 0) {
           console.log(`[SeoWorker] Job ${job.id} has content (${job.article.length} chars). Rescuing to 'completed'.`);
           await db
             .update(seoArticleJobs)
             .set({
               status: "completed",
               errorMessage: null,
               updatedAt: new Date(),
             })
             .where(eq(seoArticleJobs.id, job.id));
        } else {
           // Only restart if there is NO content (truly failed/stuck at start)
           console.log(`[SeoWorker] Job ${job.id} has no content. Resetting to 'pending'.`);
           await db
             .update(seoArticleJobs)
             .set({
               status: "pending",
               errorMessage: null,
               updatedAt: new Date(),
             })
             .where(eq(seoArticleJobs.id, job.id));
        }
      }
    }
  } catch (error) {
    console.error("[SeoWorker] Error resuming stuck jobs:", error);
  }
}

/**
 * Poll for new jobs
 */
function pollForJobs() {
  setInterval(async () => {
    if (isProcessing) {
      return; // Already processing a job
    }

    try {
      const db = await getDb();
      if (!db) return;

      // Find the oldest pending job
      // We prioritize by createdAt asc (FIFO)
      const pendingJobs = await db
        .select()
        .from(seoArticleJobs)
        .where(eq(seoArticleJobs.status, "pending"))
        .orderBy(seoArticleJobs.createdAt) // Oldest first
        .limit(1);

      if (pendingJobs.length > 0) {
        const job = pendingJobs[0];
        console.log(`[SeoWorker] Picking up job ${job.id}: ${job.theme}`);
        await processJob(job.id);
      }
    } catch (error) {
      console.error("[SeoWorker] Error polling for jobs:", error);
    }
  }, 5000); // Poll every 5 seconds
}

/**
 * Process a single job
 */
async function processJob(jobId: number) {
  isProcessing = true;

  try {
    console.log(`[SeoWorker] Spawning child process for job ${jobId}`);
    
    // Spawn a new process to run the job
    // This ensures a fresh memory space for every job, preventing memory leaks/bloat
    // and keeping the main server responsive.
    const { spawn } = await import('child_process');
    
    // Use 'npx tsx' to run the script
    // We inherit stdio so logs appear in the main server console
    const child = spawn('npx', ['tsx', 'scripts/process_seo_job.ts', String(jobId)], {
      stdio: 'inherit',
      env: { ...process.env } // Pass all environment variables (OLLAMA_*, etc.)
    });

    await new Promise<void>((resolve, reject) => {
      child.on('error', (err) => {
        console.error(`[SeoWorker] Failed to start child process:`, err);
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`[SeoWorker] Child process for job ${jobId} exited successfully`);
          resolve();
        } else {
          console.error(`[SeoWorker] Child process for job ${jobId} exited with code ${code}`);
          reject(new Error(`Job failed with exit code ${code}`));
        }
      });
    });

  } catch (error) {
    console.error(`[SeoWorker] Critical error processing job ${jobId}:`, error);
    // Note: The child process should have updated the DB status to 'failed' if it crashed.
    // But if spawn failed, we need to update it here.
    const db = await getDb();
    if (db) {
       await db.update(seoArticleJobs)
        .set({ status: 'failed', errorMessage: String(error) })
        .where(eq(seoArticleJobs.id, jobId));
    }
  } finally {
    isProcessing = false;
  }
}
