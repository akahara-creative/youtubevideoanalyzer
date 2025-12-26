import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertTimelineSegment, InsertUser, InsertVideoAnalysis, timelineSegments, users, videoAnalyses, exportHistory, InsertExportHistory, chatConversations, chatMessages, InsertChatConversation, InsertChatMessage, contentImports, longContents, InsertLongContent, contentChunks, InsertContentChunk, generatedContents, InsertGeneratedContent, promptTemplates, InsertPromptTemplate, seoArticleJobs, InsertSeoArticleJob } from "../drizzle/schema";
import { ENV } from './_core/env';
import { TRPCError } from '@trpc/server';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

// Get raw MySQL2 connection pool for direct SQL queries
export async function getMysqlPool() {
  if (!_pool && process.env.DATABASE_URL) {
    try {
      _pool = mysql.createPool(process.env.DATABASE_URL);
      console.log("[Database] Connection pool created successfully");
    } catch (error) {
      console.warn("[Database] Failed to create pool:", error);
      _pool = null;
    }
  }
  return _pool;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // 接続プールを先に作成
      const pool = await getMysqlPool();
      if (!pool) {
        console.warn("[Database] Cannot create drizzle instance: pool not available");
        return null;
      }
      _db = drizzle(pool);
      console.log("[Database] Drizzle instance created successfully");
    } catch (error) {
      console.warn("[Database] Failed to create drizzle instance:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'User openId is required for upsert' });
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Video Analysis queries
export async function createVideoAnalysis(data: InsertVideoAnalysis) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  const result = await db.insert(videoAnalyses).values(data);
  return result[0].insertId;
}

export async function getVideoAnalysisByIdAndUser(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(videoAnalyses).where(eq(videoAnalyses.id, id));
  if (result.length === 0 || result[0].userId !== userId) return undefined;
  return result[0];
}

export async function getVideoAnalysisById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(videoAnalyses).where(eq(videoAnalyses.id, id));
  return result.length > 0 ? result[0] : undefined;
}

export async function getVideoAnalysesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(videoAnalyses).where(eq(videoAnalyses.userId, userId)).orderBy(desc(videoAnalyses.createdAt));
}

export async function updateVideoAnalysis(id: number, data: Partial<InsertVideoAnalysis>) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  
  // データベースのtext型の制限（約64KB）を考慮して要約・箇条書き化
  const MAX_TEXT_LENGTH = 60000; // 安全のため60KBに制限
  const processedData = { ...data };
  
  // summaryが長すぎる場合は要約・箇条書き化
  if (processedData.summary && typeof processedData.summary === 'string' && processedData.summary.length > MAX_TEXT_LENGTH) {
    const { compressText } = await import("./_core/textCompressor");
    processedData.summary = await compressText(processedData.summary, "summary");
  }
  
  // learningPointsが長すぎる場合は箇条書き化
  if (processedData.learningPoints && typeof processedData.learningPoints === 'string' && processedData.learningPoints.length > MAX_TEXT_LENGTH) {
    const { compressText } = await import("./_core/textCompressor");
    processedData.learningPoints = await compressText(processedData.learningPoints, "learningPoints");
  }
  
  // titleが長すぎる場合は切り詰め（タイトルは要約不要）
  if (processedData.title && typeof processedData.title === 'string' && processedData.title.length > MAX_TEXT_LENGTH) {
    processedData.title = processedData.title.substring(0, MAX_TEXT_LENGTH) + "... (切り詰め)";
  }
  
  await db.update(videoAnalyses).set(processedData).where(eq(videoAnalyses.id, id));
}

// Timeline Segment queries
export async function createTimelineSegment(data: InsertTimelineSegment) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  await db.insert(timelineSegments).values(data);
}

export async function getTimelineSegmentsByAnalysisId(analysisId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(timelineSegments).where(eq(timelineSegments.analysisId, analysisId)).orderBy(timelineSegments.startTime);
}

// Share-related queries
export async function getVideoAnalysisByShareToken(shareToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(videoAnalyses).where(eq(videoAnalyses.shareToken, shareToken));
  return result.length > 0 ? result[0] : undefined;
}

export async function generateShareToken(): Promise<string> {
  // Generate a random 32-character token
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Export history queries
export async function createExportHistory(data: InsertExportHistory) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  const result = await db.insert(exportHistory).values(data);
  return result;
}

export async function getExportHistoryByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(exportHistory).where(eq(exportHistory.userId, userId)).orderBy(desc(exportHistory.createdAt));
}

export async function getExportHistoryById(exportId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(exportHistory).where(eq(exportHistory.id, exportId));
  if (result.length > 0 && result[0].userId === userId) {
    return result[0];
  }
  return undefined;
}

