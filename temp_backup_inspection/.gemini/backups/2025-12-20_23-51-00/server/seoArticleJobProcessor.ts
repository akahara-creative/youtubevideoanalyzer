import { getSeoArticleJobById, updateSeoArticleJob } from "./db";
import { separateKeywords, generateSearchKeywords, analyzeTopArticles, extractPainPoints, generateStoryKeywords, generateOfferBridge, createSEOCriteria, createArticleStructure, generateSEOArticle, checkArticleQuality } from "./seoArticleGenerator";
import { saveToRAGWithTags } from "./ragWithTags";
import { getDb } from "./db";
import { ragDocuments, tags } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Process SEO article generation job in the background
 * This function runs asynchronously and updates the job status in the database
 */
export async function processSeoArticleJob(jobId: number): Promise<void> {
  console.log(`[SEO Job ${jobId}] Starting background processing...`);
  
  try {
    // Get job details
    const job = await getSeoArticleJobById(jobId);
    if (!job) {
      console.error(`[SEO Job ${jobId}] Job not found`);
      return;
    }
    
    // Update status to processing
    await updateSeoArticleJob(jobId, {
      status: "processing",
      currentStep: 1,
      progress: 0,
    });
    
    // Step 1: Confirm theme (already done, just update progress)
    console.log(`[SEO Job ${jobId}] Step 1: Theme confirmed - ${job.theme}`);
    await updateSeoArticleJob(jobId, {
      currentStep: 1,
      progress: 10,
    });
    
    // Step 1.5: Separate conclusion and traffic keywords
    console.log(`[SEO Job ${jobId}] Step 1.5: Separating keywords...`);
    const { conclusionKeywords, trafficKeywords } = await separateKeywords(job.theme);
    console.log(`[SEO Job ${jobId}] Conclusion keywords:`, conclusionKeywords);
    console.log(`[SEO Job ${jobId}] Traffic keywords:`, trafficKeywords);
    await updateSeoArticleJob(jobId, {
      progress: 15,
    });
    
    // Step 2: Generate search keywords (from traffic keywords only)
    console.log(`[SEO Job ${jobId}] Step 2: Generating search keywords...`);
    const keywords = await generateSearchKeywords(trafficKeywords);
    console.log(`[SEO Job ${jobId}] Generated ${keywords.length} keywords`);
    console.log(`[SEO Job ${jobId}] Keywords type: ${typeof keywords}, isArray: ${Array.isArray(keywords)}`);
    console.log(`[SEO Job ${jobId}] Keywords:`, keywords);
    await updateSeoArticleJob(jobId, {
      keywords: JSON.stringify({ conclusionKeywords, trafficKeywords, searchKeywords: keywords }),
      currentStep: 2,
      progress: 20,
    });
    
    // Step 3: Analyze top articles
    console.log(`[SEO Job ${jobId}] Step 3: Analyzing top articles...`);
    const allAnalyses: any[] = [];
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      console.log(`[SEO Job ${jobId}] Analyzing keyword ${i + 1}/${keywords.length}: ${keyword}`);
      try {
        const analyses = await analyzeTopArticles(keyword, keywords);
        allAnalyses.push(...analyses);
        
        // Update progress (20% + 30% * progress through keywords)
        const keywordProgress = Math.floor(30 * (i + 1) / keywords.length);
        await updateSeoArticleJob(jobId, {
          progress: 20 + keywordProgress,
        });
      } catch (error) {
        console.error(`[SEO Job ${jobId}] Error analyzing keyword "${keyword}":`, error);
        // Continue with other keywords even if one fails
      }
    }
    
    console.log(`[SEO Job ${jobId}] Analyzed ${allAnalyses.length} articles total`);
    await updateSeoArticleJob(jobId, {
      analyses: JSON.stringify(allAnalyses),
      currentStep: 3,
      progress: 50,
    });
    
    // Step 3.5: Extract reader pain points
    console.log(`[SEO Job ${jobId}] Step 3.5: Extracting reader pain points...`);
    const { painPoints, realVoices } = await extractPainPoints(job.theme, allAnalyses);
    console.log(`[SEO Job ${jobId}] Extracted ${painPoints.length} pain points and ${realVoices.length} real voices`);
    await updateSeoArticleJob(jobId, {
      progress: 52,
    });
    
    // Step 3.6: Generate story keywords
    console.log(`[SEO Job ${jobId}] Step 3.6: Generating story keywords...`);
    const { storyKeywords } = await generateStoryKeywords(painPoints, trafficKeywords, job.authorName);
    console.log(`[SEO Job ${jobId}] Generated ${storyKeywords.length} story keywords`);
    await updateSeoArticleJob(jobId, {
      progress: 53,
    });
    
    // Step 3.7: Generate offer bridge
    console.log(`[SEO Job ${jobId}] Step 3.7: Generating offer bridge...`);
    const { offerBridge } = await generateOfferBridge(painPoints, storyKeywords, conclusionKeywords, job.authorName);
    console.log(`[SEO Job ${jobId}] Generated ${offerBridge.length} offer bridges`);
    await updateSeoArticleJob(jobId, {
      progress: 55,
    });
    
    // Get RAG documents filtered by author name tag
    console.log(`[SEO Job ${jobId}] Getting RAG documents for author: ${job.authorName}`);
    const db = await getDb();
    let ragDocs: any[] = [];
    
    if (db) {
      try {
        // Find author tag by display name
        const authorTagResult = await db.select()
          .from(tags)
          .where(eq(tags.displayName, job.authorName))
          .limit(1);
        
        if (authorTagResult.length > 0) {
          const authorTagId = authorTagResult[0].id;
          console.log(`[SEO Job ${jobId}] Found author tag ID: ${authorTagId}`);
          
          // Get all document IDs with this tag
          // TODO: Implement document-tag relationship when schema is ready
          // const docTagsResult = await db.select()
          //   .from(documentTags)
          //   .where(eq(documentTags.tagId, authorTagId));
          // const docIds = docTagsResult.map(dt => dt.documentId);
          const docIds: number[] = [];
          console.log(`[SEO Job ${jobId}] Found ${docIds.length} documents with author tag (feature disabled)`);
          
          if (docIds.length > 0) {
            // Get documents
            ragDocs = await db.select()
              .from(ragDocuments)
              .where(and(
                eq(ragDocuments.pickedUp, true),
                // Filter by document IDs
              ));
            
            // Manual filter by docIds (since drizzle doesn't have inArray for this case)
            ragDocs = ragDocs.filter(doc => docIds.includes(doc.id));
            console.log(`[SEO Job ${jobId}] Filtered to ${ragDocs.length} picked-up documents`);
          }
        } else {
          console.log(`[SEO Job ${jobId}] Author tag not found, using all picked-up documents`);
          // Fallback: use all picked-up documents
          ragDocs = await db.select()
            .from(ragDocuments)
            .where(eq(ragDocuments.pickedUp, true));
        }
      } catch (error) {
        console.error(`[SEO Job ${jobId}] Error fetching RAG documents:`, error);
        // Continue with empty RAG docs
      }
    }
    
    // Generate RAG context from RAG documents + analyses + pain points + story keywords + offer bridge
    let ragContext = '';
    
    if (ragDocs.length > 0) {
      ragContext = ragDocs.map(doc => `### RAGドキュメント\n${doc.content}`).join('\n\n---\n\n') + '\n\n';
    }
    
    if (allAnalyses && allAnalyses.length > 0) {
      ragContext += allAnalyses
        .map(a => `記事タイトル: ${a.title}\n記事内容: ${a.content || '(内容なし)'}キーワード出現: ${JSON.stringify(a.keywordOccurrences || {})}`)
        .join('\n\n---\n\n');
    }
    
    ragContext += `\n\n### 読者の痛み・報われない希望\n${painPoints.join('\n')}\n\n### 生の声\n${realVoices.join('\n')}\n\n### 苦労したエピソードに繋げやすいキーワード\n${storyKeywords.join('\n')}\n\n### オファーへの橋渡し\n${offerBridge.join('\n')}`;
    // Step 4: Create SEO criteriaa
    console.log(`[SEO Job ${jobId}] Step 4: Creating SEO criteria...`);
    const criteria = await createSEOCriteria(allAnalyses, job.targetWordCount);
    console.log(`[SEO Job ${jobId}] Created criteria with ${Object.keys(criteria.keywords || {}).length} keywords`);
    await updateSeoArticleJob(jobId, {
      criteria: JSON.stringify(criteria),
      currentStep: 4,
      progress: 60,
    });
    
    // Step 5: Generate article structure
    console.log(`[SEO Job ${jobId}] Step 5: Generating article structure...`);
    const structure = await createArticleStructure(job.theme, criteria, ragContext, job.authorName, painPoints, storyKeywords, offerBridge);
    console.log(`[SEO Job ${jobId}] Generated structure with ${structure.h2Sections?.length || 0} H2 sections`);
    await updateSeoArticleJob(jobId, {
      structure: JSON.stringify(structure),
      currentStep: 5,
      progress: 70,
    });
    
    // Step 6: Generate article content
    console.log(`[SEO Job ${jobId}] Step 6: Generating article content...`);
    const article = await generateSEOArticle(structure, criteria, ragContext, job.authorName);
    console.log(`[SEO Job ${jobId}] Generated article with ${article.length} characters`);
    await updateSeoArticleJob(jobId, {
      article,
      currentStep: 6,
      progress: 80,
    });
    
    // Step 7: Quality check
    console.log(`[SEO Job ${jobId}] Step 7: Checking article quality...`);
    const qualityCheck = await checkArticleQuality(article, criteria);
    console.log(`[SEO Job ${jobId}] Quality check score: ${qualityCheck.overallScore}/100`);
    await updateSeoArticleJob(jobId, {
      qualityCheck: JSON.stringify(qualityCheck),
      currentStep: 7,
      progress: 90,
    });
    
    // Step 8: Post-processing (replace placeholder keywords, fix space keywords, remove how-to content)
    console.log(`[SEO Job ${jobId}] Step 8: Post-processing article...`);
    const { exportArticleWithPostProcessing } = await import('./seoArticleGenerator');
    let finalArticle = await exportArticleWithPostProcessing(article, conclusionKeywords);
    console.log(`[SEO Job ${jobId}] Post-processing completed`);
    
    if (qualityCheck.overallScore < 70) {
      console.log(`[SEO Job ${jobId}] Quality check score below 70 (score: ${qualityCheck.overallScore})`);
      console.log(`[SEO Job ${jobId}] Quality check completed with score: ${qualityCheck.overallScore}/100`);
    }
    
    // Save to RAG with tags
    console.log(`[SEO Job ${jobId}] Step 9: Saving to RAG with tags...`);
    try {
      await saveToRAGWithTags({
        content: `テーマ: ${job.theme}\n\n構成:\n${structure}\n\n記事:\n${finalArticle.substring(0, 5000)}`,
        type: 'seo_article',
        sourceId: `seo_job_${jobId}`,
        successLevel: qualityCheck.passed ? '高' : '中',
        tags: {
          genre: ['SEO'],
          contentType: ['構成パターン', '執筆スタイル'],
          author: job.authorName ? [job.authorName] : undefined,
        },
      });
      console.log(`[SEO Job ${jobId}] Saved to RAG successfully`);
    } catch (error) {
      console.error(`[SEO Job ${jobId}] Failed to save to RAG:`, error);
    }
    
    // Step 9: Auto-enhancement (if autoEnhance is enabled)
    const jobForEnhancement = await getSeoArticleJobById(jobId);
    if (jobForEnhancement && jobForEnhancement.autoEnhance === 1) {
      console.log(`[SEO Job ${jobId}] Step 9: Auto-enhancing article...`);
      
      try {
        const { enhanceArticle } = await import('./articleEnhancer');
        const result = await enhanceArticle(jobId, job.userId, {
          fixKeywords: true,      // スペースキーワード修正
          generateAIO: true,      // AIO要約生成
          generateFAQ: true,      // FAQ生成
          generateJSONLD: true,   // JSON-LD生成
          generateMeta: true,     // メタ情報生成
        });
        
        // 加工結果をデータベースに保存
        const { seoArticleEnhancements } = await import('../drizzle/schema');
        const { getDb } = await import('./db');
        const db = await getDb();
        if (db) {
          await db.insert(seoArticleEnhancements).values({
            jobId,
            userId: jobForEnhancement.userId,
            originalArticle: finalArticle,
            enhancedArticle: result.enhancedArticle,
            aioSummary: result.aioSummary,
            faqSection: result.faqSection,
            jsonLd: result.jsonLd ? JSON.stringify(result.jsonLd) : null,
            metaInfo: result.metaInfo ? JSON.stringify(result.metaInfo) : null,
          });
        }
        
        console.log(`[SEO Job ${jobId}] Auto-enhancement completed`);
      } catch (error) {
        console.error(`[SEO Job ${jobId}] Auto-enhancement failed:`, error);
        // エラーが発生しても記事生成自体は成功しているので、ジョブは完了扱い
      }
    }
    
    // Mark as completed
    await updateSeoArticleJob(jobId, {
      status: "completed",
      currentStep: jobForEnhancement && jobForEnhancement.autoEnhance === 1 ? 9 : 8,
      progress: 100,
      article: finalArticle,
      completedAt: new Date(),
    });
    
    console.log(`[SEO Job ${jobId}] Processing completed successfully`);
  } catch (error: any) {
    console.error(`[SEO Job ${jobId}] Error occurred:`, error);
    await updateSeoArticleJob(jobId, {
      status: "failed",
      errorMessage: error.message || String(error),
    });
  }
}


