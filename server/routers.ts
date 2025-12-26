import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createExportHistory,
  createTimelineSegment,
  createVideoAnalysis,
  deleteExportHistory,
  generateShareToken,
  getExportHistoryByUser,
  getExportHistoryById,
  getTimelineSegmentsByAnalysisId,
  getVideoAnalysesByUser,
  getVideoAnalysisByIdAndUser,
  getVideoAnalysisByShareToken,
  updateExportMetadata,
  updateVideoAnalysis,
  createChatConversation,
  getChatConversationsByUser,
  getChatConversationById,
  createChatMessage,
  getChatMessagesByConversation,
  updateChatConversationTitle,
  updateChatConversationKeywordProject,
  deleteChatConversation,
  createContentImport,
  getContentImportsByUser,
  getContentImportById,
  deleteContentImport,
  createLongContent,
  getLongContentsByUser,
  getLongContentById,
  updateLongContent,
  deleteLongContent,
  createContentChunk,
  getContentChunksByLongContentId,
  updateContentChunk,
  getDb,
  createGeneratedContent,
  getGeneratedContentsByUserId,
  getGeneratedContentById,
  deleteGeneratedContent,
  createPromptTemplate,
  getPromptTemplatesByUserId,
  getPromptTemplateById,
  updatePromptTemplate,
  deletePromptTemplate,
  createSeoArticleJob,
  getSeoArticleJobById,
  getSeoArticleJobsByUserId,
  getAllTagCategories,
  getTagsByCategory,
  getAllTagsWithCategories,
  createTag,
  updateTag,
  deleteTag,
  createTagCategory,
  updateTagCategory,
  deleteTagCategory,
} from "./db";
import { addToRAG, getRAGContext } from "./rag";
import { storagePut } from "./storage";
import {
  extractVideoId,
  generateVideoSummary,
  processYouTubeVideo,
} from "./videoProcessor";
import { generateHtmlForPdf, generateMarkdownExport } from "./exportUtils";
import puppeteer from "puppeteer";
import fs from "fs";
import { invokeLLM } from "./_core/llm";
import { keywordProjects, keywordProjectItems, contentImports, seoArticles, seoArticleJobs, ragDocuments, ragDocumentTags, tags, tagCategories } from "../drizzle/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { analyzeSEO } from "./seoAnalyzer";
import { generateBlogStrategy } from "./blogStrategyAdvisor";
import { processPDFAndExtractStrategies } from "./pdfStrategyExtractor";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  video: router({
    analyzeBatch: protectedProcedure
      .input(z.object({ youtubeUrls: z.array(z.string().url()) }))
      .mutation(async ({ ctx, input }) => {
        const results = [];
        
        for (const youtubeUrl of input.youtubeUrls) {
          const videoId = extractVideoId(youtubeUrl);
          if (!videoId) {
            results.push({ youtubeUrl, status: "error", error: "Invalid YouTube URL" });
            continue;
          }

          try {
            // Create initial analysis record
            const analysisId = await createVideoAnalysis({
              userId: ctx.user.id,
              youtubeUrl,
              videoId,
              status: "processing",
            });

            // Process video in background (non-blocking)
            processYouTubeVideo(youtubeUrl, {
              analysisId,
              onProgress: async (step, progress, message) => {
                // 進捗をデータベースに保存
                await updateVideoAnalysis(analysisId, {
                  currentStep: step,
                  progress: Math.floor(progress),
                  stepProgress: JSON.stringify({
                    download: step === "download" ? progress : step === "transcription" ? 20 : 20,
                    transcription: step === "transcription" ? progress : step === "frameExtraction" ? 50 : 50,
                    frameExtraction: step === "frameExtraction" ? progress : step === "frameAnalysis" ? 55 : 55,
                    frameAnalysis: step === "frameAnalysis" ? progress : step === "summary" ? 90 : 90,
                    summary: step === "summary" ? progress : 100,
                  }),
                });
                console.log(`[Video Analysis ${analysisId}] ${step}: ${progress}% - ${message || ""}`);
              },
            })
              .then(async (result) => {
                console.log(`[Video Analysis ${analysisId}] Video processing completed, generating summary...`);
                
                // Generate summary (90-95%)
                await updateVideoAnalysis(analysisId, {
                  currentStep: "summary",
                  progress: 90,
                });
                
                const { summary, learningPoints } = await generateVideoSummary(
                  result.transcriptionSegments,
                  result.frameAnalyses
                );

                console.log(`[Video Analysis ${analysisId}] Summary generated, updating database...`);

                // Update analysis with results (95-100%)
                await updateVideoAnalysis(analysisId, {
                  title: result.title,
                  status: "completed",
                  summary,
                  learningPoints,
                  currentStep: "completed",
                  progress: 100,
                });
                
                console.log(`[Video Analysis ${analysisId}] Analysis completed successfully`);

                // Add to RAG
                try {
                  const ragText = `
タイトル: ${result.title}
URL: ${youtubeUrl}

要約:
${summary}

学習ポイント:
${learningPoints}

文字起こし:
${result.transcriptionSegments.map(seg => seg.text).join(" ")}
                  `.trim();

                  await addToRAG({
                    id: `video_${analysisId}`,
                    text: ragText,
                    metadata: {
                      type: "video_analysis",
                      title: result.title,
                      url: youtubeUrl,
                      createdAt: new Date().toISOString(),
                      analysisId,
                    },
                  });
                  console.log(`[RAG] Added video analysis ${analysisId} to RAG`);
                } catch (ragError) {
                  console.error("[RAG] Failed to add to RAG:", ragError);
                }

                // Create timeline segments
                for (const frameAnalysis of result.frameAnalyses) {
                  const relevantTranscriptions = result.transcriptionSegments.filter(
                    (seg) =>
                      seg.start <= frameAnalysis.timestamp + 30 &&
                      seg.end >= frameAnalysis.timestamp
                  );

                  await createTimelineSegment({
                    analysisId,
                    startTime: frameAnalysis.timestamp,
                    endTime: frameAnalysis.timestamp + 30,
                    transcription: relevantTranscriptions.map((t) => t.text).join(" "),
                    visualDescription: frameAnalysis.visualDescription,
                    codeContent: frameAnalysis.codeContent,
                    codeExplanation: frameAnalysis.codeExplanation,
                    frameUrl: frameAnalysis.frameUrl,
                  });
                }
              })
              .catch(async (error) => {
                console.error("Video processing failed:", error);
                const errorDetails = {
                  message: error.message,
                  stack: error.stack,
                  timestamp: new Date().toISOString(),
                  videoUrl: youtubeUrl,
                  videoId,
                };
                await updateVideoAnalysis(analysisId, {
                  status: "failed",
                  errorMessage: error.message,
                  errorDetails: JSON.stringify(errorDetails),
                });
              });

            results.push({ youtubeUrl, status: "started", analysisId });
          } catch (error: any) {
            results.push({ youtubeUrl, status: "error", error: error.message });
          }
        }

        return { results };
      }),
    analyze: protectedProcedure
      .input(z.object({ youtubeUrl: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        const videoId = extractVideoId(input.youtubeUrl);
        if (!videoId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid YouTube URL" });
        }

        // Create initial analysis record
        const analysisId = await createVideoAnalysis({
          userId: ctx.user.id,
          youtubeUrl: input.youtubeUrl,
          videoId,
          status: "processing",
          currentStep: "download",
          progress: 0,
        });

        // Process video in background (non-blocking)
        processYouTubeVideo(input.youtubeUrl, {
          analysisId,
          onProgress: async (step, progress, message) => {
            // 進捗をデータベースに保存
            await updateVideoAnalysis(analysisId, {
              currentStep: step,
              progress: Math.floor(progress),
              stepProgress: JSON.stringify({
                download: step === "download" ? progress : step === "transcription" ? 20 : 20,
                transcription: step === "transcription" ? progress : step === "frameExtraction" ? 50 : 50,
                frameExtraction: step === "frameExtraction" ? progress : step === "frameAnalysis" ? 55 : 55,
                frameAnalysis: step === "frameAnalysis" ? progress : step === "summary" ? 90 : 90,
                summary: step === "summary" ? progress : 100,
              }),
            });
            console.log(`[Video Analysis ${analysisId}] ${step}: ${progress}% - ${message || ""}`);
          },
        })
          .then(async (result) => {
            console.log(`[Video Analysis ${analysisId}] Video processing completed, generating summary...`);
            
            // Generate summary (90-95%)
            await updateVideoAnalysis(analysisId, {
              currentStep: "summary",
              progress: 90,
            });
            
            const { summary, learningPoints } = await generateVideoSummary(
              result.transcriptionSegments,
              result.frameAnalyses
            );

            console.log(`[Video Analysis ${analysisId}] Summary generated, updating database...`);

            // Update analysis with results (95-100%)
            await updateVideoAnalysis(analysisId, {
              title: result.title,
              status: "completed",
              summary,
              learningPoints,
              currentStep: "completed",
              progress: 100,
            });

            // Add to RAG for future reference
            try {
              const ragText = `
タイトル: ${result.title}
URL: ${input.youtubeUrl}

要約:
${summary}

学習ポイント:
${learningPoints}

文字起こし:
${result.transcriptionSegments.map(seg => seg.text).join(" ")}
              `.trim();

              await addToRAG({
                id: `video_${analysisId}`,
                text: ragText,
                metadata: {
                  type: "video_analysis",
                  title: result.title,
                  url: input.youtubeUrl,
                  createdAt: new Date().toISOString(),
                  analysisId,
                },
              });
              console.log(`[RAG] Added video analysis ${analysisId} to RAG`);
            } catch (ragError) {
              console.error("[RAG] Failed to add to RAG:", ragError);
              // Don't fail the whole process if RAG fails
            }

            // Create timeline segments by merging transcription and frame analysis
            for (const frameAnalysis of result.frameAnalyses) {
              const relevantTranscriptions = result.transcriptionSegments.filter(
                (seg) =>
                  seg.start <= frameAnalysis.timestamp + 30 &&
                  seg.end >= frameAnalysis.timestamp
              );

              await createTimelineSegment({
                analysisId,
                startTime: frameAnalysis.timestamp,
                endTime: frameAnalysis.timestamp + 30,
                transcription: relevantTranscriptions.map((t) => t.text).join(" "),
                visualDescription: frameAnalysis.visualDescription,
                codeContent: frameAnalysis.codeContent,
                codeExplanation: frameAnalysis.codeExplanation,
                frameUrl: frameAnalysis.frameUrl,
              });
            }
          })
          .catch(async (error) => {
            console.error("Video processing failed:", error);
            
            // Check if it was cancelled
            const analysis = await getVideoAnalysisByIdAndUser(analysisId, ctx.user.id);
            if (analysis?.status === "cancelled") {
              console.log(`[Video Analysis ${analysisId}] Processing was cancelled by user`);
              return; // Already marked as cancelled, no need to update
            }
            
            // Collect detailed error information
            const errorDetails = {
              message: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString(),
              videoUrl: input.youtubeUrl,
              videoId,
            };
            
            await updateVideoAnalysis(analysisId, {
              status: "failed",
              errorMessage: error.message,
              errorDetails: JSON.stringify(errorDetails),
            });
          });

        return { analysisId };
      }),

    getAnalysis: protectedProcedure
      .input(z.object({ analysisId: z.number() }))
      .query(async ({ ctx, input }) => {
        const analysis = await getVideoAnalysisByIdAndUser(input.analysisId, ctx.user.id);
        if (!analysis) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
        }

        const segments = await getTimelineSegmentsByAnalysisId(input.analysisId);

        return {
          analysis,
          segments,
        };
      }),

    listAnalyses: protectedProcedure.query(async ({ ctx }) => {
      return getVideoAnalysesByUser(ctx.user.id);
    }),

    cancel: protectedProcedure
      .input(z.object({ analysisId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const analysis = await getVideoAnalysisByIdAndUser(input.analysisId, ctx.user.id);
        if (!analysis) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
        }

        if (analysis.status !== "processing") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can only cancel analyses that are currently processing",
          });
        }

        // Mark as cancelled
        await updateVideoAnalysis(input.analysisId, {
          status: "cancelled",
          errorMessage: "ユーザーによって中断されました",
          currentStep: null,
          progress: 0,
        });

        return { success: true };
      }),

    retry: protectedProcedure
      .input(z.object({ analysisId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const analysis = await getVideoAnalysisByIdAndUser(input.analysisId, ctx.user.id);
        if (!analysis) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
        }

        if (analysis.status !== "failed" && analysis.status !== "cancelled") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can only retry failed or cancelled analyses",
          });
        }

        // Reset analysis to processing state
        await updateVideoAnalysis(input.analysisId, {
          status: "processing",
          errorMessage: null,
          errorDetails: null,
          currentStep: null,
          progress: 0,
          estimatedTimeRemaining: null,
          stepProgress: null,
        });

        // Process video in background (non-blocking)
        processYouTubeVideo(analysis.youtubeUrl, {
          analysisId: input.analysisId,
          onProgress: async (step, progress, message) => {
            // 進捗をデータベースに保存
            await updateVideoAnalysis(input.analysisId, {
              currentStep: step,
              progress: Math.floor(progress),
              stepProgress: JSON.stringify({
                download: step === "download" ? progress : step === "transcription" ? 20 : 20,
                transcription: step === "transcription" ? progress : step === "frameExtraction" ? 50 : 50,
                frameExtraction: step === "frameExtraction" ? progress : step === "frameAnalysis" ? 55 : 55,
                frameAnalysis: step === "frameAnalysis" ? progress : step === "summary" ? 90 : 90,
                summary: step === "summary" ? progress : 100,
              }),
            });
            console.log(`[Video Analysis ${input.analysisId}] ${step}: ${progress}% - ${message || ""}`);
          },
        })
          .then(async (result) => {
            console.log(`[Video Analysis ${input.analysisId}] Video processing completed, generating summary...`);
            
            // Generate summary (90-95%)
            await updateVideoAnalysis(input.analysisId, {
              currentStep: "summary",
              progress: 90,
            });
            
            const { summary, learningPoints } = await generateVideoSummary(
              result.transcriptionSegments,
              result.frameAnalyses
            );

            // Update analysis with results (95-100%)
            await updateVideoAnalysis(input.analysisId, {
              title: result.title,
              status: "completed",
              summary,
              learningPoints,
              currentStep: "completed",
              progress: 100,
            });
            
            console.log(`[Video Analysis ${input.analysisId}] Analysis completed successfully`);

            // Delete old timeline segments
            // (Note: You may want to add a deleteTimelineSegmentsByAnalysisId function in db.ts)
            
            // Create timeline segments by merging transcription and frame analysis
            for (const frameAnalysis of result.frameAnalyses) {
              const relevantTranscriptions = result.transcriptionSegments.filter(
                (seg) =>
                  seg.start <= frameAnalysis.timestamp + 30 &&
                  seg.end >= frameAnalysis.timestamp
              );

              await createTimelineSegment({
                analysisId: input.analysisId,
                startTime: frameAnalysis.timestamp,
                endTime: frameAnalysis.timestamp + 30,
                transcription: relevantTranscriptions.map((t) => t.text).join(" "),
                visualDescription: frameAnalysis.visualDescription,
                codeContent: frameAnalysis.codeContent,
                codeExplanation: frameAnalysis.codeExplanation,
                frameUrl: frameAnalysis.frameUrl,
              });
            }
          })
          .catch(async (error) => {
            console.error("Video processing failed:", error);
            await updateVideoAnalysis(input.analysisId, {
              status: "failed",
              errorMessage: error.message,
            });
          });

        return { success: true };
      }),

    exportMarkdown: protectedProcedure
      .input(z.object({ analysisId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const analysis = await getVideoAnalysisByIdAndUser(input.analysisId, ctx.user.id);
        if (!analysis) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
        }

        const segments = await getTimelineSegmentsByAnalysisId(input.analysisId);
        const markdown = generateMarkdownExport(analysis, segments);
        const filename = `${analysis.videoId}_analysis_${Date.now()}.md`;

        // Upload to S3
        const fileKey = `exports/${ctx.user.id}/${filename}`;
        const { url } = await storagePut(fileKey, markdown, "text/markdown");

        // Save to database
        await createExportHistory({
          userId: ctx.user.id,
          analysisId: input.analysisId,
          exportType: "markdown",
          fileUrl: url,
          fileKey,
          fileName: filename,
          fileSize: Buffer.byteLength(markdown, 'utf8'),
        });

        return {
          content: markdown,
          filename,
          url,
        };
      }),

    exportPdf: protectedProcedure
      .input(z.object({ analysisId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const analysis = await getVideoAnalysisByIdAndUser(input.analysisId, ctx.user.id);
        if (!analysis) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
        }

        const segments = await getTimelineSegmentsByAnalysisId(input.analysisId);
        const html = generateHtmlForPdf(analysis, segments);

        // Generate PDF using puppeteer
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        try {
          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: 'networkidle0' });
          const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: {
              top: '20mm',
              right: '15mm',
              bottom: '20mm',
              left: '15mm',
            },
            printBackground: true,
          });

          await browser.close();

          // Convert buffer to base64 for transmission
          const base64Pdf = Buffer.from(pdfBuffer).toString('base64');
          const filename = `${analysis.videoId}_analysis_${Date.now()}.pdf`;

          // Upload to S3
          const fileKey = `exports/${ctx.user.id}/${filename}`;
          const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

          // Save to database
          await createExportHistory({
            userId: ctx.user.id,
            analysisId: input.analysisId,
            exportType: "pdf",
            fileUrl: url,
            fileKey,
            fileName: filename,
            fileSize: pdfBuffer.length,
          });

          return {
            content: base64Pdf,
            filename,
            url,
          };
        } catch (error) {
          await browser.close();
          throw error;
        }
      }),

    generateShareLink: protectedProcedure
      .input(z.object({ analysisId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const analysis = await getVideoAnalysisByIdAndUser(input.analysisId, ctx.user.id);
        if (!analysis) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
        }

        if (analysis.status !== "completed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot share incomplete analysis" });
        }

        // Generate share token if not exists
        let shareToken = analysis.shareToken;
        if (!shareToken) {
          shareToken = await generateShareToken();
          await updateVideoAnalysis(input.analysisId, {
            shareToken,
            isPublic: 1,
          });
        } else if (analysis.isPublic === 0) {
          // Re-enable sharing if it was disabled
          await updateVideoAnalysis(input.analysisId, {
            isPublic: 1,
          });
        }

        return {
          shareToken,
          shareUrl: `/share/${shareToken}`,
        };
      }),

    disableSharing: protectedProcedure
      .input(z.object({ analysisId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const analysis = await getVideoAnalysisByIdAndUser(input.analysisId, ctx.user.id);
        if (!analysis) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
        }

        await updateVideoAnalysis(input.analysisId, {
          isPublic: 0,
        });

        return { success: true };
      }),

    getSharedAnalysis: publicProcedure
      .input(z.object({ shareToken: z.string() }))
      .query(async ({ input }) => {
        const analysis = await getVideoAnalysisByShareToken(input.shareToken);
        if (!analysis || analysis.isPublic === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Shared analysis not found or not public" });
        }

        const segments = await getTimelineSegmentsByAnalysisId(analysis.id);

        return {
          analysis,
          segments,
        };
      }),
  }),

  chat: router({
    createConversation: protectedProcedure
      .input(z.object({ title: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const conversationId = await createChatConversation(ctx.user.id, input.title);
        return { conversationId };
      }),

    listConversations: protectedProcedure
      .query(async ({ ctx }) => {
        return getChatConversationsByUser(ctx.user.id);
      }),

    getConversation: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const conversation = await getChatConversationById(input.conversationId, ctx.user.id);
        if (!conversation) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
        }
        const messages = await getChatMessagesByConversation(input.conversationId);
        return { 
          conversation, 
          messages, 
          keywordProjectId: conversation.keywordProjectId 
        };
      }),

    sendMessage: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        message: z.string(),
        contentType: z.enum(["email", "slide", "script", "general", "longContent", "seoArticle"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
        console.log('[sendMessage] Starting mutation with input:', input);
        // Verify conversation belongs to user
        const conversation = await getChatConversationById(input.conversationId, ctx.user.id);
        console.log('[sendMessage] Conversation found:', conversation);
        if (!conversation) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
        }

        // Save user message
        await createChatMessage({
          conversationId: input.conversationId,
          role: "user",
          content: input.message,
        });

        // Get pinned documents (必須参照)
        const db = await getDb();
        let pinnedDocuments: Array<{id: string; text: string; title?: string; createdAt: string}> = [];
        if (db) {
          const pinnedImports = await db.select().from(contentImports).where(eq(contentImports.isPinned, 1));
          pinnedDocuments = pinnedImports.map(imp => ({
            id: imp.id.toString(),
            text: imp.extractedText || '',
            title: imp.fileName,
            createdAt: imp.createdAt.toISOString(),
          }));
        }

        // Get RAG context with pinned documents
        const ragContext = await getRAGContext(input.message, 3, pinnedDocuments);

        // Get keyword project keywords if selected
        let keywordInstructions = "";
        if (conversation.keywordProjectId) {
          const db = await getDb();
          if (db) {
            const keywords = await db.select().from(keywordProjectItems).where(eq(keywordProjectItems.projectId, conversation.keywordProjectId));
            if (keywords.length > 0) {
              const keywordList = keywords.map(k => `${k.keyword} (目標出現回数: ${k.targetCount || '指定なし'}回)`).join(', ');
              keywordInstructions = `\n\n【重要】以下のキーワードを適切に含めてコンテンツを生成してください:\n${keywordList}\n\nキーワードは自然な形で文章に組み込み、目標出現回数を意識してください。`;
            }
          }
        }

        // Determine if this is a content generation request
        const isContentGeneration = input.contentType !== "general" || 
          input.message.match(/(作成|生成|書いて|執筆|まとめて|提案|draft|write|create|generate)/i);

        // Build system prompt based on content type
        let systemPrompt = "あなたはYouTube動画分析アシスタントです。" + keywordInstructions;

        if (input.contentType === "email") {
          systemPrompt += "\n\nメールを作成する際は、件名、本文、署名を含めてください。読みやすく、プロフェッショナルな文章を心がけてください。";
        } else if (input.contentType === "slide") {
          systemPrompt += "\n\nスライドを作成する際は、タイトル、各スライドの内容、キーポイントを明確にしてください。視覚的にわかりやすい構成を提案してください。";
        } else if (input.contentType === "script") {
          systemPrompt += "\n\n動画スクリプトを作成する際は、視聴者を引き付けるオープニング、明確な構成、エンゲージングなトーンを心がけてください。";
        } else if (input.contentType === "longContent") {
          systemPrompt += "\n\n長文記事を作成する際は、マークダウン形式で出力してください。執筆スタイルは参考資料の指示に完全に従ってください。";
        } else if (input.contentType === "seoArticle") {
          systemPrompt += "\n\nSEO記事を生成します。8ステッププロセスに従って、検索上位を狙いつつ赤原カラー全開のコンテンツを作成します。";
        }

        // Get previous messages for context
        const previousMessages = await getChatMessagesByConversation(input.conversationId);
        const conversationHistory = previousMessages.slice(-10).map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));

        // Build messages array
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemPrompt },
        ];

        // Apply RAG context with style enforcement ONLY for content generation
        if (isContentGeneration && ragContext) {
          messages.push({
            role: "system",
            content: `【参考資料】以下は過去のコンテンツや資料です。コンテンツを生成する際は、これらの資料に記載された執筆スタイル・原則・禁止事項を遵守してください：

${ragContext}

上記の資料に執筆スタイルガイドが含まれている場合、そのスタイル（口調、視点、構成、表現方法、禁止事項など）に従ってコンテンツを生成してください。`
          });
        } else if (ragContext) {
          // For general conversation, RAG is just reference information
          messages.push({
            role: "system",
            content: `【参考情報】以下は関連する過去のコンテンツや資料です。必要に応じて参照してください：

${ragContext}`
          });
        }

        // Add conversation history and current message
        messages.push(...conversationHistory);
        messages.push({ role: "user", content: input.message });

        // Generate response using LLM
        const response = await invokeLLM({ messages });

        const assistantMessage = typeof response.choices[0].message.content === 'string' 
          ? response.choices[0].message.content 
          : "エラーが発生しました。";

        // Count keyword occurrences if keyword project is selected
        let keywordCounts: Array<{ keyword: string; count: number; targetCount: number }> = [];
        if (conversation.keywordProjectId) {
          const db = await getDb();
          if (db) {
            const keywords = await db.select().from(keywordProjectItems).where(eq(keywordProjectItems.projectId, conversation.keywordProjectId));
            keywordCounts = keywords.map(k => {
              const regex = new RegExp(k.keyword, 'gi');
              const matches = assistantMessage.match(regex);
              return {
                keyword: k.keyword,
                count: matches ? matches.length : 0,
                targetCount: k.targetCount || 0,
              };
            });
          }
        }

        // Save assistant message
        await createChatMessage({
          conversationId: input.conversationId,
          role: "assistant",
          content: assistantMessage,
          ragContext,
        });

        console.log('[sendMessage] Successfully generated response, length:', assistantMessage.length);
        return {
          message: assistantMessage,
          ragContext,
          keywordCounts,
        };
        } catch (error) {
          console.error('[sendMessage] Error occurred:', error);
          throw error;
        }
      }),

    deleteConversation: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteChatConversation(input.conversationId, ctx.user.id);
        return { success: true };
      }),

    updateTitle: protectedProcedure
      .input(z.object({ conversationId: z.number(), title: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const conversation = await getChatConversationById(input.conversationId, ctx.user.id);
        if (!conversation) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
        }
        await updateChatConversationTitle(input.conversationId, input.title);
        return { success: true };
      }),

    updateKeywordProject: protectedProcedure
      .input(z.object({ 
        conversationId: z.number(), 
        keywordProjectId: z.number().nullable() 
      }))
      .mutation(async ({ ctx, input }) => {
        const conversation = await getChatConversationById(input.conversationId, ctx.user.id);
        if (!conversation) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
        }
        await updateChatConversationKeywordProject(input.conversationId, input.keywordProjectId);
        return { success: true };
      }),
  }),

  exports: router({
    list: protectedProcedure
      .input(
        z
          .object({
            category: z.string().optional(),
            search: z.string().optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const allExports = await getExportHistoryByUser(ctx.user.id);

        if (!input) return allExports;

        let filtered = allExports;

        // Filter by category
        if (input.category) {
          filtered = filtered.filter((exp) => exp.category === input.category);
        }

        // Search in filename, tags, notes
        if (input.search) {
          const searchLower = input.search.toLowerCase();
          filtered = filtered.filter((exp) => {
            const fileNameMatch = exp.fileName.toLowerCase().includes(searchLower);
            const tagsMatch = exp.tags?.toLowerCase().includes(searchLower) || false;
            const notesMatch = exp.notes?.toLowerCase().includes(searchLower) || false;
            return fileNameMatch || tagsMatch || notesMatch;
          });
        }

        return filtered;
      }),

    updateMetadata: protectedProcedure
      .input(
        z.object({
          exportId: z.number(),
          category: z.string().nullable().optional(),
          tags: z.array(z.string()).optional(),
          notes: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { exportId, tags, ...rest } = input;
        const data = {
          ...rest,
          tags: tags ? JSON.stringify(tags) : undefined,
        };
        return updateExportMetadata(exportId, ctx.user.id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ exportId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const exportRecord = await deleteExportHistory(input.exportId, ctx.user.id);
        // Note: We're not deleting from S3 here to keep files accessible
        // You could add S3 deletion if needed
        return { success: true, deletedRecord: exportRecord };
      }),
  }),

  contentImport: router({
    upload: protectedProcedure
      .input(
        z.object({
          fileName: z.string(),
          fileContent: z.string(), // Base64 encoded file content
          fileType: z.enum(["txt", "docx", "pdf", "m4a"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { fileName, fileContent, fileType } = input;
        
        // Decode base64 content
        const buffer = Buffer.from(fileContent, "base64");
        
        // Extract text based on file type
        const { extractTextFromFile } = await import("./textExtractor");
        const extractedText = await extractTextFromFile(buffer, fileType);
        
        // Upload to S3
        const fileKey = `content-imports/${ctx.user.id}/${Date.now()}-${fileName}`;
        
        // Determine MIME type based on file type
        let mimeType: string;
        switch (fileType) {
          case "pdf":
            mimeType = "application/pdf";
            break;
          case "docx":
            mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            break;
          case "m4a":
            mimeType = "audio/mp4";
            break;
          default:
            mimeType = "text/plain";
        }
        
        const { url: fileUrl } = await storagePut(
          fileKey,
          buffer,
          mimeType
        );
        
        // Generate RAG ID
        const ragId = `import_${Date.now()}_${ctx.user.id}`;
        
        // Save to database
        const importId = await createContentImport({
          userId: ctx.user.id,
          fileName,
          fileType,
          fileUrl,
          fileKey,
          fileSize: buffer.length,
          extractedText,
          ragId,
        });
        
        // Add to RAG
        await addToRAG({
          id: ragId,
          text: extractedText,
          metadata: {
            type: "mailmag",
            title: fileName,
            createdAt: new Date().toISOString(),
            fileType,
          },
        });
        
        return { importId, success: true };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return getContentImportsByUser(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ importId: z.number() }))
      .query(async ({ ctx, input }) => {
        const importRecord = await getContentImportById(input.importId);
        // Verify ownership
        if (!importRecord || importRecord.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Import not found or access denied" });
        }
        return importRecord;
      }),

    delete: protectedProcedure
      .input(z.object({ importId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify ownership first
        const importRecord = await getContentImportById(input.importId);
        if (!importRecord || importRecord.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Import not found or access denied" });
        }
        await deleteContentImport(input.importId);
        return { success: true };
      }),

    togglePin: protectedProcedure
      .input(z.object({ importId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify ownership first
        const importRecord = await getContentImportById(input.importId);
        if (!importRecord || importRecord.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Import not found or access denied" });
        }
        
        // Toggle isPinned status
        const newIsPinned = importRecord.isPinned === 1 ? 0 : 1;
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }
        
        await db.update(contentImports)
          .set({ isPinned: newIsPinned })
          .where(eq(contentImports.id, input.importId));
        
        return { success: true, isPinned: newIsPinned === 1 };
      }),
  }),

  longContent: router({
    create: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          prompt: z.string(),
          targetWordCount: z.number().optional(),
          contentType: z.enum(["blog", "article", "essay", "report"]).default("blog"),
          tone: z.string().optional(),
          keywords: z.array(z.string()).optional(),
          useRAGStyle: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { keywords, useRAGStyle, ...rest } = input;
        const contentId = await createLongContent({
          userId: ctx.user.id,
          ...rest,
          keywords: keywords ? JSON.stringify(keywords) : undefined,
          useRAGStyle: useRAGStyle ? 1 : 0,
          status: "pending",
        });
        return { contentId };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return getLongContentsByUser(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ contentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const content = await getLongContentById(input.contentId);
        if (!content || content.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Content not found or access denied" });
        }
        return content;
      }),

    delete: protectedProcedure
      .input(z.object({ contentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const content = await getLongContentById(input.contentId);
        if (!content || content.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Content not found or access denied" });
        }
        await deleteLongContent(input.contentId);
        return { success: true };
      }),

    generate: protectedProcedure
      .input(z.object({ contentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const content = await getLongContentById(input.contentId);
        if (!content || content.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Content not found or access denied" });
        }

        // Start generation in background
        const { generateLongContent } = await import("./longContentGenerator");
        generateLongContent(input.contentId).catch((error) => {
          console.error("[LongContent] Generation error:", error);
        });

        return { success: true, message: "Generation started" };
      }),

    getChunks: protectedProcedure
      .input(z.object({ contentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const content = await getLongContentById(input.contentId);
        if (!content || content.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Content not found or access denied" });
        }
        return getContentChunksByLongContentId(input.contentId);
      }),
  }),

  keywordResearch: router({
    getRelated: protectedProcedure
      .input(z.object({ keyword: z.string(), geo: z.string().optional() }))
      .query(async ({ input }) => {
        const { getRelatedKeywords } = await import("./keywordResearch");
        return getRelatedKeywords(input.keyword, input.geo);
      }),

    compareKeywords: protectedProcedure
      .input(z.object({ keywords: z.array(z.string()), geo: z.string().optional() }))
      .query(async ({ input }) => {
        const { compareKeywords } = await import("./keywordResearch");
        return compareKeywords(input.keywords, input.geo);
      }),

    getMultiple: protectedProcedure
      .input(z.object({ keywords: z.array(z.string()), geo: z.string().optional() }))
      .query(async ({ input }) => {
        const { getMultipleKeywords } = await import("./keywordResearch");
        return getMultipleKeywords(input.keywords, input.geo);
      }),
  }),

  seoAnalysis: router({
    analyze: protectedProcedure
      .input(z.object({ 
        keyword: z.string(), 
        relatedKeywords: z.array(z.string()).optional(), 
        limit: z.number().optional() 
      }))
      .mutation(async ({ input }) => {
        const { analyzeSEO } = await import("./seoAnalyzer");
        return analyzeSEO(input.keyword, input.relatedKeywords, input.limit);
      }),

    compareKeywordUsage: protectedProcedure
      .input(z.object({ 
        content: z.string(), 
        recommendedFrequencies: z.record(z.number()) 
      }))
      .query(async ({ input }) => {
        const { compareKeywordUsage } = await import("./seoAnalyzer");
        return compareKeywordUsage(input.content, input.recommendedFrequencies);
      }),
  }),

  styleAnalysis: router({
    analyze: protectedProcedure
      .query(async ({ ctx }) => {
        const { analyzeWritingStyle } = await import("./styleAnalyzer");
        return analyzeWritingStyle(ctx.user.id);
      }),

    generateWithStyle: protectedProcedure
      .input(z.object({ 
        prompt: z.string(), 
        contentType: z.string().optional() 
      }))
      .mutation(async ({ ctx, input }) => {
        const { analyzeWritingStyle, generateWithStyle } = await import("./styleAnalyzer");
        const style = await analyzeWritingStyle(ctx.user.id);
        return generateWithStyle(input.prompt, style, input.contentType);
      }),
  }),
  keywordProject: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      const projects = await db.select().from(keywordProjects).where(eq(keywordProjects.userId, ctx.user.id));
      return projects;
    }),
    create: protectedProcedure
      .input(z.object({ name: z.string(), description: z.string().optional(), targetUrl: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const [project] = await db.insert(keywordProjects).values({ userId: ctx.user.id, name: input.name, description: input.description, targetUrl: input.targetUrl }).$returningId();
        return project;
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional(), targetUrl: z.string().optional(), status: z.enum(['draft', 'in_progress', 'completed']).optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        await db.update(keywordProjects).set({ name: input.name, description: input.description, targetUrl: input.targetUrl, status: input.status }).where(eq(keywordProjects.id, input.id));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        await db.delete(keywordProjectItems).where(eq(keywordProjectItems.projectId, input.id));
        await db.delete(keywordProjects).where(eq(keywordProjects.id, input.id));
        return { success: true };
      }),
    getItems: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const items = await db.select().from(keywordProjectItems).where(eq(keywordProjectItems.projectId, input.projectId));
        return items;
      }),
    addItem: protectedProcedure
      .input(z.object({ projectId: z.number(), keyword: z.string(), targetCount: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const [item] = await db.insert(keywordProjectItems).values({ projectId: input.projectId, keyword: input.keyword, targetCount: input.targetCount || 0 }).$returningId();
        return item;
      }),
    updateItem: protectedProcedure
      .input(z.object({ id: z.number(), keyword: z.string().optional(), targetCount: z.number().optional(), currentCount: z.number().optional(), searchVolume: z.number().optional(), competition: z.string().optional(), seoAnalysisData: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        await db.update(keywordProjectItems).set({ keyword: input.keyword, targetCount: input.targetCount, currentCount: input.currentCount, searchVolume: input.searchVolume, competition: input.competition, seoAnalysisData: input.seoAnalysisData }).where(eq(keywordProjectItems.id, input.id));
        return { success: true };
      }),
    deleteItem: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        await db.delete(keywordProjectItems).where(eq(keywordProjectItems.id, input.id));
        return { success: true };
      }),
    analyzeSEO: protectedProcedure
      .input(z.object({ keywordId: z.number(), relatedKeywords: z.array(z.string()).optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        
        // Get keyword item
        const [keywordItem] = await db.select().from(keywordProjectItems).where(eq(keywordProjectItems.id, input.keywordId));
        if (!keywordItem) throw new TRPCError({ code: 'NOT_FOUND', message: 'Keyword not found' });
        
        // Perform SEO analysis
        const analysis = await analyzeSEO(keywordItem.keyword, input.relatedKeywords || [], 10);
        
        // Save analysis results
        await db.update(keywordProjectItems).set({
          searchVolume: analysis.recommendedKeywordFrequency[keywordItem.keyword] || 0,
          competition: 'medium', // Default value, can be enhanced later
          targetCount: analysis.recommendedKeywordFrequency[keywordItem.keyword] || 0,
          seoAnalysisData: JSON.stringify(analysis),
        }).where(eq(keywordProjectItems.id, input.keywordId));
        
        return analysis;
      }),
    generateStrategy: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        
        // Get project
        const [project] = await db.select().from(keywordProjects).where(eq(keywordProjects.id, input.projectId));
        if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
        
        // Get keywords
        const keywords = await db.select().from(keywordProjectItems).where(eq(keywordProjectItems.projectId, input.projectId));
        if (keywords.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No keywords found in project' });
        
        // Generate strategy
        const strategy = await generateBlogStrategy(project.name, project.description, keywords as any);
        
        // Save strategy to database
        await db.update(keywordProjects).set({
          strategyData: JSON.stringify(strategy),
          updatedAt: new Date(),
        }).where(eq(keywordProjects.id, input.projectId));
        
        return strategy;
      }),
    getStrategy: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        
        // Get project with strategy data
        const [project] = await db.select().from(keywordProjects).where(eq(keywordProjects.id, input.projectId));
        if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
        
        // Parse and return strategy data
        if (project.strategyData) {
          try {
            return JSON.parse(project.strategyData);
          } catch (error) {
            console.error('[getStrategy] Failed to parse strategy data:', error);
            return null;
          }
        }
        
        return null;
      }),
  }),

  generatedContents: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getGeneratedContentsByUserId(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        conversationId: z.number().optional(),
        contentType: z.enum(["general", "email", "slide", "script", "longContent"]),
        title: z.string().optional(),
        content: z.string(),
        keywordProjectId: z.number().optional(),
        keywordCounts: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createGeneratedContent({
          userId: ctx.user.id,
          conversationId: input.conversationId,
          contentType: input.contentType,
          title: input.title,
          content: input.content,
          keywordProjectId: input.keywordProjectId,
          keywordCounts: input.keywordCounts,
        });
        return { id };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const content = await getGeneratedContentById(input.id);
        if (!content || content.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Content not found' });
        }
        return content;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const content = await getGeneratedContentById(input.id);
        if (!content || content.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Content not found' });
        }
        await deleteGeneratedContent(input.id);
        return { success: true };
      }),

    exportMarkdown: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const content = await getGeneratedContentById(input.id);
        if (!content || content.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Content not found' });
        }
        const filename = `${content.title || 'content'}_${content.id}.md`;
        return { content: content.content, filename };
      }),

    exportPdf: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const content = await getGeneratedContentById(input.id);
        if (!content || content.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Content not found' });
        }
        
        const html = await generateHtmlForPdf(content.content, content.title || 'Content');
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        });
        await browser.close();
        
        const filename = `${content.title || 'content'}_${content.id}.pdf`;
        const { url } = await storagePut(
          `exports/${ctx.user.id}/${filename}`,
          pdfBuffer,
          'application/pdf'
        );
        return { url, filename };
      }),
  }),

  seoArticle: router({
    separateKeywords: protectedProcedure
      .input(z.object({ theme: z.string() }))
      .mutation(async ({ input }) => {
        const { separateKeywords } = await import('./seoArticleGenerator');
        const result = await separateKeywords(input.theme);
        return result;
      }),

    analyzeCompetitors: protectedProcedure
      .input(z.object({ keyword: z.string() }))
      .mutation(async ({ input }) => {
        const { analyzeTopArticles } = await import('./seoArticleGenerator');
        const analyses = await analyzeTopArticles(input.keyword);
        return { analyses };
      }),

    createCriteria: protectedProcedure
      .input(z.object({ analyses: z.any() }))
      .mutation(async ({ input }) => {
        const { createSEOCriteria } = await import('./seoArticleGenerator');
        const criteria = createSEOCriteria(input.analyses);
        return { criteria };
      }),

    generateStructure: protectedProcedure
      .input(z.object({ 
        theme: z.string(),
        criteria: z.any()
      }))
      .mutation(async ({ ctx, input }) => {
        const { createArticleStructure } = await import('./seoArticleGenerator');
        
        // Get pinned RAG documents
        const db = await getDb();
        let ragContext = '';
        if (db) {
          const pinnedImports = await db.select().from(contentImports).where(eq(contentImports.isPinned, 1));
          ragContext = pinnedImports.map(imp => `### ${imp.fileName}\n${imp.extractedText}`).join('\n\n');
        }
        
        const structureResult = await createArticleStructure(input.theme, input.criteria, ragContext, "赤原", [], [], []);
        return { structure: structureResult.structure };
      }),

    generateArticle: protectedProcedure
      .input(z.object({ 
        structure: z.string(),
        criteria: z.any()
      }))
      .mutation(async ({ ctx, input }) => {
        const { generateSEOArticle } = await import('./seoArticleGenerator');
        
        // Get pinned RAG documents
        const db = await getDb();
        let ragContext = '';
        if (db) {
          const pinnedImports = await db.select().from(contentImports).where(eq(contentImports.isPinned, 1));
          ragContext = pinnedImports.map(imp => `### ${imp.fileName}\n${imp.extractedText}`).join('\n\n');
        }
        
        let article = await generateSEOArticle(input.structure, ragContext, input.criteria);
        
        // ステップ8: 後処理チェック（スペース繋ぎキーワード修正、ノウハウ記述削除）
        const { exportArticleWithPostProcessing } = await import('./seoArticleGenerator');
        article = await exportArticleWithPostProcessing(article);
        
        return { article };
      }),

    checkQuality: protectedProcedure
      .input(z.object({ 
        article: z.string(),
        criteria: z.any()
      }))
      .mutation(async ({ input }) => {
        const { checkArticleQuality } = await import('./seoArticleGenerator');
        const result = await checkArticleQuality(input.article, input.criteria);
        return result;
      }),

    save: protectedProcedure
      .input(z.object({
        theme: z.string(),
        keywords: z.array(z.string()),
        analyses: z.any(),
        criteria: z.any(),
        structure: z.string(),
        article: z.string(),
        qualityCheck: z.any(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        
        const [result] = await db.insert(seoArticles).values({
          userId: ctx.user.id,
          theme: input.theme,
          keywords: JSON.stringify(input.keywords),
          analyses: JSON.stringify(input.analyses),
          criteria: JSON.stringify(input.criteria),
          structure: input.structure,
          article: input.article,
          qualityCheck: JSON.stringify(input.qualityCheck),
        });
        
        return { id: result.insertId, success: true };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const jobs = await getSeoArticleJobsByUserId(ctx.user.id);
      
      return jobs.map(job => ({
        id: job.id,
        status: job.status,
        currentStep: job.currentStep,
        progress: job.progress,
        theme: job.theme,
        targetWordCount: job.targetWordCount,
        authorName: job.authorName,
        targetPersona: job.targetPersona,
        remarks: job.remarks,
        offer: job.offer,
        keywords: job.keywords ? JSON.parse(job.keywords) : [],
        analyses: job.analyses ? JSON.parse(job.analyses) : [],
        criteria: job.criteria ? JSON.parse(job.criteria) : {},
        structure: job.structure,
        article: job.article,
        qualityCheck: job.qualityCheck ? JSON.parse(job.qualityCheck) : {},
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      }));
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        
        const [article] = await db.select().from(seoArticles)
          .where(eq(seoArticles.id, input.id));
        
        if (!article || article.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Article not found or access denied" });
        }
        
        return {
          ...article,
          keywords: JSON.parse(article.keywords || '[]'),
          analyses: JSON.parse(article.analyses || '[]'),
          criteria: JSON.parse(article.criteria || '{}'),
          qualityCheck: JSON.parse(article.qualityCheck || '{}'),
        };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        
        // Verify ownership
        const [article] = await db.select().from(seoArticles)
          .where(eq(seoArticles.id, input.id));
        
        if (!article || article.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Article not found or access denied" });
        }
        
        await db.delete(seoArticles).where(eq(seoArticles.id, input.id));
        return { success: true };
      }),

    // Create a new SEO article generation job (async)
    createJob: publicProcedure
      .input(z.object({ 
        theme: z.string(),
        targetWordCount: z.number().optional().default(5000),
        authorName: z.string().optional().default("赤原"),
        targetPersona: z.string().optional().default(""),
        remarks: z.string().optional().default(""),
        offer: z.string().optional().default(""),
        autoEnhance: z.boolean().optional().default(false)
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const userId = ctx.user?.id || 1;
          console.log('[createJob] Starting job creation...');
          console.log('[createJob] Input:', { 
            theme: input.theme, 
            targetWordCount: input.targetWordCount, 
            authorName: input.authorName, 
            targetPersona: input.targetPersona,
            remarks: input.remarks,
            offer: input.offer
          });
          console.log('[createJob] User ID:', userId);
          
          // Create job in database
          const jobId = await createSeoArticleJob({
            userId: userId,
            theme: input.theme,
            targetWordCount: input.targetWordCount,
            authorName: input.authorName,
            targetPersona: input.targetPersona,
            remarks: input.remarks,
            offer: input.offer,
            autoEnhance: input.autoEnhance ? 1 : 0,
            status: "pending",
            currentStep: 1,
            progress: 0,
          });
          
          console.log('[createJob] Job created with ID:', jobId);
          
          // Start background processing (don't await)
          const { processSeoArticleJob } = await import('./seoArticleJobProcessor');
          const { handleBackgroundError } = await import('./_core/errorHandler');
          handleBackgroundError(
            processSeoArticleJob(jobId),
            { context: `SEO Job ${jobId}`, jobId }
          );
          
          console.log('[createJob] Background processing started');
          return { jobId };
        } catch (error) {
          console.error('[createJob] Error occurred:', error);
          console.error('[createJob] Error name:', error.name);
          console.error('[createJob] Error message:', error.message);
          console.error('[createJob] Error stack:', error.stack);
          throw error;
        }
      }),

    // Get job status and progress
    getJobStatus: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ ctx, input }) => {
        const job = await getSeoArticleJobById(input.jobId);
        
        if (!job || job.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found or access denied" });
        }
        
        return {
          id: job.id,
          status: job.status,
          currentStep: job.currentStep,
          progress: job.progress,
          theme: job.theme,
          targetWordCount: job.targetWordCount,
          authorName: job.authorName,
          article: job.article,
          keywords: job.keywords ? JSON.parse(job.keywords) : null,
          analyses: job.analyses ? JSON.parse(job.analyses) : null,
          criteria: job.criteria ? JSON.parse(job.criteria) : null,
          structure: job.structure ? JSON.parse(job.structure) : null,
          qualityCheck: job.qualityCheck ? JSON.parse(job.qualityCheck) : null,
          errorMessage: job.errorMessage,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        };
      }),

    // List all jobs for current user
    listJobs: protectedProcedure.query(async ({ ctx }) => {
      const jobs = await getSeoArticleJobsByUserId(ctx.user.id);
      
      return jobs.map(job => ({
        id: job.id,
        status: job.status,
        currentStep: job.currentStep,
        progress: job.progress,
        theme: job.theme,
        targetWordCount: job.targetWordCount,
        authorName: job.authorName,
        keywords: job.keywords,
        analyses: job.analyses,
        criteria: job.criteria,
        structure: job.structure,
        article: job.article,
        qualityCheck: job.qualityCheck,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      }));
    }),

    rewrite: protectedProcedure
      .input(z.object({ 
        article: z.string(),
        qualityCheck: z.any(),
        authorName: z.string().optional().default("赤原")
      }))
      .mutation(async ({ input }) => {
        // Stub: rewriteArticle not implemented in seoArticleGenerator
        return {
          article: input.article,
          qualityCheck: input.qualityCheck
        };
      }),

    // 最終仕上げ専用エンドポイント（Step 8）
    polishArticle: protectedProcedure
      .input(z.object({
        article: z.string(),
        ragContext: z.string(),
        authorName: z.string().optional().default("赤原")
      }))
      .mutation(async ({ input }) => {
        // Stub: polishArticleStyle not implemented
        return {
          article: input.article
        };
      }),

    // 記事加工エンドポイント
    rewriteJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        // ジョブ情報を取得
        const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, input.jobId)).limit(1);
        if (job.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '記事がIDが見つかりません' });
        }

        const jobData = job[0];
        if (!jobData.article) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '完成した記事がありません' });
        }

        // キーワード達成状況を取得
        const qualityCheck = jobData.qualityCheck ? JSON.parse(jobData.qualityCheck as string) : null;
        if (!qualityCheck || !qualityCheck.keywordAchievement) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'キーワード達成状況が見つかりません' });
        }

        // 不足キーワードを抽出
        const keywordTargets = qualityCheck.keywordAchievement.map((ka: any) => ({
          keyword: ka.keyword,
          current: ka.count,
          target: ka.target,
          shortage: ka.target - ka.count
        }));

        // リライト実行
        const { rewriteArticle } = await import('./articleRewriter');
        const rewrittenArticle = await rewriteArticle({
          article: jobData.article,
          keywordTargets,
          theme: jobData.theme || '',
          authorName: jobData.authorName || '赤原'
        });

        // リライト後の記事を保存
        await db.update(seoArticleJobs)
          .set({ 
            article: rewrittenArticle,
            updatedAt: new Date()
          })
          .where(eq(seoArticleJobs.id, input.jobId));

        return {
          success: true,
          article: rewrittenArticle
        };
      }),

    enhance: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        options: z.object({
          fixKeywords: z.boolean().optional(),
          generateAIO: z.boolean().optional(),
          generateFAQ: z.boolean().optional(),
          generateJSONLD: z.boolean().optional(),
          generateMeta: z.boolean().optional(),
        })
      }))
      .mutation(async ({ ctx, input }) => {
        const { enhanceArticle } = await import('./articleEnhancer');
        const { seoArticleEnhancements } = await import('../drizzle/schema');
        
        // 記事を加工
        console.log('[enhance] Starting enhancement for jobId:', input.jobId, 'userId:', ctx.user.id, 'options:', input.options);
        const result = await enhanceArticle(input.jobId, ctx.user.id, input.options);
        
        // データベースに保存
        const db = await getDb();
        if (db) {
          console.log('[enhance] Saving to database with jobId:', input.jobId, 'userId:', ctx.user.id);
          await db.insert(seoArticleEnhancements).values({
            jobId: input.jobId,
            userId: ctx.user.id,
            originalArticle: result.enhancedArticle, // 元の記事（キーワード修正前）
            enhancedArticle: result.enhancedArticle,
            aioSummary: result.aioSummary || null,
            faqSection: result.faqSection || null,
            jsonLd: result.jsonLd ? JSON.stringify(result.jsonLd) : null,
            metaInfo: result.metaInfo ? JSON.stringify(result.metaInfo) : null,
          });
          console.log('[enhance] Successfully saved to database');
        } else {
          console.warn('[enhance] Database not available, skipping save');
        }
        
        return result;
      }),

    // 加工履歴を取得
    getEnhancement: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { seoArticleEnhancements } = await import('../drizzle/schema');
        const db = await getDb();
        if (!db) return null;
        
        const { eq, and } = await import('drizzle-orm');
        const enhancements = await db.select()
          .from(seoArticleEnhancements)
          .where(and(
            eq(seoArticleEnhancements.jobId, input.jobId),
            eq(seoArticleEnhancements.userId, ctx.user.id)
          ))
          .orderBy(seoArticleEnhancements.createdAt)
          .limit(1);
        
        if (enhancements.length === 0) return null;
        
        const enhancement = enhancements[0];
        return {
          ...enhancement,
          jsonLd: enhancement.jsonLd ? JSON.parse(enhancement.jsonLd) : null,
          metaInfo: enhancement.metaInfo ? JSON.parse(enhancement.metaInfo) : null,
        };
      }),

    // WordPress用HTMLエクスポート
    exportWordPressHTML: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        console.log('[exportWordPressHTML] Starting export for jobId:', input.jobId, 'userId:', ctx.user.id);
        const { generateWordPressHTML } = await import('./wordpressExporter');
        const { seoArticleEnhancements } = await import('../drizzle/schema');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        
        // 加工履歴を取得
        const { eq, and } = await import('drizzle-orm');
        const enhancements = await db.select()
          .from(seoArticleEnhancements)
          .where(and(
            eq(seoArticleEnhancements.jobId, input.jobId),
            eq(seoArticleEnhancements.userId, ctx.user.id)
          ))
          .orderBy(seoArticleEnhancements.createdAt)
          .limit(1);
        
        console.log('[exportWordPressHTML] Found enhancements:', enhancements.length);
        
        if (enhancements.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `加工履歴が見つかりません (jobId: ${input.jobId}, userId: ${ctx.user.id})` });
        }
        
        const enhancement = enhancements[0];
        const jsonLd = enhancement.jsonLd ? JSON.parse(enhancement.jsonLd) : null;
        const metaInfo = enhancement.metaInfo ? JSON.parse(enhancement.metaInfo) : null;
        
        // FAQをパース
        let faq: Array<{ question: string; answer: string }> | undefined;
        if (enhancement.faqSection) {
          console.log('[exportWordPressHTML] faqSection exists, length:', enhancement.faqSection.length);
          console.log('[exportWordPressHTML] faqSection preview:', enhancement.faqSection.substring(0, 200));
          try {
            // JSON形式でパースを試みる
            faq = JSON.parse(enhancement.faqSection);
            console.log('[exportWordPressHTML] FAQ parsed as JSON, count:', faq?.length);
          } catch (e) {
            // JSONでない場合はMarkdown形式から抽出
            console.log('[exportWordPressHTML] FAQ is not JSON, parsing as Markdown');
            faq = [];
            const faqText = enhancement.faqSection;
            // "### Q1: ...\nA: ..." 形式をパース（改行で区切られている）
            // 正規表現でマッチして抽出
            const qaRegex = /###\s*Q\d+:\s*(.+?)\n+A:\s*(.+?)(?=\n###|$)/gs;
            const matches = [...faqText.matchAll(qaRegex)];
            console.log('[exportWordPressHTML] Found QA matches:', matches.length);
            for (const match of matches) {
              if (match[1] && match[2]) {
                const question = match[1].trim();
                const answer = match[2].trim();
                console.log('[exportWordPressHTML] Extracted Q:', question.substring(0, 50));
                console.log('[exportWordPressHTML] Extracted A:', answer.substring(0, 50));
                faq.push({
                  question,
                  answer,
                });
              }
            }
            console.log('[exportWordPressHTML] Parsed FAQ count:', faq.length);
          }
        } else {
          console.log('[exportWordPressHTML] No faqSection found');
        }
        console.log('[exportWordPressHTML] Final FAQ count:', faq?.length || 0);
        
        // HTML生成
        console.log('[exportWordPressHTML] enhancement.enhancedArticle length:', enhancement.enhancedArticle?.length || 0);
        console.log('[exportWordPressHTML] enhancement.aioSummary length:', enhancement.aioSummary?.length || 0);
        const html = await generateWordPressHTML({
          body: enhancement.enhancedArticle || '',
          aioSection: enhancement.aioSummary || undefined,
          faq,
          metaInfo: {
            jsonLD: jsonLd,
            metaDescription: metaInfo?.description,
            metaKeywords: metaInfo?.keywords,
          },
        });
        
        return { html };
      }),

    // Cancel job
    cancelJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        console.log('[cancelJob] Starting cancellation for jobId:', input.jobId);
        const { getSeoArticleJobById, updateSeoArticleJob } = await import('./db');
        
        console.log('[cancelJob] Fetching job from database...');
        const job = await getSeoArticleJobById(input.jobId);
        console.log('[cancelJob] Job fetched:', job);
        if (!job) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'ジョブが見つかりません' });
        }
        
        if (job.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '権限がありません' });
        }
        
        if (job.status === 'completed') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '完了したジョブはキャンセルできません' });
        }
        
        if (job.status === 'cancelled') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '既にキャンセルされています' });
        }
        
        try {
          await updateSeoArticleJob(input.jobId, {
            status: 'cancelled' as const,
            errorMessage: 'ユーザーによりキャンセルされました',
          });
        } catch (error: any) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: `ジョブの更新に失敗しました: ${error.message}` 
          });
        }
        
        return { success: true, message: 'ジョブをキャンセルしました' };
      }),

    // CSV batch processing
    createBatchJob: protectedProcedure
      .input(z.object({ 
        csvContent: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { parseCSV, generateBatchId } = await import('./csvParser');
        const { createSeoArticleJob } = await import('./db');
        
        try {
          // Parse CSV
          const rows = parseCSV(input.csvContent);
          const batchId = generateBatchId();
          
          // Create jobs
          const jobIds: number[] = [];
          for (const row of rows) {
            const jobId = await createSeoArticleJob({
              userId: ctx.user.id,
              theme: row.theme,
              targetWordCount: row.targetWordCount,
              authorName: row.authorName,
              autoEnhance: row.autoEnhance ? 1 : 0,
              batchId,
              status: "pending" as const,
              currentStep: 1,
              progress: 0,
            });
            jobIds.push(jobId);
          }
          
          // Start background processing for all jobs
          const { processSeoArticleJob } = await import('./seoArticleJobProcessor');
          const { handleBackgroundError } = await import('./_core/errorHandler');
          for (const jobId of jobIds) {
            handleBackgroundError(
              processSeoArticleJob(jobId),
              { context: `SEO Job ${jobId}`, jobId, additionalInfo: { batchId } }
            );
          }
          
          return { 
            batchId,
            jobCount: jobIds.length,
            jobIds,
            message: `${jobIds.length}件の記事生成ジョブを作成しました`
          };
        } catch (error: any) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: `CSV解析エラー: ${error.message}` 
          });
        }
      }),

    // Get batch jobs
    getBatchJobs: protectedProcedure
      .input(z.object({ 
        batchId: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        
        const { eq, and, desc } = await import('drizzle-orm');
        const { seoArticleJobs } = await import('../drizzle/schema');
        
        let query = db.select()
          .from(seoArticleJobs)
          .where(eq(seoArticleJobs.userId, ctx.user.id))
          .orderBy(desc(seoArticleJobs.createdAt));
        
        if (input.batchId) {
          query = db.select()
            .from(seoArticleJobs)
            .where(and(
              eq(seoArticleJobs.userId, ctx.user.id),
              eq(seoArticleJobs.batchId, input.batchId)
            ))
            .orderBy(desc(seoArticleJobs.createdAt));
        }
        
        const jobs = await query;
        return jobs;
      }),

    // Download batch (multiple jobs as ZIP)
    downloadBatch: protectedProcedure
      .input(z.object({ 
        jobIds: z.array(z.number()),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        
        const { eq, and, inArray } = await import('drizzle-orm');
        const { seoArticleJobs } = await import('../drizzle/schema');
        
        // Get jobs
        const jobs = await db.select()
          .from(seoArticleJobs)
          .where(and(
            eq(seoArticleJobs.userId, ctx.user.id),
            inArray(seoArticleJobs.id, input.jobIds)
          ));
        
        if (jobs.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'ジョブが見つかりません' });
        }
        
        // Create ZIP file
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        
        for (const job of jobs) {
          if (job.status === 'completed' && job.article) {
            const fileName = `${job.theme.substring(0, 50).replace(/[/\\?%*:|"<>]/g, '_')}_${job.id}.md`;
            zip.file(fileName, job.article);
          }
        }
        
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        const base64 = zipBuffer.toString('base64');
        
        return { 
          data: base64,
          filename: `seo_articles_${Date.now()}.zip`,
          mimeType: 'application/zip'
        };
      }),
  }),

  promptTemplates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getPromptTemplatesByUserId(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        template: z.string(),
        variables: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createPromptTemplate({
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          template: input.template,
          variables: input.variables,
        });
        return { id };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const template = await getPromptTemplateById(input.id);
        if (!template || template.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
        }
        return template;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        template: z.string().optional(),
        variables: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const template = await getPromptTemplateById(input.id);
        if (!template || template.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
        }
        await updatePromptTemplate(input.id, {
          name: input.name,
          description: input.description,
          template: input.template,
          variables: input.variables,
        });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const template = await getPromptTemplateById(input.id);
        if (!template || template.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
        }
        await deletePromptTemplate(input.id);
        return { success: true };
      }),
  }),

   rag: router({
    listDocuments: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const docs = await db
        .select({
          id: ragDocuments.id,
          content: ragDocuments.content,
          sourceType: ragDocuments.type,
          sourceId: ragDocuments.sourceId,
          importance: ragDocuments.importance,
          usageCount: ragDocuments.importance,
          pickedUp: ragDocuments.pickedUp,
          createdAt: ragDocuments.createdAt,
        })
        .from(ragDocuments)
        .orderBy(desc(ragDocuments.createdAt));

      // Get tags for each document
      const docsWithTags = await Promise.all(
        docs.map(async (doc) => {
          const docTags = await db
            .select({
              category: tagCategories.name,
              value: tags.value,
              color: tags.color,
            })
            .from(ragDocumentTags)
            .innerJoin(tags, eq(ragDocumentTags.tagId, tags.id))
            .innerJoin(tagCategories, eq(tags.categoryId, tagCategories.id))
            .where(eq(ragDocumentTags.documentId, doc.id));

          return {
            ...doc,
            tags: docTags,
          };
        })
      );

      return docsWithTags;
    }),

    uploadDocument: protectedProcedure
      .input(
        z.object({
          fileName: z.string(),
          fileContent: z.string(),
          fileType: z.enum(['txt', 'docx', 'pdf', 'm4a']),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { extractTextFromFile } = await import('./textExtractor');
        
        const buffer = Buffer.from(input.fileContent, 'base64');
        const extractedText = await extractTextFromFile(buffer, input.fileType);

        if (!extractedText || extractedText.trim().length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'ファイルからテキストを抽出できませんでした',
          });
        }

        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        // Insert document
        const [insertResult] = await db.insert(ragDocuments).values({
          content: extractedText,
          type: 'file_upload',
          sourceId: input.fileName,
        });

        return { success: true };
      }),

    updateDocument: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          content: z.string(),
          tags: z.object({
            genre: z.array(z.string()),
            author: z.array(z.string()),
            contentType: z.array(z.string()),
            theme: z.array(z.string()),
          }),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        // Update content
        await db
          .update(ragDocuments)
          .set({ content: input.content })
          .where(
            and(
              eq(ragDocuments.id, input.documentId),
              eq(ragDocuments.userId, ctx.user.id)
            )
          );

        // Delete existing tags
        await db.delete(ragDocumentTags).where(eq(ragDocumentTags.documentId, input.documentId));

        // Add new tags
        const allTagValues = [
          ...input.tags.genre,
          ...input.tags.author,
          ...input.tags.contentType,
          ...input.tags.theme,
        ];

        if (allTagValues.length > 0) {
          const tagRecords = await db
            .select({ id: tags.id, value: tags.value })
            .from(tags)
            .where(inArray(tags.value, allTagValues));

          const tagInserts = tagRecords.map((tag) => ({
            documentId: input.documentId,
            tagId: tag.id,
          }));

          if (tagInserts.length > 0) {
            await db.insert(ragDocumentTags).values(tagInserts);
          }
        }

        return { success: true };
      }),

    updateDocumentTags: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          tagIds: z.array(z.number()),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        // Delete existing tags
        await db.delete(ragDocumentTags).where(eq(ragDocumentTags.documentId, input.documentId));

        // Insert new tags
        if (input.tagIds.length > 0) {
          await db.insert(ragDocumentTags).values(
            input.tagIds.map(tagId => ({
              documentId: input.documentId,
              tagId,
            }))
          );
        }

        return { success: true };
      }),

    togglePickup: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          pickedUp: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        await db
          .update(ragDocuments)
          .set({ pickedUp: input.pickedUp })
          .where(eq(ragDocuments.id, input.documentId));

        return { success: true };
      }),

    deleteDocument: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        // Delete tags first
        await db.delete(ragDocumentTags).where(eq(ragDocumentTags.documentId, input.documentId));

        // Delete document
        await db
          .delete(ragDocuments)
          .where(eq(ragDocuments.id, input.documentId));

        return { success: true };
      }),
  }),

  tags: router({
    // Get all tag categories
    getCategories: protectedProcedure
      .query(async () => {
        return await getAllTagCategories();
      }),

    // Get tags by category
    getTagsByCategory: protectedProcedure
      .input(z.object({ categoryId: z.number() }))
      .query(async ({ input }) => {
        return await getTagsByCategory(input.categoryId);
      }),

    // Get all tags with categories
    getAllWithCategories: protectedProcedure
      .query(async () => {
        return await getAllTagsWithCategories();
      }),

    // Create a new tag
    createTag: protectedProcedure
      .input(z.object({
        categoryId: z.number(),
        value: z.string(),
        displayName: z.string(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await createTag(input);
        return { id };
      }),

    // Update a tag
    updateTag: protectedProcedure
      .input(z.object({
        id: z.number(),
        value: z.string().optional(),
        displayName: z.string().optional(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateTag(input.id, {
          value: input.value,
          displayName: input.displayName,
          color: input.color,
          sortOrder: input.sortOrder,
        });
        return { success: true };
      }),

    // Delete a tag
    deleteTag: protectedProcedure
      .input(z.object({ tagId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        // Delete tag associations from RAG documents first
        await db.delete(ragDocumentTags).where(eq(ragDocumentTags.tagId, input.tagId));

        // Delete the tag itself
        await db.delete(tags).where(eq(tags.id, input.tagId));

        return { success: true };
      }),

    // Create a new tag category
    createCategory: protectedProcedure
      .input(z.object({
        name: z.string(),
        displayName: z.string(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await createTagCategory(input);
        return { id };
      }),

    // Update a tag category
    updateCategory: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        displayName: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateTagCategory(input.id, {
          name: input.name,
          displayName: input.displayName,
          description: input.description,
          sortOrder: input.sortOrder,
        });
        return { success: true };
      }),

    // Delete a tag category
    deleteCategory: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTagCategory(input.id);
        return { success: true };
      }),
  }),

  videoProject: router({
    // Create new video project
    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        theme: z.string(),
        targetAudience: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createVideoProject } = await import('./videoProjectDb');
        const projectId = await createVideoProject({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          theme: input.theme,
          targetAudience: input.targetAudience,
          status: 'draft',
        });
        return { projectId };
      }),

    // Get all projects for user
    list: protectedProcedure
      .query(async ({ ctx }) => {
        const { getVideoProjectsByUser } = await import('./videoProjectDb');
        return await getVideoProjectsByUser(ctx.user.id);
      }),

    // Get project by ID
    getById: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getVideoProjectByIdAndUser, getScenesByProjectId } = await import('./videoProjectDb');
        const project = await getVideoProjectByIdAndUser(input.projectId, ctx.user.id);
        if (!project) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'プロジェクトが見つかりません' });
        }
        const scenes = await getScenesByProjectId(input.projectId);
        return { project, scenes };
      }),

    // Generate video structure from strategies
    generateStructure: protectedProcedure
      .input(z.object({
        projectId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getVideoProjectByIdAndUser, createVideoScene, createVideoSlide } = await import('./videoProjectDb');
        const { analyzeStrategiesAndGenerateStructure, generateSlideImage } = await import('./videoGenerator');
        
        const project = await getVideoProjectByIdAndUser(input.projectId, ctx.user.id);
        if (!project) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'プロジェクトが見つかりません' });
        }

        // Generate structure
        const structure = await analyzeStrategiesAndGenerateStructure({
          theme: project.theme || project.title,
          targetAudience: project.targetAudience,
        });

        // Save scenes and slides
        for (const sceneData of structure.scenes) {
          const sceneId = await createVideoScene({
            projectId: input.projectId,
            sceneNumber: sceneData.sceneNumber,
            title: sceneData.title,
            script: sceneData.script,
          });

          for (const slideData of sceneData.slides) {
            // Generate slide image
            const imageUrl = await generateSlideImage({
              content: slideData.content,
              design: slideData.design,
              userId: ctx.user.id,
              projectId: input.projectId,
              sceneNumber: sceneData.sceneNumber,
              slideNumber: slideData.slideNumber,
            });

            await createVideoSlide({
              sceneId,
              slideNumber: slideData.slideNumber,
              content: slideData.content,
              design: JSON.stringify(slideData.design),
              imageUrl,
            });
          }
        }

        return { success: true, structure };
      }),

    // Delete project
    delete: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getVideoProjectByIdAndUser, deleteVideoProject } = await import('./videoProjectDb');
        const project = await getVideoProjectByIdAndUser(input.projectId, ctx.user.id);
        if (!project) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'プロジェクトが見つかりません' });
        }
        await deleteVideoProject(input.projectId);
        return { success: true };
      }),

    // Get slides by scene ID
    getSlidesByScene: protectedProcedure
      .input(z.object({ sceneId: z.number() }))
      .query(async ({ input }) => {
        const { getSlidesBySceneId } = await import('./videoProjectDb');
        return await getSlidesBySceneId(input.sceneId);
      }),

    // Generate video
    generateVideo: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getVideoProjectByIdAndUser, getScenesByProjectId, getSlidesBySceneId, updateVideoProject } = await import('./videoProjectDb');
        const { generateCompleteVideo } = await import('./videoRenderer');

        const project = await getVideoProjectByIdAndUser(input.projectId, ctx.user.id);
        if (!project) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'プロジェクトが見つかりません' });
        }

        // Update status to generating
        await updateVideoProject(input.projectId, { status: 'generating' });

        try {
          // Get scenes and slides
          const scenes = await getScenesByProjectId(input.projectId);
          const scenesWithSlides = await Promise.all(
            scenes.map(async (scene) => {
              const slides = await getSlidesBySceneId(scene.id);
              return {
                ...scene,
                slides: slides.filter(s => s.imageUrl),
              };
            })
          );

          // Generate video
          const videoUrl = await generateCompleteVideo({
            projectId: input.projectId,
            scenes: scenesWithSlides,
          });

          // Update project with video URL
          await updateVideoProject(input.projectId, {
            status: 'completed',
            videoUrl,
          });

          return { success: true, videoUrl };
        } catch (error) {
          await updateVideoProject(input.projectId, { status: 'failed' });
          throw error;
        }
      }),
  }),

  strategy: router({
    // Recommend strategies based on user's purpose
    recommend: protectedProcedure
      .input(z.object({
        purpose: z.string(),
        targetAudience: z.string().optional(),
        duration: z.string().optional(),
        style: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { recommendStrategies } = await import('./strategyRecommendation');
        return await recommendStrategies(input);
      }),

    // Update strategy document
    update: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        content: z.string(),
        tagIds: z.array(z.number()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        // Update document content
        await db.update(ragDocuments)
          .set({ content: input.content, updatedAt: new Date() })
          .where(eq(ragDocuments.id, input.documentId));

        // Update tags if provided
        if (input.tagIds) {
          // Delete existing tags
          await db.delete(ragDocumentTags)
            .where(eq(ragDocumentTags.documentId, input.documentId));

          // Insert new tags
          if (input.tagIds.length > 0) {
            await db.insert(ragDocumentTags)
              .values(input.tagIds.map(tagId => ({
                documentId: input.documentId,
                tagId,
              })));
          }
        }

        return { success: true };
      }),

    // Delete strategy document
    delete: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        // Delete document tags first
        await db.delete(ragDocumentTags)
          .where(eq(ragDocumentTags.documentId, input.documentId));

        // Delete document
        await db.delete(ragDocuments)
          .where(eq(ragDocuments.id, input.documentId));

        return { success: true };
      }),

    // Brainstorm with AI using RAG context
    brainstorm: protectedProcedure
      .input(z.object({
        message: z.string(),
        conversationHistory: z.array(z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { getRAGContextWithTags } = await import('./ragWithTags');
        
        // Get relevant strategies from RAG
        const ragContext = await getRAGContextWithTags({
          query: input.message,
          limit: 10,
        });

        // Build context from RAG
        const contextText = ragContext.map((doc: any) => 
          `[戦略: ${doc.type}] ${doc.content}`
        ).join('\n\n');

        // Build conversation messages
        const messages: any[] = [
          {
            role: 'system',
            content: `あなたは戦略コンサルタントです。以下のRAGに蓄積された戦略を参考に、ユーザーの質問に答えてください。

# 蓄積された戦略
${contextText}

# 回答のガイドライン
- 具体的で実践的なアイデアを提案する
- 蓄積された戦略を活用して回答する
- 「どんなツールを作れば実現できるか？」と聞かれたら、技術的な提案も含める
- 事業展開の可能性を広げる観点で回答する`,
          },
        ];

        // Add conversation history
        if (input.conversationHistory) {
          messages.push(...input.conversationHistory);
        }

        // Add current message
        messages.push({
          role: 'user',
          content: input.message,
        });

        // Call LLM
        const response = await invokeLLM({ messages });
        const aiResponse = response.choices[0].message.content;

        return {
          response: aiResponse,
        };
      }),

    // Search strategies with tag filters
    search: protectedProcedure
      .input(z.object({
        tagFilters: z.object({
          genre: z.array(z.string()).optional(),
          author: z.array(z.string()).optional(),
          contentType: z.array(z.string()).optional(),
          theme: z.array(z.string()).optional(),
          successLevel: z.array(z.string()).optional(),
        }).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const { searchRAGWithTags } = await import('./ragWithTags');
        const results = await searchRAGWithTags({
          tagFilters: input.tagFilters,
          limit: input.limit || 20,
        });
        return {
          strategies: results,
          total: results.length,
        };
      }),
  }),

  pdfStrategy: router({
    // Extract strategies from PDF by analysisId
    extractFromAnalysis: protectedProcedure
      .input(z.object({
        analysisId: z.number(),
        successLevel: z.enum(['高', '中', '低']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // Get analysis data
          const analysis = await getVideoAnalysisByIdAndUser(input.analysisId, ctx.user.id);
          if (!analysis) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: '分析結果が見つかりません',
            });
          }

          if (analysis.status !== 'completed') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: '分析が完了していません',
            });
          }

          // Generate PDF first if not exists
          const segments = await getTimelineSegmentsByAnalysisId(input.analysisId);
          const html = generateHtmlForPdf(analysis, segments);

          const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          });

          let pdfPath: string;
          try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({
              format: 'A4',
              margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm',
              },
              printBackground: true,
            });

            await browser.close();

            // Save PDF to temporary file
            const tmpDir = '/tmp';
            pdfPath = `${tmpDir}/${analysis.videoId}_analysis_${Date.now()}.pdf`;
            fs.writeFileSync(pdfPath, pdfBuffer);
          } catch (error) {
            await browser.close();
            throw error;
          }

          // Extract strategies from PDF
          const result = await processPDFAndExtractStrategies({
            pdfPath,
            videoId: analysis.videoId || undefined,
            videoTitle: analysis.title || undefined,
            successLevel: input.successLevel,
          });

          // Clean up temporary PDF file
          try {
            fs.unlinkSync(pdfPath);
          } catch (error) {
            console.error('[PDF Strategy] Failed to delete temporary PDF:', error);
          }

          return {
            success: true,
            strategies: result.strategies,
            savedCount: result.savedCount,
          };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `PDF戦略抽出に失敗しました: ${error.message}`,
          });
        }
      }),
  }),

  // Video generation
  videoGeneration: router({
    // VoiceVox speakers
    getSpeakers: publicProcedure
      .query(async () => {
        const { getSpeakers } = await import("./voicevoxClient");
        const speakers = await getSpeakers();
        return speakers;
      }),

    // Feedback procedures
    saveStrategyFeedback: protectedProcedure
      .input(z.object({
        strategyId: z.number(),
        editedFields: z.array(z.string()),
        successLevel: z.enum(["high", "medium", "low"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { saveStrategyFeedback } = await import("./ragFeedback");
        await saveStrategyFeedback({
          strategyId: input.strategyId,
          userId: ctx.user.id,
          editedFields: input.editedFields,
          successLevel: input.successLevel,
        });
        return { success: true };
      }),
    
    saveScenarioFeedback: protectedProcedure
      .input(z.object({
        scenarioId: z.number(),
        editedFields: z.array(z.string()),
        successLevel: z.enum(["high", "medium", "low"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { saveScenarioFeedback } = await import("./ragFeedback");
        await saveScenarioFeedback({
          scenarioId: input.scenarioId,
          userId: ctx.user.id,
          editedFields: input.editedFields,
          successLevel: input.successLevel,
        });
        return { success: true };
      }),
    
    saveSlidesFeedback: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        editedSlides: z.array(z.number()),
        successLevel: z.enum(["high", "medium", "low"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { saveSlidesFeedback } = await import("./ragFeedback");
        await saveSlidesFeedback({
          jobId: input.jobId,
          userId: ctx.user.id,
          editedSlides: input.editedSlides,
          successLevel: input.successLevel,
        });
        return { success: true };
      }),
    
    saveSuccessPattern: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        metrics: z.object({
          views: z.number().optional(),
          likes: z.number().optional(),
          comments: z.number().optional(),
          shares: z.number().optional(),
          watchTime: z.number().optional(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        const { saveSuccessPattern } = await import("./ragFeedback");
        await saveSuccessPattern({
          jobId: input.jobId,
          userId: ctx.user.id,
          metrics: input.metrics,
        });
        return { success: true };
      }),
    
    // Job management procedures
    // Create a new video generation job
    createJob: protectedProcedure
      .input(
        z.object({
          theme: z.string().min(1, "Theme is required"),
          speakerId: z.number().optional().default(3), // VoiceVox speaker ID
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const { videoGenerationJobs } = await import("../drizzle/schema");

        // Create a new job
        const [result] = await db.insert(videoGenerationJobs).values({
          userId: ctx.user.id,
          theme: input.theme,
          speakerId: input.speakerId,
          status: "pending",
          currentStep: 1,
          progress: 0,
          retryCount: 0,
        }).$returningId();

        return {
          jobId: result.id,
          message: "Video generation job created successfully",
        };
      }),

    // Get job status
    getJobStatus: protectedProcedure
      .input(
        z.object({
          jobId: z.number(),
        })
      )
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const { videoGenerationJobs } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const jobs = await db
          .select()
          .from(videoGenerationJobs)
          .where(eq(videoGenerationJobs.id, input.jobId));

        if (jobs.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
        }

        const job = jobs[0];

        // Check if the job belongs to the current user
        if (job.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized" });
        }

        return job;
      }),

    // List all jobs for the current user
    listJobs: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const { videoGenerationJobs } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");

      const jobs = await db
        .select()
        .from(videoGenerationJobs)
        .where(eq(videoGenerationJobs.userId, ctx.user.id))
        .orderBy(desc(videoGenerationJobs.createdAt));

      return jobs;
    }),

    // Delete a job
    deleteJob: protectedProcedure
      .input(
        z.object({
          jobId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const { videoGenerationJobs } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");

        // ユーザーが所有するジョブか確認
        const jobs = await db
          .select()
          .from(videoGenerationJobs)
          .where(
            and(
              eq(videoGenerationJobs.id, input.jobId),
              eq(videoGenerationJobs.userId, ctx.user.id)
            )
          );

        if (jobs.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found or access denied" });
        }

        // ジョブを削除
        await db
          .delete(videoGenerationJobs)
          .where(eq(videoGenerationJobs.id, input.jobId));

        return {
          success: true,
          message: "Job deleted successfully",
        };
      }),

    // Retry a failed job
    retryJob: protectedProcedure
      .input(
        z.object({
          jobId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const { videoGenerationJobs } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");

        // ユーザーが所有するジョブか確認
        const jobs = await db
          .select()
          .from(videoGenerationJobs)
          .where(
            and(
              eq(videoGenerationJobs.id, input.jobId),
              eq(videoGenerationJobs.userId, ctx.user.id)
            )
          );

        if (jobs.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found or access denied" });
        }

        const job = jobs[0];

        // 失敗したジョブのみ再試行可能
        if (job.status !== "failed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only failed jobs can be retried" });
        }

        // ジョブをリセット
        await db
          .update(videoGenerationJobs)
          .set({
            status: "pending",
            currentStep: 1,
            progress: 0,
            errorMessage: null,
            retryCount: (job.retryCount || 0) + 1,
          })
          .where(eq(videoGenerationJobs.id, input.jobId));

        return {
          success: true,
          message: "Job reset for retry",
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
