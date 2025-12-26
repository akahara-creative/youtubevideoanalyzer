import { invokeLLM, InvokeParams } from "./_core/llm";
import { getDb } from "./db";
import { ragDocuments, ragDocumentTags, tags } from "../drizzle/schema";
import { eq, inArray, and } from "drizzle-orm";

export interface TargetPersona {
  characteristics: string; // User input
  episodes: {
    childhood: string;
    student: string;
    adult: string;
  };
  struggles: string; // Struggles with traffic source topic
  frustrations: string; // Anger/worries about the market
  latentAptitude: string; // Why they are suited for the solution
}

export interface WriterPersona {
  name: string;
  style: string;
  tone: string;
  philosophy: string;
}

export interface EditorPersona {
  role: string;
  checkPoints: string[];
  tone: string;
}

export interface GeneratedPersonas {
  target: TargetPersona;
  writer: WriterPersona;
  editor: EditorPersona;
}

/**
 * Generate Target Persona based on user input characteristics
 */
export async function generateTargetPersona(characteristics: string, theme: string): Promise<TargetPersona> {
  console.log('[generateTargetPersona] Generating target persona...');
  
  const prompt = `
あなたはプロのマーケター兼小説家です。
以下の「ターゲットの特徴」と「記事テーマ」を元に、極めて具体的で生々しい「ターゲットの擬似人格」を作成してください。

【入力情報】
ターゲットの特徴: ${characteristics}
記事テーマ: ${theme}

【作成要件】
1. **エピソード**: 幼少期、学生時代、社会人それぞれの時期における、性格や行動パターンがわかる具体的なエピソードを作成してください。
2. **集客元ネタでの苦労**: 記事テーマの「集客元となるネタ（悩み）」に関して、この人物がどのような苦労、失敗、絶望を味わってきたかを描写してください。
3. **市場への怒り・葛藤**: 既存の解決策や市場の常識に対して、どのような怒り、不信感、葛藤を抱いているかを描写してください。
4. **潜在的な適性**: 本人は自覚していないが、これまでの苦労や経験から、実は「解決策となるネタ」に向いていると言える理由（潜在的な適性）を論理的に導き出してください。

【出力フォーマット】
JSON形式で出力してください。
{
  "episodes": {
    "childhood": "幼少期のエピソード...",
    "student": "学生時代のエピソード...",
    "adult": "社会人のエピソード..."
  },
  "struggles": "集客元ネタでの苦労...",
  "frustrations": "市場への怒り・葛藤...",
  "latentAptitude": "潜在的な適性..."
}
`;

  const response = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message.content;
  if (!content || typeof content !== 'string') throw new Error("Failed to generate target persona");

  const result = JSON.parse(content);
  
  return {
    characteristics,
    episodes: result.episodes,
    struggles: result.struggles,
    frustrations: result.frustrations,
    latentAptitude: result.latentAptitude
  };
}

/**
 * Generate Writer Persona (Akahara) from RAG
 */
export async function generateWriterPersona(): Promise<WriterPersona> {
  console.log('[generateWriterPersona] Generating writer persona...');
  
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Fetch documents tagged with "Akahara" or similar
  // Assuming we have a tag named "author:akahara" or similar. 
  // For now, we'll try to find tags related to "赤原"
  
  const akaharaTags = await db.select().from(tags).where(eq(tags.displayName, "赤原"));
  let context = "";

  if (akaharaTags.length > 0) {
    const tagId = akaharaTags[0].id;
    const docs = await db.select({
      content: ragDocuments.content
    })
    .from(ragDocuments)
    .innerJoin(ragDocumentTags, eq(ragDocuments.id, ragDocumentTags.documentId))
    .where(eq(ragDocumentTags.tagId, tagId))
    .limit(5);

    context = docs.map(d => d.content).join("\n\n");
  }

  // If no specific RAG docs, use default persona definition
  if (!context) {
    context = `
    赤原スタイル:
    - 一人称は「僕」
    - 過去の失敗や苦労を隠さずに話す
    - 読者に寄り添いつつも、本質を突く厳しいことも言う
    - 感情表現が豊かで、擬音語や口語を交える
    - 「〜です、ます」調だが、堅苦しくない
    `;
  }

  return {
    name: "赤原",
    style: "赤原スタイル（感情豊か、実体験ベース、本質的）",
    tone: "親しみやすいが、プロフェッショナルとしての自信がある。「僕」という一人称。",
    philosophy: context.substring(0, 1000) // Truncate for safety
  };
}

/**
 * Generate Editor Persona (Composition Writer) from RAG
 */
export async function generateEditorPersona(): Promise<EditorPersona> {
  console.log('[generateEditorPersona] Generating editor persona...');
  
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Fetch documents tagged with "Check: Composition Writer" or similar
  // Assuming tag name "check:composition_writer" or "構成作家"
  
  const editorTags = await db.select().from(tags).where(inArray(tags.displayName, ["構成作家", "チェック担当"]));
  let context = "";

  if (editorTags.length > 0) {
    const tagIds = editorTags.map(t => t.id);
    const docs = await db.select({
      content: ragDocuments.content
    })
    .from(ragDocuments)
    .innerJoin(ragDocumentTags, eq(ragDocuments.id, ragDocumentTags.documentId))
    .where(inArray(ragDocumentTags.tagId, tagIds))
    .limit(5);

    context = docs.map(d => d.content).join("\n\n");
  }

  if (!context) {
    context = `
    構成作家チェックポイント:
    - 日本語として自然か（てにをは、接続詞）
    - キーワードの詰め込みが不自然でないか
    - 論理の飛躍がないか
    - 読者の感情を置いてけぼりにしていないか
    - 具体例は十分か
    `;
  }

  return {
    role: "構成作家（厳格な品質管理者）",
    checkPoints: [
      "日本語の自然さ（助詞、係り受け）",
      "キーワードの自然な織り込み（詰め込みNG）",
      "論理的整合性",
      "エピソードの具体性",
      "読者への共感度"
    ],
    tone: "冷静沈着、論理的、妥協を許さないプロフェッショナル"
  };
}