export async function deleteExportHistory(exportId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  const exportRecord = await getExportHistoryById(exportId, userId);
  if (!exportRecord) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Export not found or unauthorized' });
  }
  await db.delete(exportHistory).where(eq(exportHistory.id, exportId));
  return exportRecord;
}

export async function updateExportMetadata(
  exportId: number,
  userId: number,
  data: { category?: string | null; tags?: string | null; notes?: string | null }
) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  const exportRecord = await getExportHistoryById(exportId, userId);
  if (!exportRecord) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Export not found or unauthorized' });
  }
  await db.update(exportHistory).set(data).where(eq(exportHistory.id, exportId));
  return getExportHistoryById(exportId, userId);
}

// ==================== Chat Functions ====================

export async function createChatConversation(userId: number, title?: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  const result = await db.insert(chatConversations).values({
    userId,
    title: title || "新しい会話",
  });

  return result[0].insertId;
}

export async function getChatConversationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(chatConversations).where(eq(chatConversations.userId, userId)).orderBy(desc(chatConversations.updatedAt));
}

export async function getChatConversationById(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(chatConversations)
    .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)))
    .limit(1);

  return result[0];
}

export async function createChatMessage(data: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  const result = await db.insert(chatMessages).values(data);
  return result[0].insertId;
}

export async function getChatMessagesByConversation(conversationId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversationId)).orderBy(chatMessages.createdAt);
}

export async function updateChatConversationTitle(conversationId: number, title: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  await db.update(chatConversations).set({ title }).where(eq(chatConversations.id, conversationId));
}

export async function updateChatConversationKeywordProject(conversationId: number, keywordProjectId: number | null) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  await db.update(chatConversations).set({ keywordProjectId }).where(eq(chatConversations.id, conversationId));
}

export async function deleteChatConversation(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  // Delete messages first
  await db.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId));
  
  // Delete conversation
  await db.delete(chatConversations).where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)));
}


// Content Import functions
export async function createContentImport(data: {
  userId: number;
  fileName: string;
  fileType: "txt" | "docx" | "pdf" | "m4a";
  fileUrl: string;
  fileKey: string;
  fileSize?: number;
  extractedText?: string;
  category?: string;
  tags?: string;
  notes?: string;
  ragId?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  // Use raw SQL to avoid Drizzle ORM's "default" literal issue
  // Build the INSERT statement dynamically based on provided fields
  const columns = ['userId', 'fileName', 'fileType', 'fileUrl', 'fileKey'];
  const values: any[] = [data.userId, data.fileName, data.fileType, data.fileUrl, data.fileKey];
  
  if (data.fileSize !== undefined) {
    columns.push('fileSize');
    values.push(data.fileSize);
  }
  if (data.extractedText !== undefined) {
    columns.push('extractedText');
    values.push(data.extractedText);
  }
  if (data.category !== undefined) {
    columns.push('category');
    values.push(data.category);
  }
  if (data.tags !== undefined) {
    columns.push('tags');
    values.push(data.tags);
  }
  if (data.notes !== undefined) {
    columns.push('notes');
    values.push(data.notes);
  }
  if (data.ragId !== undefined) {
    columns.push('ragId');
    values.push(data.ragId);
  }

  const placeholders = values.map(() => '?').join(', ');
  const sqlQuery = `INSERT INTO contentImports (${columns.join(', ')}) VALUES (${placeholders})`;
  
  // Use mysql2 connection directly through Drizzle's internal connection
  const connection = (db as any).session.client;
  const [result] = await connection.query(sqlQuery, values);
  return Number((result as any).insertId);
}

export async function getContentImportsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(contentImports)
    .where(eq(contentImports.userId, userId))
    .orderBy(desc(contentImports.createdAt));
}

export async function getContentImportById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(contentImports)
    .where(eq(contentImports.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function deleteContentImport(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  await db.delete(contentImports).where(eq(contentImports.id, id));
}

// ============================================
// Long Content Generation Functions
// ============================================

export async function createLongContent(data: InsertLongContent): Promise<number> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  const result = await db.insert(longContents).values(data);
  return Number(result[0].insertId);
}

export async function getLongContentsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(longContents)
    .where(eq(longContents.userId, userId))
    .orderBy(desc(longContents.createdAt));
}

