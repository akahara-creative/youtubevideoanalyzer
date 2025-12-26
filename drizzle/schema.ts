import { int, longtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Video analysis table - stores analysis results for each YouTube video
 */
export const videoAnalyses = mysqlTable("videoAnalyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  youtubeUrl: varchar("youtubeUrl", { length: 500 }).notNull(),
  videoId: varchar("videoId", { length: 100 }).notNull(),
  title: text("title"),
  status: mysqlEnum("status", ["processing", "completed", "failed", "cancelled"]).default("processing").notNull(),
  currentStep: varchar("currentStep", { length: 100 }), // Current processing step
  progress: int("progress").default(0), // Progress percentage (0-100)
  estimatedTimeRemaining: int("estimatedTimeRemaining"), // Estimated seconds remaining
  stepProgress: text("stepProgress"), // JSON: { download: 100, transcription: 50, frameExtraction: 0, frameAnalysis: 0, summary: 0 }
  summary: text("summary"),
  learningPoints: text("learningPoints"),
  errorMessage: text("errorMessage"),
  errorDetails: text("errorDetails"), // JSON: { stack, command, env, timestamp }
  shareToken: varchar("shareToken", { length: 64 }).unique(),
  isPublic: int("isPublic").default(0).notNull(), // 0: private, 1: public
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VideoAnalysis = typeof videoAnalyses.$inferSelect;
export type InsertVideoAnalysis = typeof videoAnalyses.$inferInsert;

/**
 * Timeline segments table - stores timestamped segments with transcription and visual analysis
 */
export const timelineSegments = mysqlTable("timelineSegments", {
  id: int("id").autoincrement().primaryKey(),
  analysisId: int("analysisId").notNull(),
  startTime: int("startTime").notNull(), // seconds
  endTime: int("endTime").notNull(), // seconds
  transcription: text("transcription"),
  visualDescription: text("visualDescription"),
  codeContent: text("codeContent"),
  codeExplanation: text("codeExplanation"),
  frameUrl: varchar("frameUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TimelineSegment = typeof timelineSegments.$inferSelect;
export type InsertTimelineSegment = typeof timelineSegments.$inferInsert;

/**
 * Export history table - stores exported files (PDF, Markdown)
 */
export const exportHistory = mysqlTable("exportHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  analysisId: int("analysisId").notNull(),
  exportType: mysqlEnum("exportType", ["pdf", "markdown"]).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileSize: int("fileSize"), // in bytes
  category: varchar("category", { length: 100 }), // e.g., "tutorial", "lecture", "documentation"
  tags: text("tags"), // JSON array of tags, e.g., ["python", "machine-learning"]
  notes: text("notes"), // User notes about the export
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExportHistory = typeof exportHistory.$inferSelect;
export type InsertExportHistory = typeof exportHistory.$inferInsert;

/**
 * Chat conversations table - stores AI chat sessions
 */
export const chatConversations = mysqlTable("chatConversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }),
  keywordProjectId: int("keywordProjectId"), // Selected keyword project for this conversation
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = typeof chatConversations.$inferInsert;

/**
 * Chat messages table - stores individual messages in conversations
 */
export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  ragContext: longtext("ragContext"), // RAG search results used for this message
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
/**
 * Content imports table - stores imported content (newsletters, documents, etc.)
 */
export const contentImports = mysqlTable("contentImports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileType: mysqlEnum("fileType", ["txt", "docx", "pdf", "m4a"]).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileSize: int("fileSize"), // in bytes
  extractedText: longtext("extractedText"), // Full extracted text (supports up to 4GB)
  category: varchar("category", { length: 100 }), // e.g., "newsletter", "article", "document"
  tags: text("tags"), // JSON array of tags
  notes: text("notes"), // User notes
  ragId: varchar("ragId", { length: 100 }), // Reference to RAG document ID
  isPinned: int("isPinned").default(0).notNull(), // 0: normal, 1: pinned (always included in RAG context)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContentImport = typeof contentImports.$inferSelect;
export type InsertContentImport = typeof contentImports.$inferInsert;

// Long-form content generation
export const longContents = mysqlTable("longContents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  prompt: text("prompt").notNull(), // Original user prompt
  content: text("content"), // Generated content (can be very long)
  targetWordCount: int("targetWordCount"), // Target word count (e.g., 20000)
  actualWordCount: int("actualWordCount"), // Actual generated word count
  status: mysqlEnum("status", ["pending", "generating", "completed", "failed"]).default("pending").notNull(),
  contentType: mysqlEnum("contentType", ["blog", "article", "essay", "report"]).default("blog").notNull(),
  tone: varchar("tone", { length: 100 }), // e.g., "professional", "casual", "academic"
  keywords: text("keywords"), // JSON array of target keywords
  useRAGStyle: int("useRAGStyle").default(0).notNull(), // Whether to use RAG-based writing style (0 or 1)
  seoScore: int("seoScore"), // SEO score (0-100)
  ragId: varchar("ragId", { length: 100 }), // Reference to RAG document ID
  errorMessage: text("errorMessage"), // Error message if generation failed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type LongContent = typeof longContents.$inferSelect;
export type InsertLongContent = typeof longContents.$inferInsert;

// Content chunks for long-form generation (to track progress)
export const contentChunks = mysqlTable("contentChunks", {
  id: int("id").autoincrement().primaryKey(),
  longContentId: int("longContentId").notNull(),
  chunkIndex: int("chunkIndex").notNull(), // Order of the chunk (0, 1, 2, ...)
  content: text("content").notNull(), // Chunk content
  wordCount: int("wordCount").notNull(),
  status: mysqlEnum("status", ["pending", "generating", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContentChunk = typeof contentChunks.$inferSelect;
export type InsertContentChunk = typeof contentChunks.$inferInsert;

/**
 * Keyword projects table - manages multiple keywords for SEO article generation
 */
export const keywordProjects = mysqlTable("keywordProjects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetUrl: varchar("targetUrl", { length: 500 }), // Target article URL
  status: mysqlEnum("status", ["draft", "in_progress", "completed"]).default("draft").notNull(),
  strategyData: longtext("strategyData"), // JSON: Generated strategy data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KeywordProject = typeof keywordProjects.$inferSelect;
export type InsertKeywordProject = typeof keywordProjects.$inferInsert;

/**
 * Keyword project items table - individual keywords within a project
 */
export const keywordProjectItems = mysqlTable("keywordProjectItems", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  keyword: varchar("keyword", { length: 255 }).notNull(),
  targetCount: int("targetCount").default(0).notNull(), // Target keyword occurrence count
  currentCount: int("currentCount").default(0).notNull(), // Current keyword occurrence count
  searchVolume: int("searchVolume"), // Monthly search volume from Google Trends
  competition: varchar("competition", { length: 50 }), // low, medium, high
  seoAnalysisData: longtext("seoAnalysisData"), // JSON: SEO analysis results
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KeywordProjectItem = typeof keywordProjectItems.$inferSelect;
export type InsertKeywordProjectItem = typeof keywordProjectItems.$inferInsert;

/**
 * Generated contents table - stores all AI-generated content from chat
 */
export const generatedContents = mysqlTable("generatedContents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  conversationId: int("conversationId"), // Optional: link to chat conversation
  contentType: mysqlEnum("contentType", ["general", "email", "slide", "script", "longContent"]).notNull(),
  title: varchar("title", { length: 255 }),
  content: longtext("content").notNull(),
  keywordProjectId: int("keywordProjectId"), // Optional: link to keyword project
  keywordCounts: longtext("keywordCounts"), // JSON: keyword occurrence counts
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GeneratedContent = typeof generatedContents.$inferSelect;
export type InsertGeneratedContent = typeof generatedContents.$inferInsert;

/**
 * Prompt templates table - stores reusable prompt templates for AI chat
 */
export const promptTemplates = mysqlTable("promptTemplates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  template: longtext("template").notNull(),
  variables: longtext("variables"), // JSON: template variables like {theme}, {keyword}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = typeof promptTemplates.$inferInsert;

/**
 * SEO articles table - stores generated SEO articles with full process data
 */
export const seoArticles = mysqlTable("seoArticles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  theme: varchar("theme", { length: 500 }).notNull(),
  keywords: longtext("keywords"), // JSON: array of keywords
  analyses: longtext("analyses"), // JSON: competitor analysis data
  criteria: longtext("criteria"), // JSON: SEO criteria (word count, H2/H3 count, keyword targets)
  structure: longtext("structure"), // Article structure
  article: longtext("article").notNull(), // Final article content
  qualityCheck: longtext("qualityCheck"), // JSON: quality check results
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SeoArticle = typeof seoArticles.$inferSelect;
export type InsertSeoArticle = typeof seoArticles.$inferInsert;

/**
 * SEO article jobs table - manages asynchronous SEO article generation jobs
 */
export const seoArticleJobs = mysqlTable("seoArticleJobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  theme: varchar("theme", { length: 500 }).notNull(),
  targetWordCount: int("targetWordCount").default(5000).notNull(),
  authorName: varchar("authorName", { length: 128 }).default("赤原").notNull(),
  targetPersona: text("targetPersona"), // User input: target persona characteristics
  remarks: text("remarks"), // User input for remarks (outline, direction, keywords)
  offer: text("offer"), // User input for offer (CTA, step mail, etc.)
  generatedPersonas: longtext("generatedPersonas"), // JSON: generated personas (Target, Writer, Editor)
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed", "cancelled"]).default("pending").notNull(),
  currentStep: int("currentStep").default(1), // Current step (1-8)
  progress: int("progress").default(0), // Progress percentage (0-100)
  keywords: longtext("keywords"), // JSON: array of keywords
  analyses: longtext("analyses"), // JSON: competitor analysis data
  criteria: longtext("criteria"), // JSON: SEO criteria
  structure: longtext("structure"), // Article structure
  article: longtext("article"), // Final article content
  qualityCheck: longtext("qualityCheck"), // JSON: quality check results
  errorMessage: text("errorMessage"),
  autoEnhance: int("autoEnhance").default(0).notNull(), // 0: manual, 1: auto-enhance after generation
  batchId: varchar("batchId", { length: 64 }), // Batch ID for CSV batch processing
  completedAt: timestamp("completedAt"), // Completion timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SeoArticleJob = typeof seoArticleJobs.$inferSelect;
export type InsertSeoArticleJob = typeof seoArticleJobs.$inferInsert;

/**
 * SEO article enhancements table - stores enhanced versions of SEO articles
 */
export const seoArticleEnhancements = mysqlTable("seoArticleEnhancements", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull(), // Foreign key to seoArticleJobs
  userId: int("userId").notNull(),
  originalArticle: longtext("originalArticle"), // Original article
  enhancedArticle: longtext("enhancedArticle"), // Enhanced article
  aioSummary: longtext("aioSummary"), // AIO summary section
  faqSection: longtext("faqSection"), // FAQ section
  jsonLd: longtext("jsonLd"), // JSON-LD structured data
  metaInfo: longtext("metaInfo"), // JSON: meta information (title, description, etc.)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SeoArticleEnhancement = typeof seoArticleEnhancements.$inferSelect;
export type InsertSeoArticleEnhancement = typeof seoArticleEnhancements.$inferInsert;

/**
 * Tag categories table - manages tag categories (genre, author, contentType, etc.)
 */
export const tagCategories = mysqlTable("tagCategories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(), // 'genre', 'author', 'contentType', etc.
  displayName: varchar("displayName", { length: 128 }).notNull(), // '生成ジャンル', '発信者名', etc.
  description: text("description"), // Category description
  sortOrder: int("sortOrder").default(0), // Display order
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TagCategory = typeof tagCategories.$inferSelect;
export type InsertTagCategory = typeof tagCategories.$inferInsert;

/**
 * Tags table - stores tag values for each category
 */
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  value: varchar("value", { length: 128 }).notNull(), // 'SEO', '赤原', etc.
  displayName: varchar("displayName", { length: 128 }).notNull(), // Display name
  color: varchar("color", { length: 7 }), // Tag color for UI (e.g., '#FF5733')
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

/**
 * RAG documents table - stores documents for RAG (Retrieval-Augmented Generation)
 */
export const ragDocuments = mysqlTable("ragDocuments", {
  id: int("id").autoincrement().primaryKey(),
  content: longtext("content").notNull(), // Document content for RAG
  type: varchar("type", { length: 64 }).notNull(), // 'structure_pattern', 'slide_strategy', 'success_factors', etc.
  sourceId: varchar("sourceId", { length: 255 }), // Source ID (video ID, article ID, etc.)
  successLevel: mysqlEnum("successLevel", ["高", "中", "低"]),
  importance: int("importance").default(0), // Importance score based on usage frequency or success
  pickedUp: int("pickedUp").default(0).notNull(), // 0: not picked up, 1: picked up (priority document)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RagDocument = typeof ragDocuments.$inferSelect;
export type InsertRagDocument = typeof ragDocuments.$inferInsert;

/**
 * RAG document tags table - many-to-many relationship between RAG documents and tags
 */
export const ragDocumentTags = mysqlTable("ragDocumentTags", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  tagId: int("tagId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RagDocumentTag = typeof ragDocumentTags.$inferSelect;
export type InsertRagDocumentTag = typeof ragDocumentTags.$inferInsert;

/**
 * Video projects table - stores video generation projects
 */
export const videoProjects = mysqlTable("videoProjects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  theme: varchar("theme", { length: 128 }), // Theme or topic
  targetAudience: varchar("targetAudience", { length: 255 }), // Target audience
  status: mysqlEnum("status", ["draft", "generating", "completed", "failed"]).default("draft").notNull(),
  videoUrl: varchar("videoUrl", { length: 512 }), // S3 URL of generated video
  duration: int("duration"), // Video duration in seconds
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VideoProject = typeof videoProjects.$inferSelect;
export type InsertVideoProject = typeof videoProjects.$inferInsert;

/**
 * Video scenes table - stores scenes for each video project
 */
export const videoScenes = mysqlTable("videoScenes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sceneNumber: int("sceneNumber").notNull(), // Scene order
  title: varchar("title", { length: 255 }).notNull(),
  script: longtext("script").notNull(), // Scene script/narration
  duration: int("duration"), // Scene duration in seconds
  audioUrl: varchar("audioUrl", { length: 512 }), // S3 URL of TTS audio
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VideoScene = typeof videoScenes.$inferSelect;
export type InsertVideoScene = typeof videoScenes.$inferInsert;

/**
 * Video slides table - stores slides for each scene
 */
export const videoSlides = mysqlTable("videoSlides", {
  id: int("id").autoincrement().primaryKey(),
  sceneId: int("sceneId").notNull(),
  slideNumber: int("slideNumber").notNull(), // Slide order within scene
  content: longtext("content").notNull(), // Slide content (text, bullet points)
  design: longtext("design"), // JSON string of design parameters (colors, fonts, layout)
  imageUrl: varchar("imageUrl", { length: 512 }), // S3 URL of rendered slide image
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VideoSlide = typeof videoSlides.$inferSelect;
export type InsertVideoSlide = typeof videoSlides.$inferInsert;

/**
 * Video generation jobs table - manages asynchronous video generation jobs
 */
export const videoGenerationJobs = mysqlTable("videoGenerationJobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  theme: varchar("theme", { length: 500 }).notNull(), // User input theme
  speakerId: int("speakerId").default(3), // VoiceVox speaker ID (デフォルト: 3 = ずんだもん・ノーマル)
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  currentStep: int("currentStep").default(1), // Current step (1-9)
  progress: int("progress").default(0), // Progress percentage (0-100)
  estimatedTimeRemaining: int("estimatedTimeRemaining"), // Estimated seconds remaining
  
  // Step results
  benchmarkAnalysisId: int("benchmarkAnalysisId"), // Reference to videoBenchmarkAnalysis
  strategyId: int("strategyId"), // Reference to videoStrategy
  scenarioId: int("scenarioId"), // Reference to videoScenario
  slideDesignId: int("slideDesignId"), // Reference to videoSlideDesign
  projectId: int("projectId"), // Reference to videoProjects (final output)
  videoUrl: text("videoUrl"), // Final video URL (from S3)
  
  // Error handling
  errorMessage: text("errorMessage"),
  errorDetails: longtext("errorDetails"), // JSON: detailed error information
  retryCount: int("retryCount").default(0), // Number of retries
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type VideoGenerationJob = typeof videoGenerationJobs.$inferSelect;
export type InsertVideoGenerationJob = typeof videoGenerationJobs.$inferInsert;

/**
 * Video benchmark analysis table - stores analysis results of benchmark videos
 */
export const videoBenchmarkAnalysis = mysqlTable("videoBenchmarkAnalysis", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull(), // Reference to videoGenerationJobs
  userId: int("userId").notNull(),
  
  // Benchmark videos (JSON array)
  benchmarkVideos: longtext("benchmarkVideos"), // JSON: [{ videoId, title, url, views, likes }]
  
  // Analysis results
  transcripts: longtext("transcripts"), // JSON: array of transcripts
  visualAnalysis: longtext("visualAnalysis"), // JSON: frame-by-frame visual analysis
  summary: longtext("summary"), // Overall summary
  sellerIntent: longtext("sellerIntent"), // Seller's intent analysis
  targetPersonas: longtext("targetPersonas"), // Target persona analysis
  personaReactions: longtext("personaReactions"), // Persona reaction analysis
  successFactors: longtext("successFactors"), // Success factors analysis
  viralLaws: longtext("viralLaws"), // Extracted viral laws
  
  // RAG integration
  savedToRAG: int("savedToRAG").default(0).notNull(), // 0: not saved, 1: saved to RAG
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VideoBenchmarkAnalysis = typeof videoBenchmarkAnalysis.$inferSelect;
export type InsertVideoBenchmarkAnalysis = typeof videoBenchmarkAnalysis.$inferInsert;

/**
 * Video strategy table - stores strategy design results
 */
export const videoStrategy = mysqlTable("videoStrategy", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull(), // Reference to videoGenerationJobs
  userId: int("userId").notNull(),
  
  // Theme decomposition
  theme: varchar("theme", { length: 500 }).notNull(),
  trafficKeywords: longtext("trafficKeywords"), // JSON: array of traffic source keywords
  solutionKeywords: longtext("solutionKeywords"), // JSON: array of solution keywords
  
  // Strategy design
  hookStrategy: longtext("hookStrategy"), // Hook strategy
  problemStrategy: longtext("problemStrategy"), // Problem presentation strategy
  solutionStrategy: longtext("solutionStrategy"), // Solution strategy
  
  // RAG references
  ragReferences: longtext("ragReferences"), // JSON: RAG references used
  
  // User rules
  userRules: longtext("userRules"), // User-defined rules for strategy design
  
  // Additional strategy fields
  targetAudience: varchar("targetAudience", { length: 500 }),
  painPoints: longtext("painPoints"), // JSON: array of pain points
  desiredOutcome: text("desiredOutcome"),
  uniqueValueProposition: text("uniqueValueProposition"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VideoStrategy = typeof videoStrategy.$inferSelect;
export type InsertVideoStrategy = typeof videoStrategy.$inferInsert;

/**
 * Video scenario table - stores scenario generation results
 * Updated: 2025-11-18 - Force reload
 */
export const videoScenario = mysqlTable("videoScenario", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull(), // Reference to videoGenerationJobs
  userId: int("userId").notNull(),
  
  // Hook section
  hookContent: longtext("hookContent"),
  hookDuration: int("hookDuration"),
  hookPurpose: longtext("hookPurpose"),
  
  // Problem presentation section
  problemContent: longtext("problemContent"),
  problemDuration: int("problemDuration"),
  problemPurpose: longtext("problemPurpose"),
  
  // Solution section
  solutionContent: longtext("solutionContent"),
  solutionDuration: int("solutionDuration"),
  solutionPurpose: longtext("solutionPurpose"),
  
  // Call to action section
  ctaContent: longtext("ctaContent"),
  ctaDuration: int("ctaDuration"),
  ctaPurpose: longtext("ctaPurpose"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VideoScenario = typeof videoScenario.$inferSelect;
export type InsertVideoScenario = typeof videoScenario.$inferInsert;

/**
 * Video slide design table - stores slide design results
 */
export const videoSlideDesign = mysqlTable("videoSlideDesign", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull(), // Reference to videoGenerationJobs
  userId: int("userId").notNull(),
  scenarioId: int("scenarioId").notNull(), // Reference to videoScenario
  
  // Slide data (JSON array)
  slides: longtext("slides"), // JSON: [{ slideNumber, title, content, design, imageUrl }]
  
  // Design parameters
  fontFamily: varchar("fontFamily", { length: 100 }),
  fontSize: int("fontSize"),
  colorScheme: longtext("colorScheme"), // JSON: { primary, secondary, background, text }
  layout: varchar("layout", { length: 50 }), // 'centered', 'left-aligned', 'split', etc.
  
  // RAG references
  ragReferences: longtext("ragReferences"), // JSON: RAG references used
  
  // User rules
  userRules: longtext("userRules"), // User-defined rules for slide design
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VideoSlideDesign = typeof videoSlideDesign.$inferSelect;
export type InsertVideoSlideDesign = typeof videoSlideDesign.$inferInsert;
