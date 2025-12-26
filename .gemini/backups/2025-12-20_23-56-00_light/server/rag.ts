import { ChromaClient, Collection } from "chromadb";
import { invokeLLM } from "./_core/llm";

let chromaClient: ChromaClient | null = null;
let collection: Collection | null = null;

const COLLECTION_NAME = "youtube_analysis_rag";

/**
 * Initialize ChromaDB client and collection
 */
export async function initializeRAG() {
  if (!chromaClient) {
    chromaClient = new ChromaClient({
      path: "http://localhost:8000", // ChromaDB default local server
    });
  }

  if (!collection) {
    try {
      // Try to get existing collection
      collection = await chromaClient.getCollection({ name: COLLECTION_NAME });
      console.log("[RAG] Connected to existing collection");
    } catch (error) {
      // Create new collection if it doesn't exist
      collection = await chromaClient.createCollection({
        name: COLLECTION_NAME,
        metadata: { description: "YouTube video analysis and content RAG" },
      });
      console.log("[RAG] Created new collection");
    }
  }

  return collection;
}

/**
 * Generate embeddings using a simple hash-based approach
 * TODO: Replace with OpenAI embeddings API for production
 */
async function generateEmbedding(text: string): Promise<number[]> {
  return simpleEmbedding(text);
}

/**
 * Simple embedding function (fallback)
 * In production, this should use OpenAI's embedding API
 */
async function simpleEmbedding(text: string): Promise<number[]> {
  // Create a simple 384-dimensional embedding based on text hash
  const hash = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const embedding = new Array(384).fill(0).map((_, i) => {
    return Math.sin(hash * (i + 1)) * 0.5 + 0.5;
  });
  return embedding;
}

/**
 * Add document to RAG
 */
export async function addToRAG(params: {
  id: string;
  text: string;
  metadata: {
    type: "video_analysis" | "export" | "mailmag" | "audio_analysis";
    title?: string;
    url?: string;
    createdAt: string;
    [key: string]: any;
  };
}) {
  const coll = await initializeRAG();

  try {
    const embedding = await simpleEmbedding(params.text);

    await coll.add({
      ids: [params.id],
      embeddings: [embedding],
      documents: [params.text],
      metadatas: [params.metadata],
    });

    console.log(`[RAG] Added document: ${params.id}`);
    return { success: true, id: params.id };
  } catch (error) {
    console.error("[RAG] Error adding document:", error);
    throw error;
  }
}

/**
 * Search RAG for relevant documents
 */
export async function searchRAG(params: {
  query: string;
  limit?: number;
  filter?: Record<string, any>;
}) {
  const coll = await initializeRAG();
  const limit = params.limit || 5;

  try {
    const queryEmbedding = await simpleEmbedding(params.query);

    const results = await coll.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      where: params.filter,
    });

    const documents = results.documents[0] || [];
    const metadatas = results.metadatas[0] || [];
    const distances = results.distances?.[0] || [];

    return documents.map((doc, i) => ({
      document: doc,
      metadata: metadatas[i],
      score: 1 - (distances[i] || 0), // Convert distance to similarity score
    }));
  } catch (error) {
    console.error("[RAG] Error searching:", error);
    throw error;
  }
}

/**
 * Delete document from RAG
 */
export async function deleteFromRAG(id: string) {
  const coll = await initializeRAG();

  try {
    await coll.delete({ ids: [id] });
    console.log(`[RAG] Deleted document: ${id}`);
    return { success: true };
  } catch (error) {
    console.error("[RAG] Error deleting document:", error);
    throw error;
  }
}

/**
 * Get RAG context for a query with pinned documents support
 * Returns formatted context string to be used in LLM prompts
 * Pinned documents are always included at the top, regardless of similarity score
 */
export async function getRAGContext(query: string, limit: number = 3, pinnedDocuments?: Array<{id: string; text: string; title?: string; createdAt: string}>): Promise<string> {
  // Add pinned documents first
  let allResults: Array<{document: string; metadata: any; score: number; isPinned?: boolean}> = [];
  
  if (pinnedDocuments && pinnedDocuments.length > 0) {
    allResults = pinnedDocuments.map(doc => ({
      document: doc.text,
      metadata: {
        type: 'mailmag',
        title: doc.title || '不明',
        createdAt: doc.createdAt,
      },
      score: 1.0, // Pinned documents get perfect score
      isPinned: true,
    }));
  }

  // Then add regular search results
  const searchResults = await searchRAG({ query, limit });
  allResults = [...allResults, ...searchResults];

  if (allResults.length === 0) {
    return "関連する過去のコンテンツは見つかりませんでした。";
  }

  const context = allResults
    .map((result, i) => {
      const metadata = result.metadata as any;
      const pinnedLabel = result.isPinned ? '【必須参照】' : '';
      return `
${pinnedLabel}【参考資料 ${i + 1}】
タイプ: ${metadata.type}
タイトル: ${metadata.title || "不明"}
作成日: ${metadata.createdAt}
内容:
${result.document}
---`;
    })
    .join("\n\n");

  return context;
}
