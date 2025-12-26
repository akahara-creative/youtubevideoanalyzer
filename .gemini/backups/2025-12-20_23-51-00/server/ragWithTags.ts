import { getDb } from "./db";
import { ragDocuments, ragDocumentTags, tags, tagCategories } from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Save document to RAG with tags
 */
export async function saveToRAGWithTags(params: {
  content: string;
  type: string;
  sourceId?: string;
  successLevel?: "高" | "中" | "低";
  tags: {
    genre?: string[];
    author?: string[];
    contentType?: string[];
    theme?: string[];
  };
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // 1. Save document to ragDocuments table
    const [result] = await db.insert(ragDocuments).values({
      content: params.content,
      type: params.type,
      sourceId: params.sourceId,
      successLevel: params.successLevel,
      importance: 0,
    });

    const documentId = result.insertId;

    // 2. Get tag IDs from tag values
    const tagIds: number[] = [];
    
    for (const [categoryName, tagValues] of Object.entries(params.tags)) {
      if (!tagValues || tagValues.length === 0) continue;

      // Get category ID
      const [category] = await db
        .select()
        .from(tagCategories)
        .where(eq(tagCategories.name, categoryName))
        .limit(1);

      if (!category) {
        console.warn(`[RAG] Category not found: ${categoryName}`);
        continue;
      }

      // Get tag IDs for this category
      const categoryTags = await db
        .select()
        .from(tags)
        .where(
          and(
            eq(tags.categoryId, category.id),
            inArray(tags.value, tagValues)
          )
        );

      tagIds.push(...categoryTags.map(t => t.id));
    }

    // 3. Save document-tag relationships
    if (tagIds.length > 0) {
      await db.insert(ragDocumentTags).values(
        tagIds.map(tagId => ({
          documentId,
          tagId,
        }))
      );
    }

    console.log(`[RAG] Saved document with ${tagIds.length} tags: ${documentId}`);
    return { success: true, documentId };
  } catch (error) {
    console.error("[RAG] Error saving document with tags:", error);
    throw error;
  }
}

/**
 * Search RAG documents by tags
 */
export async function searchRAGWithTags(params: {
  query?: string;
  tagFilters?: {
    genre?: string[];
    author?: string[];
    contentType?: string[];
    theme?: string[];
    successLevel?: ("高" | "中" | "低")[];
  };
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Build where conditions
    const whereConditions: any[] = [];

    // Apply tag filters
    if (params.tagFilters) {
      const tagConditions: any[] = [];

      for (const [categoryName, tagValues] of Object.entries(params.tagFilters)) {
        if (!tagValues || tagValues.length === 0) continue;

        // Get category ID
        const [category] = await db
          .select()
          .from(tagCategories)
          .where(eq(tagCategories.name, categoryName))
          .limit(1);

        if (!category) continue;

        // Get tag IDs for this category
        const categoryTags = await db
          .select()
          .from(tags)
          .where(
            and(
              eq(tags.categoryId, category.id),
              inArray(tags.value, tagValues)
            )
          );

        const tagIds = categoryTags.map(t => t.id);
        if (tagIds.length > 0) {
          tagConditions.push(tagIds);
        }
      }

      // Filter documents by tags
      if (tagConditions.length > 0) {
        const allTagIds = tagConditions.flat();
        const documentIds = await db
          .select({ documentId: ragDocumentTags.documentId })
          .from(ragDocumentTags)
          .where(inArray(ragDocumentTags.tagId, allTagIds));

        const uniqueDocIds = [...new Set(documentIds.map(d => d.documentId))];
        
        if (uniqueDocIds.length > 0) {
          whereConditions.push(inArray(ragDocuments.id, uniqueDocIds));
        } else {
          return []; // No documents match the tag filters
        }
      }
    }

    // Apply success level filter
    if (params.tagFilters?.successLevel && params.tagFilters.successLevel.length > 0) {
      whereConditions.push(inArray(ragDocuments.successLevel, params.tagFilters.successLevel));
    }

    // Build query
    const limit = params.limit || 10;
    let results;
    if (whereConditions.length > 0) {
      results = await db
        .select()
        .from(ragDocuments)
        .where(and(...whereConditions))
        .limit(limit);
    } else {
      results = await db
        .select()
        .from(ragDocuments)
        .limit(limit);
    }

    // Get tags for each document
    const documentsWithTags = await Promise.all(
      results.map(async (doc) => {
        try {
          const docTags = await db
            .select({
              tagId: ragDocumentTags.tagId,
              tagValue: tags.value,
              tagDisplayName: tags.displayName,
              categoryName: tagCategories.name,
              categoryDisplayName: tagCategories.displayName,
            })
            .from(ragDocumentTags)
            .leftJoin(tags, eq(ragDocumentTags.tagId, tags.id))
            .leftJoin(tagCategories, eq(tags.categoryId, tagCategories.id))
            .where(eq(ragDocumentTags.documentId, doc.id));

          return {
            ...doc,
            tags: docTags,
          };
        } catch (error) {
          console.error(`[RAG] Error fetching tags for document ${doc.id}:`, error);
          return {
            ...doc,
            tags: [],
          };
        }
      })
    );

    console.log(`[RAG] Found ${documentsWithTags.length} documents with tags`);
    return documentsWithTags;
  } catch (error) {
    console.error("[RAG] Error searching documents with tags:", error);
    throw error;
  }
}

/**
 * Get RAG context with tag filtering
 */
export async function getRAGContextWithTags(params: {
  query?: string;
  tagFilters?: {
    genre?: string[];
    author?: string[];
    contentType?: string[];
    theme?: string[];
    successLevel?: ("高" | "中" | "低")[];
  };
  limit?: number;
}): Promise<string> {
  const results = await searchRAGWithTags(params);

  if (results.length === 0) {
    return "関連する過去のコンテンツは見つかりませんでした。";
  }

  const context = results
    .map((result, i) => {
      const tagsByCategory = result.tags.reduce((acc: any, tag) => {
        const categoryName = tag.categoryDisplayName || tag.categoryName || "その他";
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push(tag.tagDisplayName || tag.tagValue);
        return acc;
      }, {});

      const tagsText = Object.entries(tagsByCategory)
        .map(([category, tags]) => `${category}: ${(tags as string[]).join(", ")}`)
        .join(" | ");

      return `
【参考資料 ${i + 1}】
タイプ: ${result.type}
タグ: ${tagsText}
成功度: ${result.successLevel || "未設定"}
内容:
${result.content}
---`;
    })
    .join("\n\n");

  return context;
}

/**
 * Update document importance based on usage
 */
export async function incrementDocumentImportance(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db
      .update(ragDocuments)
      .set({ importance: db.raw("importance + 1") as any })
      .where(eq(ragDocuments.id, documentId));

    console.log(`[RAG] Incremented importance for document: ${documentId}`);
  } catch (error) {
    console.error("[RAG] Error incrementing importance:", error);
  }
}
