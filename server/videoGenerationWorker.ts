/**
 * Video Generation Worker
 * 
 * This worker processes video generation jobs in the background.
 * It runs independently of user sessions and survives server restarts.
 */

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  videoGenerationJobs,
  videoBenchmarkAnalysis,
  videoStrategy,
  videoScenario,
  videoSlideDesign,
  videoProjects,
} from "../drizzle/schema";

// Job processing state
let isProcessing = false;
let currentJobId: number | null = null;

/**
 * Start the worker
 * This function should be called when the server starts
 */
export async function startWorker() {
  console.log("[VideoWorker] Starting video generation worker...");
  
  // Resume any incomplete jobs
  await resumeIncompleteJobs();
  
  // Start polling for new jobs
  pollForJobs();
}

/**
 * Resume incomplete jobs after server restart
 */
async function resumeIncompleteJobs() {
  const db = await getDb();
  if (!db) {
    console.warn("[VideoWorker] Database not available, skipping resume");
    return;
  }

  try {
    // Find all jobs that are in "processing" state
    const incompleteJobs = await db
      .select()
      .from(videoGenerationJobs)
      .where(eq(videoGenerationJobs.status, "processing"));

    console.log(`[VideoWorker] Found ${incompleteJobs.length} incomplete jobs`);

    for (const job of incompleteJobs) {
      // SAFETY CHECK: If the job has reached a high progress (e.g. > 80) or has a video file, 
      // DO NOT RESTART. Mark as completed or failed.
      // For now, checking progress > 90 as a proxy for "almost done".
      if ((job.progress || 0) >= 90) {
         console.log(`[VideoWorker] Job ${job.id} is nearly done (Progress: ${job.progress}). Marking as completed to save data.`);
         await db
          .update(videoGenerationJobs)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(videoGenerationJobs.id, job.id));
      } else {
         // Only restart if progress is low
         console.log(`[VideoWorker] Reset job ${job.id} to pending (Progress: ${job.progress})`);
         await db
          .update(videoGenerationJobs)
          .set({
            status: "pending",
            updatedAt: new Date(),
          })
          .where(eq(videoGenerationJobs.id, job.id));
      }
    }
  } catch (error) {
    console.error("[VideoWorker] Error resuming incomplete jobs:", error);
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
      if (!db) {
        return;
      }

      // Find the oldest pending job
      const pendingJobs = await db
        .select()
        .from(videoGenerationJobs)
        .where(eq(videoGenerationJobs.status, "pending"))
        .limit(1);

      if (pendingJobs.length > 0) {
        const job = pendingJobs[0];
        console.log(`[VideoWorker] Starting job ${job.id}`);
        await processJob(job.id);
      }
    } catch (error) {
      console.error("[VideoWorker] Error polling for jobs:", error);
    }
  }, 5000); // Poll every 5 seconds
}

/**
 * Process a single job
 */
