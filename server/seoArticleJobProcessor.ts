import { getSeoArticleJobById, updateSeoArticleJob } from "./db";
import { separateKeywords, generateSearchKeywords, analyzeTopArticles, extractPainPoints, generateStoryKeywords, generateOfferBridge, createSEOCriteria, createArticleStructure, generateSEOArticle, checkArticleQuality } from "./seoArticleGenerator";
import { saveToRAGWithTags } from "./ragWithTags";
import { getDb } from "./db";
import { ragDocuments, tags } from "../drizzle/schema";
import { eq, and, inArray, like, or } from "drizzle-orm";

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
    const { conclusionKeywords, trafficKeywords } = await separateKeywords(job.theme, job.remarks || undefined);
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

    // Save competitor articles to RAG
    console.log(`[SEO Job ${jobId}] Saving competitor articles to RAG...`);
    const competitorDocIds = await saveCompetitorArticlesToRAG(allAnalyses, jobId);
    console.log(`[SEO Job ${jobId}] Saved ${competitorDocIds.length} competitor articles to RAG`);
    
    // Step 2.5: Generate Personas
    console.log(`[SEO Job ${jobId}] Step 2.5: Generating personas...`);
    const { generateTargetPersona, generateWriterPersona, generateEditorPersona } = await import('./personaGenerator');
    
    // Generate Target Persona
    let targetPersona;
    if (job.targetPersona) {
      targetPersona = await generateTargetPersona(job.targetPersona, job.theme);
    } else {
      // Default fallback if no persona input
      targetPersona = await generateTargetPersona("30代男性、会社員、副業で稼げない", job.theme);
    }
    
    // Generate Writer Persona (Akahara)
    const writerPersona = await generateWriterPersona();
    
    // Generate Editor Persona (Composition Writer)
    const editorPersona = await generateEditorPersona();
    
    const generatedPersonas = {
      target: targetPersona,
      writer: writerPersona,
      editor: editorPersona
    };
    
    await updateSeoArticleJob(jobId, {
      generatedPersonas: JSON.stringify(generatedPersonas)
    });
    console.log(`[SEO Job ${jobId}] Personas generated and saved`);

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
    const { offerBridge } = await generateOfferBridge(painPoints, storyKeywords, conclusionKeywords, job.authorName, job.offer || undefined);
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
        // 1. Author-based retrieval (existing logic)
        let authorDocs: typeof ragDocs = [];
        const authorTagResult = await db.select()
          .from(tags)
          .where(eq(tags.displayName, job.authorName))
          .limit(1);
        
        if (authorTagResult.length > 0) {
          const authorTagId = authorTagResult[0].id;
          // Get documents with author tag (using raw query or join if needed, but for now assuming we fix the join later)
          // For now, let's just get pickedUp docs as fallback or if we can implement the join
          // Since the previous code had "feature disabled", let's keep it simple and focus on the new requirement.
        }

        // 2. Priority documents (existing logic)
        const priorityDocs = await db.select()
          .from(ragDocuments)
          .where(eq(ragDocuments.pickedUp, 1));
        
        // 3. Theme/Keyword-based retrieval (NEW) - DISABLED for stability (Job 44 reproduction)
        // Search for documents containing "仕組み化" or other keywords in content or tags
        // We use a simple LIKE query on content for now as it's most robust if tags are missing
        // Also include remarks in the search to capture intent (e.g. "Systemization")
        /*
        const themeKeywords = [job.theme, job.remarks || '', ...keywords].join(' ');
        // Extract potential keywords (simple split)
        const potentialTags = (job.theme + ' ' + (job.remarks || '')).split(/[\s　]+/).filter(w => w.length > 1);
        
        let keywordDocs: typeof ragDocs = [];
        if (potentialTags.length > 0) {
           const conditions = potentialTags.map(tag => like(ragDocuments.content, `%${tag}%`));
           keywordDocs = await db.select()
             .from(ragDocuments)
             .where(or(...conditions))
             .limit(5); // Limit to 5 most relevant by keyword match
           console.log(`[SEO Job ${jobId}] Found ${keywordDocs.length} documents matching theme keywords: ${potentialTags.join(', ')}`);
        }
        */
        let keywordDocs: typeof ragDocs = [];

        // Combine and deduplicate
        const allDocs = [...priorityDocs, ...keywordDocs];
        const uniqueDocsMap = new Map();
        allDocs.forEach(doc => uniqueDocsMap.set(doc.id, doc));
        ragDocs = Array.from(uniqueDocsMap.values());
        
        console.log(`[SEO Job ${jobId}] Total RAG documents used: ${ragDocs.length}`);

      } catch (error) {
        console.error(`[SEO Job ${jobId}] Error fetching RAG documents:`, error);
        // Continue with empty RAG docs
      }
    }
    
    // Generate RAG context from RAG documents + analyses + pain points + story keywords + offer bridge
    let ragContext = '';
    
    if (ragDocs.length > 0) {
      // Define roles for specific IDs (User Request Job 82 - Deep Understanding)
      const ragRoles: Record<number, string> = {
        1856: "【核となる思考OS】読者の感情を抉り取るための「通るオファーのロジック（6章構成）」。単なる解説ではなく、読者の痛みを暴き、共感させるための設計図。",
        4: "【文体・ルールの補強】#1856の感情的アプローチを支えるための、赤原スタイルの基礎ルール。",
        1896: "【行間の詰め方の事例】「100人中100人が同じ理解をする」ための、徹底的な背景描写と文脈説明のサンプル。読み手の理解の隙間を埋める書き方の手本。",
        1841: "【市場の現実（証拠）】稼げない根本原因（労働収入・競合過多）を論理的に説明するための理論武装資料。"
      };

      ragContext = ragDocs.map(doc => {
        const roleInstruction = ragRoles[doc.id] 
          ? `\n【利用指示】このドキュメントは「${ragRoles[doc.id]}」として参照し、その役割に沿って活用してください。` 
          : '';
        return `### RAGドキュメント (ID: ${doc.id})${roleInstruction}\n${doc.content}`;
      }).join('\n\n---\n\n') + '\n\n';
    }
    
    // Fetch competitor docs from RAG (Compressed for Step 5)
    let competitorContext = '';
    if (db && competitorDocIds.length > 0) {
      try {
        const competitorDocs = await db.select().from(ragDocuments).where(inArray(ragDocuments.id, competitorDocIds));
        // Compress: First 1000 chars (Summary) - ragDocuments has no title
        competitorContext = competitorDocs.map(d => `### 競合記事データ (ID: ${d.id})\n内容要約:\n${d.content.substring(0, 1000)}...\n(以下略)`).join('\n\n---\n\n');
        console.log(`[SEO Job ${jobId}] Fetched and compressed ${competitorDocs.length} competitor docs from RAG`);
      } catch (e) {
        console.error(`[SEO Job ${jobId}] Error fetching competitor docs:`, e);
      }
    }

    if (competitorContext) {
      ragContext += competitorContext + '\n\n';
    } /* else if (allAnalyses && allAnalyses.length > 0) {
      // Fallback to in-memory analyses if RAG fetch failed
      // DISABLED: This causes massive context bloat (50k+ chars) which crashes Local LLM
      ragContext += allAnalyses
        .map(a => `記事タイトル: ${a.title}\n記事内容: ${a.content || '(内容なし)'} キーワード出現: ${JSON.stringify(a.keywordOccurrences || {})}`)
        .join('\n\n---\n\n');
    } */
    
    ragContext += `\n\n### 読者の痛み・報われない希望\n${painPoints.join('\n')}\n\n### 生の声\n${realVoices.join('\n')}\n\n### 苦労したエピソードに繋げやすいキーワード\n${storyKeywords.join('\n')}\n\n### オファーへの橋渡し\n${offerBridge.join('\n')}`;
    // Step 4: Create SEO criteria
    console.log(`[SEO Job ${jobId}] Step 4: Creating SEO criteria...`);
    const criteria = await createSEOCriteria(allAnalyses, job.targetWordCount);
    console.log(`[SEO Job ${jobId}] Created criteria with ${criteria.targetKeywords.length} keywords`);
    await updateSeoArticleJob(jobId, {
      criteria: JSON.stringify(criteria),
      currentStep: 4,
      progress: 60,
    });
    
    // Step 5: Create article structure (Using Light Persona to save context)
    console.log(`[SEO Job ${jobId}] Step 5: Creating article structure...`);
    
    // Create Light Persona (Style only, remove heavy Description)
    // IMPORTANT: Enforce "Polite Reality Check Tone" & "Future Pacing Structure" here
    const lightWriterPersona = {
      ...generatedPersonas.writer,
      description: "【重要：口調定義】\n・「〜です/〜ます」調（敬体）で統一。\n・単なる丁寧語は禁止。\n・「相手が薄々気づきつつも、目を背け続けている現実を、実体験と相談エピソードを軸に突きつける」スタイル。\n・「僕はこれが闇だと考えています。あなたはどう思いますか？」と、客観的証拠を前提に読者を追い詰めること。\n\n【重要：構成ルール】\n・必ず「地獄（現状の苦しみ）→出会い（気づき）→天国（解決後の理想の日常）→勧誘」の流れにすること。\n・「〜のやり方」「〜とは」といったノウハウ解説の章は絶対に作らないこと。\n・この口調と構成ルールで構成案を作成すること。"
    };
    
    const lightPersonas = {
      ...generatedPersonas,
      writer: lightWriterPersona
    };

    let structureResult;
    let structureMarkdown = "";
    
    // Try to parse existing structure if available (for resume)
    if (job.structure) {
      try {
        const parsed = JSON.parse(job.structure);
        if (parsed.structure) {
          structureResult = parsed;
          structureMarkdown = parsed.structure;
          console.log(`[SEO Job ${jobId}] Using existing structure`);
        }
      } catch (e) {
        console.warn(`[SEO Job ${jobId}] Failed to parse potential JSON structure:`, e);
      }
    }
    
    if (!structureMarkdown) {
      console.log(`[SEO Job ${jobId}] ragContext length: ${ragContext.length}`); // DEBUG: Check total context size
      try {
        const fs = await import('fs');
        fs.writeFileSync('/Users/koyanagimakotohiroshi/youtube-video-analyzer/debug_rag_context.txt', `Length: ${ragContext.length}\n\nPreview:\n${ragContext.substring(0, 1000)}`);
      } catch (e) {
        console.error('Failed to write debug log', e);
      }
      // Pass lightPersonas to avoid context overflow
      structureResult = await createArticleStructure(job.theme, criteria, ragContext, job.authorName, painPoints, storyKeywords, offerBridge, conclusionKeywords, lightPersonas, job.remarks || undefined, job.offer || undefined);
      structureMarkdown = structureResult.structure;
    }
    
    console.log(`[SEO Job ${jobId}] structureResult:`, JSON.stringify(structureResult));
    
    // Sanitize structure: If it looks like JSON, try to extract the inner structure
    if (structureMarkdown.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(structureMarkdown);
        if (parsed.structure && typeof parsed.structure === 'string') {
          console.log(`[SEO Job ${jobId}] Detected nested JSON in structure. Extracting inner structure.`);
          structureMarkdown = parsed.structure;
        }
      } catch (e) {
        console.warn(`[SEO Job ${jobId}] Failed to parse potential JSON structure:`, e);
      }
    }
    
    console.log(`[SEO Job ${jobId}] Generated structure length: ${structureMarkdown.length}`);
    if (structureResult.estimates) {
      console.log(`[SEO Job ${jobId}] Estimated word count: ${structureResult.estimates.wordCount}`);
    }

    await updateSeoArticleJob(jobId, {
      structure: JSON.stringify(structureResult),
      currentStep: 5,
      progress: 70,
    });
    
    // Step 6: Generate article content
    console.log(`[SEO Job ${jobId}] Step 6: Generating article content...`);
    const article = await generateSEOArticle(structureMarkdown, criteria, ragContext, job.authorName, conclusionKeywords, generatedPersonas, job.remarks || undefined, job.offer || undefined);
    console.log(`[SEO Job ${jobId}] Generated article with ${article.length} characters`);
    await updateSeoArticleJob(jobId, {
      article,
      currentStep: 6,
      progress: 80,
    });
    
    // Step 7: Quality check & Refinement
    console.log(`[SEO Job ${jobId}] Step 7: Checking and refining article quality...`);
    
    // Refine with personas first
    // Refine with personas first
    const { refineArticleWithPersonas } = await import('./seoArticleGenerator');
    const refinedArticle = await refineArticleWithPersonas(article, generatedPersonas, criteria, painPoints);
    // const refinedArticle = article; // Skip refinement to prevent truncation
    
    // Update article if refined
    if (refinedArticle !== article) {
      console.log(`[SEO Job ${jobId}] Article refined by personas`);
      await updateSeoArticleJob(jobId, {
        article: refinedArticle
      });
    }

    const qualityCheck = await checkArticleQuality(refinedArticle, criteria, structureResult.estimates);
    console.log(`[SEO Job ${jobId}] Quality check passed: ${qualityCheck.passed}`);
    await updateSeoArticleJob(jobId, {
      qualityCheck: JSON.stringify(qualityCheck),
      currentStep: 7,
      progress: 90,
    });
    
    // Step 8: Post-processing (replace placeholder keywords, fix space keywords, remove how-to content)
    console.log(`[SEO Job ${jobId}] Step 8: Post-processing article...`);
    const { exportArticleWithPostProcessing } = await import('./seoArticleGenerator');
    let finalArticle = await exportArticleWithPostProcessing(refinedArticle, conclusionKeywords);
    console.log(`[SEO Job ${jobId}] Post-processing completed`);
    
    if (!qualityCheck.passed) {
      console.log(`[SEO Job ${jobId}] Quality check failed`);
      console.log(`[SEO Job ${jobId}] Issues: ${qualityCheck.issues.join(', ')}`);
    }
    
    // Save to RAG with tags
    console.log(`[SEO Job ${jobId}] Step 9: Saving to RAG with tags...`);
    try {
      await saveToRAGWithTags({
        content: `テーマ: ${job.theme}\n\n構成:\n${structureMarkdown}\n\n記事:\n${finalArticle.substring(0, 5000)}`,
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

/**
 * Save competitor articles to RAG
 */
async function saveCompetitorArticlesToRAG(analyses: any[], jobId: number): Promise<number[]> {
  const { createTagCategory, createTag } = await import("./db");
  const { saveToRAGWithTags } = await import("./ragWithTags");
  const { getDb } = await import("./db");
  const { tagCategories, tags } = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");
  
  const db = await getDb();
  if (!db) return [];

  // 1. Ensure "competitor" category exists
  let categoryId: number;
  const existingCategory = await db.select().from(tagCategories).where(eq(tagCategories.name, "competitor")).limit(1);
  
  if (existingCategory.length > 0) {
    categoryId = existingCategory[0].id;
  } else {
    try {
      categoryId = await createTagCategory({
        name: "competitor",
        displayName: "競合記事",
        description: "SEO分析で収集した競合記事データ"
      });
    } catch (e) {
      // Handle race condition or error
      console.error("Error creating competitor category:", e);
      return [];
    }
  }

  // 2. Ensure "competitor_article" tag exists
  const existingTag = await db.select().from(tags).where(and(eq(tags.categoryId, categoryId), eq(tags.value, "competitor_article"))).limit(1);
  
  if (existingTag.length === 0) {
    try {
      await createTag({
        categoryId,
        value: "competitor_article",
        displayName: "競合記事",
        color: "#EF4444" // Red
      });
    } catch (e) {
      console.error("Error creating competitor tag:", e);
    }
  }

  // 3. Save each analysis
  const savedDocIds: number[] = [];
  
  for (const analysis of analyses) {
    try {
      // Format content with rich metadata
      const content = `
タイトル: ${analysis.title}
URL: ${analysis.url}
文字数: ${analysis.wordCount}
H2数: ${analysis.h2Count}
H3数: ${analysis.h3Count}

【検索キーワード】
${analysis.keywordOccurrences?.map((k: any) => `- ${k.keyword}: ${k.count}回`).join('\n') || 'なし'}

【戦略・意図】
${analysis.strategy || '不明'}

【特記事項】
${analysis.specialNotes || 'なし'}

【見出し構成】
H1: ${analysis.h1?.join('\n') || 'なし'}
H2: ${analysis.h2?.join('\n') || 'なし'}
H3: ${analysis.h3?.join('\n') || 'なし'}

【本文内容】
${analysis.content}
`;

      const result = await saveToRAGWithTags({
        content,
        type: 'competitor_article',
        sourceId: `seo_job_${jobId}_competitor`,
        successLevel: '中', // Default
        tags: {
          competitor: ['competitor_article']
        }
      });
      
      if (result.success && result.documentId) {
        savedDocIds.push(result.documentId);
      }
    } catch (error) {
      console.error("Error saving competitor article to RAG:", error);
    }
  }
  
  return savedDocIds;
}