export async function getLongContentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(longContents)
    .where(eq(longContents.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateLongContent(
  id: number,
  data: Partial<InsertLongContent>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  await db.update(longContents).set(data).where(eq(longContents.id, id));
}

export async function deleteLongContent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  // Delete associated chunks first
  await db.delete(contentChunks).where(eq(contentChunks.longContentId, id));
  // Delete the long content
  await db.delete(longContents).where(eq(longContents.id, id));
}

// Content Chunks Functions
export async function createContentChunk(data: InsertContentChunk): Promise<number> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  const result = await db.insert(contentChunks).values(data);
  return Number(result[0].insertId);
}

export async function getContentChunksByLongContentId(longContentId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(contentChunks)
    .where(eq(contentChunks.longContentId, longContentId))
    .orderBy(contentChunks.chunkIndex);
}

export async function updateContentChunk(
  id: number,
  data: Partial<InsertContentChunk>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  await db.update(contentChunks).set(data).where(eq(contentChunks.id, id));
}

// Generated Contents Functions
export async function createGeneratedContent(data: InsertGeneratedContent): Promise<number> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  const result = await db.insert(generatedContents).values(data);
  return Number(result[0].insertId);
}

export async function getGeneratedContentsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(generatedContents)
    .where(eq(generatedContents.userId, userId))
    .orderBy(desc(generatedContents.createdAt));
}

export async function getGeneratedContentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(generatedContents)
    .where(eq(generatedContents.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function deleteGeneratedContent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  await db.delete(generatedContents).where(eq(generatedContents.id, id));
}

// ========================================
// Prompt Templates
// ========================================

export async function createPromptTemplate(data: InsertPromptTemplate): Promise<number> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  const result = await db.insert(promptTemplates).values(data);
  return result[0].insertId;
}

export async function getPromptTemplatesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.userId, userId))
    .orderBy(desc(promptTemplates.createdAt));
}

export async function getPromptTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updatePromptTemplate(id: number, data: Partial<InsertPromptTemplate>): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  await db.update(promptTemplates).set(data).where(eq(promptTemplates.id, id));
}

export async function deletePromptTemplate(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

  await db.delete(promptTemplates).where(eq(promptTemplates.id, id));
}


// SEO Article Jobs
export async function createSeoArticleJob(data: InsertSeoArticleJob): Promise<number> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  
  const result = await db.insert(seoArticleJobs).values(data);
  return Number(result[0].insertId);
}

export async function getSeoArticleJobById(id: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  
  const result = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSeoArticleJobsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  
  return await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.userId, userId)).orderBy(desc(seoArticleJobs.createdAt));
}

export async function updateSeoArticleJob(id: number, data: Partial<InsertSeoArticleJob> & { status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' }): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  
  // Cast to any to bypass type checking for status field
  await db.update(seoArticleJobs).set(data as any).where(eq(seoArticleJobs.id, id));
}

// Tag management queries
export async function getAllTagCategories() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  const { tagCategories } = await import("../drizzle/schema");
  const result = await db.select().from(tagCategories).orderBy(tagCategories.sortOrder);
  return result;
}

export async function getTagsByCategory(categoryId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  const { tags } = await import("../drizzle/schema");
  const result = await db.select().from(tags).where(eq(tags.categoryId, categoryId)).orderBy(tags.sortOrder);
  return result;
}

export async function getAllTagsWithCategories() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  const { tags, tagCategories } = await import("../drizzle/schema");
  
  const categories = await db.select().from(tagCategories).orderBy(tagCategories.sortOrder);
  const allTags = await db.select().from(tags).orderBy(tags.sortOrder);
  
  return categories.map(category => ({
    ...category,
    tags: allTags.filter(tag => tag.categoryId === category.id)
  }));
}

export async function createTag(data: { categoryId: number; value: string; displayName: string; color?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  const { tags } = await import("../drizzle/schema");
  const result = await db.insert(tags).values(data);
  return result[0].insertId;
}

export async function updateTag(id: number, data: { value?: string; displayName?: string; color?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  const { tags } = await import("../drizzle/schema");
  await db.update(tags).set(data).where(eq(tags.id, id));
}

export async function deleteTag(id: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  const { tags } = await import("../drizzle/schema");
  await db.delete(tags).where(eq(tags.id, id));
}

export async function createTagCategory(data: { name: string; displayName: string; description?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  const { tagCategories } = await import("../drizzle/schema");
  const result = await db.insert(tagCategories).values(data);
  return result[0].insertId;
}

export async function updateTagCategory(id: number, data: { name?: string; displayName?: string; description?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  const { tagCategories } = await import("../drizzle/schema");
  await db.update(tagCategories).set(data).where(eq(tagCategories.id, id));
}

export async function deleteTagCategory(id: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  const { tagCategories } = await import("../drizzle/schema");
  await db.delete(tagCategories).where(eq(tagCategories.id, id));
}