async function processJob(jobId: number) {
  isProcessing = true;
  currentJobId = jobId;

  const db = await getDb();
  if (!db) {
    console.error("[VideoWorker] Database not available");
    isProcessing = false;
    currentJobId = null;
    return;
  }

  try {
    // Update job status to "processing"
    await db
      .update(videoGenerationJobs)
      .set({
        status: "processing",
        updatedAt: new Date(),
      })
      .where(eq(videoGenerationJobs.id, jobId));

    // Get job details
    const jobs = await db
      .select()
      .from(videoGenerationJobs)
      .where(eq(videoGenerationJobs.id, jobId));

    if (jobs.length === 0) {
      throw new Error(`Job ${jobId} not found`);
    }

    let job = jobs[0];

    // Execute all 9 steps (refresh job data before each step)
    await executeStep1(job); // Benchmark video search
    job = (await db.select().from(videoGenerationJobs).where(eq(videoGenerationJobs.id, jobId)))[0];
    
    await executeStep2(job); // Benchmark video analysis
    job = (await db.select().from(videoGenerationJobs).where(eq(videoGenerationJobs.id, jobId)))[0];
    
    await executeStep3(job); // Save to RAG
    job = (await db.select().from(videoGenerationJobs).where(eq(videoGenerationJobs.id, jobId)))[0];
    
    await executeStep4(job); // Strategy design
    job = (await db.select().from(videoGenerationJobs).where(eq(videoGenerationJobs.id, jobId)))[0];
    
    await executeStep5(job); // Scenario generation
    job = (await db.select().from(videoGenerationJobs).where(eq(videoGenerationJobs.id, jobId)))[0];
    
    await executeStep6(job); // Slide generation
    job = (await db.select().from(videoGenerationJobs).where(eq(videoGenerationJobs.id, jobId)))[0];
    
    await executeStep7(job); // Audio generation
    job = (await db.select().from(videoGenerationJobs).where(eq(videoGenerationJobs.id, jobId)))[0];
    
    await executeStep8(job); // Video composition
    job = (await db.select().from(videoGenerationJobs).where(eq(videoGenerationJobs.id, jobId)))[0];
    
    await executeStep9(job); // Export

    // Mark job as completed
    await db
      .update(videoGenerationJobs)
      .set({
        status: "completed",
        progress: 100,
        currentStep: 9,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videoGenerationJobs.id, jobId));

    console.log(`[VideoWorker] Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`[VideoWorker] Error processing job ${jobId}:`, error);

    // Mark job as failed
    await db
      .update(videoGenerationJobs)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        errorDetails: JSON.stringify({
          error: error instanceof Error ? error.stack : String(error),
          timestamp: new Date().toISOString(),
        }),
        updatedAt: new Date(),
      })
      .where(eq(videoGenerationJobs.id, jobId));

    // Check if we should retry
    const jobs = await db
      .select()
      .from(videoGenerationJobs)
      .where(eq(videoGenerationJobs.id, jobId));

    if (jobs.length > 0) {
      const job = jobs[0];
      if ((job.retryCount || 0) < 3) {
        // Retry up to 3 times
        console.log(`[VideoWorker] Retrying job ${jobId} (attempt ${(job.retryCount || 0) + 1}/3)`);
        await db
          .update(videoGenerationJobs)
          .set({
            status: "pending",
            retryCount: (job.retryCount || 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(videoGenerationJobs.id, jobId));
      }
    }
  } finally {
    isProcessing = false;
    currentJobId = null;
  }
}

/**
 * Step 1: Search for benchmark videos
 */
async function executeStep1(job: any) {
  console.log(`[VideoWorker] Step 1: Searching for benchmark videos for job ${job.id}`);
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(videoGenerationJobs)
    .set({
      currentStep: 1,
      progress: 5,
      estimatedTimeRemaining: 600, // 10 minutes
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));

  const { searchBenchmarkVideos } = await import("./benchmarkAnalyzer");
  
  // Search for benchmark videos
  const benchmarkVideos = await searchBenchmarkVideos(job.theme, 3);
  
  console.log(`[VideoWorker] Found ${benchmarkVideos.length} benchmark videos`);
  
  // Store benchmark videos in a temporary variable (will be saved in step 2)
  (job as any)._benchmarkVideos = benchmarkVideos;
}

/**
 * Step 2: Analyze benchmark videos
 */
async function executeStep2(job: any) {
  console.log(`[VideoWorker] Step 2: Analyzing benchmark videos for job ${job.id}`);
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(videoGenerationJobs)
    .set({
      currentStep: 2,
      progress: 15,
      estimatedTimeRemaining: 540, // 9 minutes
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));

  const { performBenchmarkAnalysis } = await import("./benchmarkAnalyzer");
  
  // Perform complete benchmark analysis
  const analysisResult = await performBenchmarkAnalysis(job.theme, undefined, job.id);
  
  // Save analysis result to database
  const result = await db.insert(videoBenchmarkAnalysis).values({
    jobId: job.id,
    userId: job.userId,
    benchmarkVideos: JSON.stringify(analysisResult.benchmarkVideos),
    transcripts: JSON.stringify(analysisResult.transcripts),
    visualAnalysis: JSON.stringify(analysisResult.visualAnalysis),
    summary: analysisResult.summary,
    sellerIntent: analysisResult.sellerIntent,
    targetPersonas: JSON.stringify(analysisResult.targetPersonas),
    personaReactions: analysisResult.personaReactions,
    successFactors: analysisResult.successFactors,
    viralLaws: JSON.stringify(analysisResult.viralLaws),
    savedToRAG: 0, // Will be saved in step 3
  });
  
  console.log('[VideoWorker] Insert result:', JSON.stringify(result));
  
  // Drizzle ORM with MySQL2 returns result as array with insertId
  const analysisId = Array.isArray(result) && result[0]?.insertId 
    ? Number(result[0].insertId) 
    : (result as any).insertId 
    ? Number((result as any).insertId)
    : NaN;
  
  console.log('[VideoWorker] analysisId:', analysisId);
  
  if (isNaN(analysisId) || analysisId === 0) {
    console.error('[VideoWorker] Failed to get valid insertId from result:', result);
    throw new Error('Failed to get valid insertId for benchmark analysis');
  }
  
  // Update job with analysis ID
  await db
    .update(videoGenerationJobs)
    .set({
      benchmarkAnalysisId: analysisId,
      progress: 25,
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));
  
  console.log(`[VideoWorker] Benchmark analysis completed (ID: ${analysisId})`);
}

/**
 * Step 3: Save analysis results to RAG
 */
async function executeStep3(job: any) {
  console.log(`[VideoWorker] Step 3: Saving to RAG for job ${job.id}`);
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(videoGenerationJobs)
    .set({
      currentStep: 3,
      progress: 30,
      estimatedTimeRemaining: 480, // 8 minutes
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));

  if (!job.benchmarkAnalysisId) {
    throw new Error("Benchmark analysis ID not found");
  }
  
  // Get analysis result from database
  const analyses = await db
    .select()
    .from(videoBenchmarkAnalysis)
    .where(eq(videoBenchmarkAnalysis.id, job.benchmarkAnalysisId));
  
  if (analyses.length === 0) {
    throw new Error("Benchmark analysis not found");
  }
  
  const analysis = analyses[0];
  
  // Reconstruct analysis result
  const analysisResult = {
    benchmarkVideos: JSON.parse(analysis.benchmarkVideos || "[]"),
    transcripts: JSON.parse(analysis.transcripts || "[]"),
    visualAnalysis: JSON.parse(analysis.visualAnalysis || "[]"),
    summary: analysis.summary || "",
    sellerIntent: analysis.sellerIntent || "",
    targetPersonas: JSON.parse(analysis.targetPersonas || "[]"),
    personaReactions: analysis.personaReactions || "",
    successFactors: analysis.successFactors || "",
    viralLaws: JSON.parse(analysis.viralLaws || "[]"),
  };
  
  // Save to RAG
  const { saveAnalysisToRAG } = await import("./benchmarkAnalyzer");
  await saveAnalysisToRAG(analysisResult);
  
  // Mark as saved to RAG
  await db
    .update(videoBenchmarkAnalysis)
    .set({
      savedToRAG: 1,
      updatedAt: new Date(),
    })
    .where(eq(videoBenchmarkAnalysis.id, job.benchmarkAnalysisId));
  
  console.log(`[VideoWorker] Analysis results saved to RAG`);
}

/**
 * Step 4: Design content strategy
 */
async function executeStep4(job: any) {
  console.log(`[VideoWorker] Step 4: Designing content strategy for job ${job.id}`);
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(videoGenerationJobs)
    .set({
      currentStep: 4,
      progress: 35,
      estimatedTimeRemaining: 420, // 7 minutes
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));

  const { breakdownTheme, designStrategy } = await import("./contentStrategy");
  
  // Break down theme
  const themeBreakdown = await breakdownTheme(job.theme);
  
  // Design strategy
  const strategy = await designStrategy(themeBreakdown, job.benchmarkAnalysisId);
  
  // Save strategy to database
  const result = await db.insert(videoStrategy).values({
    jobId: job.id,
    userId: job.userId,
    theme: strategy.themeBreakdown.theme,
    trafficKeywords: JSON.stringify(strategy.themeBreakdown.attractionSources),
    solutionKeywords: JSON.stringify(strategy.themeBreakdown.solutionTopics),
    hookStrategy: null,
    problemStrategy: null,
    solutionStrategy: null,
    ragReferences: null,
    userRules: null,
    targetAudience: strategy.targetAudience,
    painPoints: JSON.stringify(strategy.painPoints),
    desiredOutcome: strategy.desiredOutcome,
    uniqueValueProposition: strategy.uniqueValueProposition,
  });
  
  // Drizzle ORM with MySQL2 returns result as array with insertId
  const strategyId = Array.isArray(result) && result[0]?.insertId 
    ? Number(result[0].insertId) 
    : (result as any).insertId 
    ? Number((result as any).insertId)
    : NaN;
  
  if (isNaN(strategyId) || strategyId === 0) {
    console.error('[VideoWorker] Failed to get valid insertId for strategy:', result);
    throw new Error('Failed to get valid insertId for strategy');
  }
  
  // Update job with strategy ID
  await db
    .update(videoGenerationJobs)
    .set({
      strategyId: strategyId,
      progress: 45,
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));
  
  console.log(`[VideoWorker] Content strategy completed (ID: ${strategyId})`);
}

/**
 * Step 5: Generate scenario
 */
async function executeStep5(job: any) {
  console.log(`[VideoWorker] Step 5: Generating scenario for job ${job.id}`);
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(videoGenerationJobs)
    .set({
      currentStep: 5,
      progress: 50,
      estimatedTimeRemaining: 360, // 6 minutes
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));

  if (!job.strategyId) {
    throw new Error("Strategy ID not found");
  }
  
  // Get strategy from database
  const strategies = await db
    .select()
    .from(videoStrategy)
    .where(eq(videoStrategy.id, job.strategyId));
  
  if (strategies.length === 0) {
    throw new Error("Strategy not found");
  }
  
  const strategyData = strategies[0];
  
  // Reconstruct strategy object
  const strategy = {
    themeBreakdown: {
      theme: strategyData.theme || "",
      attractionSources: JSON.parse(strategyData.trafficKeywords || "[]"),
      solutionTopics: JSON.parse(strategyData.solutionKeywords || "[]"),
    },
    targetAudience: strategyData.targetAudience || "",
    painPoints: JSON.parse(strategyData.painPoints || "[]"),
    desiredOutcome: strategyData.desiredOutcome || "",
    uniqueValueProposition: strategyData.uniqueValueProposition || ""
  };
  
  // Generate scenario
  const { generateScenario } = await import("./contentStrategy");
  const scenario = await generateScenario(strategy);
  
  // Save scenario to database
  // Use raw SQL to avoid Drizzle ORM schema cache issues
  const insertData = {
    jobId: job.id,
    userId: job.userId,
    hookContent: scenario.hook.content,
    hookDuration: scenario.hook.duration,
    hookPurpose: scenario.hook.purpose,
    problemContent: scenario.problemPresentation.content,
    problemDuration: scenario.problemPresentation.duration,
    problemPurpose: scenario.problemPresentation.purpose,
    solutionContent: scenario.solution.content,
    solutionDuration: scenario.solution.duration,
    solutionPurpose: scenario.solution.purpose,
    ctaContent: scenario.callToAction.content,
    ctaDuration: scenario.callToAction.duration,
    ctaPurpose: scenario.callToAction.purpose,
  };
  
  console.log('[VideoWorker] Step 5: Inserting scenario with data:', JSON.stringify(insertData, null, 2));
  
  // Use raw SQL INSERT to bypass Drizzle ORM cache
  const { getMysqlPool } = await import("./db");
  const pool = await getMysqlPool();
  if (!pool) {
    throw new Error('Failed to get MySQL connection pool');
  }
  
  const [result] = await pool.query(
    `INSERT INTO videoScenario (
      jobId, userId, hookContent, hookDuration, hookPurpose,
      problemContent, problemDuration, problemPurpose,
      solutionContent, solutionDuration, solutionPurpose,
      ctaContent, ctaDuration, ctaPurpose,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      insertData.jobId,
      insertData.userId,
      insertData.hookContent,
      insertData.hookDuration,
      insertData.hookPurpose,
      insertData.problemContent,
      insertData.problemDuration,
      insertData.problemPurpose,
      insertData.solutionContent,
      insertData.solutionDuration,
      insertData.solutionPurpose,
      insertData.ctaContent,
      insertData.ctaDuration,
      insertData.ctaPurpose,
    ]
  ) as any;
  
  const scenarioId = result.insertId ? Number(result.insertId) : NaN;
  
  if (isNaN(scenarioId) || scenarioId === 0) {
    console.error('[VideoWorker] Failed to get valid insertId for scenario:', result);
    throw new Error('Failed to get valid insertId for scenario');
  }
  
  // Update job with scenario ID
  await db
    .update(videoGenerationJobs)
    .set({
      scenarioId: scenarioId,
      progress: 60,
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));
  
  console.log(`[VideoWorker] Scenario generated (ID: ${scenarioId})`);
}

/**
 * Step 6: Generate slides
 */
async function executeStep6(job: any) {
  console.log(`[VideoWorker] Step 6: Generating slides for job ${job.id}`);
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(videoGenerationJobs)
    .set({
      currentStep: 6,
      progress: 65,
      estimatedTimeRemaining: 300, // 5 minutes
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));

  if (!job.scenarioId || !job.strategyId) {
    throw new Error("Scenario ID or Strategy ID not found");
  }
  
  // Get scenario from database
  const scenarios = await db
    .select()
    .from(videoScenario)
    .where(eq(videoScenario.id, job.scenarioId));
  
  if (scenarios.length === 0) {
    throw new Error("Scenario not found");
  }
  
  const scenarioData = scenarios[0];
  
  // Reconstruct scenario object
  const scenario = {
    hook: {
      content: scenarioData.hookContent || "",
      duration: scenarioData.hookDuration || 0,
      purpose: scenarioData.hookPurpose || "",
    },
    problemPresentation: {
      content: scenarioData.problemContent || "",
      duration: scenarioData.problemDuration || 0,
      purpose: scenarioData.problemPurpose || "",
    },
    solution: {
      content: scenarioData.solutionContent || "",
      duration: scenarioData.solutionDuration || 0,
      purpose: scenarioData.solutionPurpose || "",
    },
    callToAction: {
      content: scenarioData.ctaContent || "",
      duration: scenarioData.ctaDuration || 0,
      purpose: scenarioData.ctaPurpose || "",
    },
  };
  
  // Get strategy from database
  const strategies = await db
    .select()
    .from(videoStrategy)
    .where(eq(videoStrategy.id, job.strategyId));
  
  if (strategies.length === 0) {
    throw new Error("Strategy not found");
  }
  
  const strategyData = strategies[0];
  
  // Reconstruct strategy object
  const strategy = {
    themeBreakdown: {
      theme: strategyData.theme || "",
      attractionSources: JSON.parse(strategyData.trafficKeywords || "[]"),
      solutionTopics: JSON.parse(strategyData.solutionKeywords || "[]"),
    },
    targetAudience: strategyData.targetAudience || "",
    painPoints: JSON.parse(strategyData.painPoints || "[]"),
    desiredOutcome: strategyData.desiredOutcome || "",
    uniqueValueProposition: strategyData.uniqueValueProposition || ""
  };
  
  // Generate slides
  const { generateSlides } = await import("./contentStrategy");
  const slides = await generateSlides(scenario, strategy);
  
  // Save slides to database as JSON array
  await db.insert(videoSlideDesign).values({
    jobId: job.id,
    userId: job.userId,
    scenarioId: job.scenarioId,
    slides: JSON.stringify(slides),
  });
  
  // Update job progress
  await db
    .update(videoGenerationJobs)
    .set({
      progress: 75,
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));
  
  console.log(`[VideoWorker] ${slides.length} slides generated`);
}

/**
 * Step 7: Generate audio
 */
async function executeStep7(job: any) {
  console.log(`[VideoWorker] Step 7: Generating audio for job ${job.id}`);
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(videoGenerationJobs)
    .set({
      currentStep: 7,
      progress: 70,
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));

  // Audio generation is handled in step 8 (video composition)
  // This step is kept for progress tracking
  
  await db
    .update(videoGenerationJobs)
    .set({
      progress: 75,
      estimatedTimeRemaining: 180, // 3 minutes
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));
  
  console.log(`[VideoWorker] Audio generation step completed`);
}

/**
 * Step 8: Compose video
 */
async function executeStep8(job: any) {
  console.log(`[VideoWorker] Step 8: Composing video for job ${job.id}`);
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(videoGenerationJobs)
    .set({
      currentStep: 8,
      progress: 80,
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));

  if (!job.scenarioId) {
    throw new Error("Scenario ID not found");
  }
  
  await db
    .update(videoGenerationJobs)
    .set({
      progress: 80,
      estimatedTimeRemaining: 120, // 2 minutes
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));
  
  // Get scenario from database
  const scenarios = await db
    .select()
    .from(videoScenario)
    .where(eq(videoScenario.id, job.scenarioId));
  
  if (scenarios.length === 0) {
    throw new Error("Scenario not found");
  }
  
  const scenarioData = scenarios[0];
  
  // Reconstruct scenario object
  const scenario = {
    hook: {
      content: scenarioData.hookContent || "",
      duration: scenarioData.hookDuration || 0,
      purpose: scenarioData.hookPurpose || "",
    },
    problemPresentation: {
      content: scenarioData.problemContent || "",
      duration: scenarioData.problemDuration || 0,
      purpose: scenarioData.problemPurpose || "",
    },
    solution: {
      content: scenarioData.solutionContent || "",
      duration: scenarioData.solutionDuration || 0,
      purpose: scenarioData.solutionPurpose || "",
    },
    callToAction: {
      content: scenarioData.ctaContent || "",
      duration: scenarioData.ctaDuration || 0,
      purpose: scenarioData.ctaPurpose || "",
    },
  };
  
  // Get slides from database
  const slidesData = await db
    .select()
    .from(videoSlideDesign)
    .where(eq(videoSlideDesign.jobId, job.id));
  
  if (slidesData.length === 0) {
    throw new Error("Slides not found");
  }
  
  // Parse slides from JSON array
  const slides = JSON.parse(slidesData[0].slides || "[]");
  
  // Compose video
  const { performVideoComposition } = await import("./videoComposer");
  const { videoUrl } = await performVideoComposition({
    slides,
    scenario,
    jobId: job.id,
    speakerId: job.speakerId, // Use speaker ID from job
  });
  
  // Calculate total duration
  const totalDuration = scenario.hook.duration + scenario.problemPresentation.duration + scenario.solution.duration + scenario.callToAction.duration;
  
  // Create videoProjects record
  const { videoProjects } = await import("../drizzle/schema");
  const [project] = await db.insert(videoProjects).values({
    userId: job.userId,
    title: job.theme,
    description: `Generated video for theme: ${job.theme}`,
    theme: job.theme,
    status: "completed",
    videoUrl: videoUrl,
    duration: totalDuration,
  });
  
  // Update job with projectId and videoUrl
  await db
    .update(videoGenerationJobs)
    .set({
      projectId: project.insertId,
      videoUrl: videoUrl,
      progress: 90,
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));
  
  console.log(`[VideoWorker] Video composed: ${videoUrl}, projectId: ${project.insertId}`);
}

/**
 * Step 9: Export video
 */
async function executeStep9(job: any) {
  console.log(`[VideoWorker] Step 9: Exporting video for job ${job.id}`);
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(videoGenerationJobs)
    .set({
      currentStep: 9,
      progress: 90,
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));

  if (!job.videoUrl) {
    throw new Error("Video URL not found");
  }
  
  await db
    .update(videoGenerationJobs)
    .set({
      progress: 95,
      estimatedTimeRemaining: 30, // 30 seconds
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));
  
  // Video is already uploaded to S3 in step 8
  // This step is for finalizing and marking as completed
  
  console.log(`[VideoWorker] Video export completed: ${job.videoUrl}`);
  
  // Mark as completed
  await db
    .update(videoGenerationJobs)
    .set({
      status: "completed",
      progress: 100,
      currentStep: 9,
      estimatedTimeRemaining: 0,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(videoGenerationJobs.id, job.id));
  
  console.log(`[VideoWorker] Job ${job.id} completed successfully`);
}

// Start the worker when this file is run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  console.log("[VideoWorker] Starting as standalone worker...");
  startWorker().catch((error) => {
    console.error("[VideoWorker] Failed to start worker:", error);
    process.exit(1);
  });
}
