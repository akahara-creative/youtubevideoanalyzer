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
  description: string; // Renamed from philosophy for consistency
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
  console.log('[generateWriterPersona] Generating writer persona from RAG...');
  
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Fetch documents tagged with "赤原" (Akahara)
  // We want to capture "Voice/Tone" here.
  // We EXCLUDE "Logic/Structure" docs (#1856, #1896, #1841) because they are already in the main ragContext.
  // This prevents duplication and allows us to pack more "Voice Samples" (#4, #7, #8, etc.) into the context limit.
  const akaharaTags = await db.select().from(tags).where(eq(tags.displayName, "赤原"));
  let context = "";

  if (akaharaTags.length > 0) {
    const tagId = akaharaTags[0].id;
    const docs = await db.select({
      content: ragDocuments.content,
      id: ragDocuments.id,
      type: ragDocuments.type
    })
    .from(ragDocuments)
    .innerJoin(ragDocumentTags, eq(ragDocuments.id, ragDocumentTags.documentId))
    .where(eq(ragDocumentTags.tagId, tagId))
    .limit(20); // Fetch more candidates

    // Filter out Logic docs to avoid duplication with ragContext
    // And exclude 'seo_article' type (we only want raw voice samples)
    const voiceDocs = docs.filter(d => 
      ![1856, 1896, 1841].includes(d.id) && 
      d.type !== 'seo_article' // Assuming type is fetched
    );
    
    // Prioritize specific Voice Samples: #8 (Confession), #7 (YinYang), #4 (Karma)
    const priorityIds = [8, 7, 4];
    voiceDocs.sort((a, b) => {
      const aP = priorityIds.indexOf(a.id);
      const bP = priorityIds.indexOf(b.id);
      if (aP !== -1 && bP !== -1) return aP - bP; // Both in priority
      if (aP !== -1) return -1; // a is priority
      if (bP !== -1) return 1; // b is priority
      return 0; // Keep original order
    });

    // Helper to strip HTML and junk
    const cleanContent = (text: string) => {
      return text
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/━━　MyASP.*/s, '') // Remove MyASP footer
        .replace(/Copyright.*/s, '') // Remove Copyright
        .trim();
    };

    // Take top 10 Voice docs, but ensure we fit the most important ones
    context = voiceDocs.slice(0, 10).map(d => {
      let content = cleanContent(d.content);
      // Truncate individual docs if too long (e.g. #8 is 25k)
      // We want to keep the BEGINNING of #8 (Confession)
      if (content.length > 5000) {
        content = content.substring(0, 5000) + "\n...(truncated)...";
      }
      return `【赤原の口調サンプル (RAG #${d.id})】\n${content}`;
    }).join("\n\n");
  }

  // If no specific RAG docs, use default persona definition (Fallback)
  if (!context) {
    context = `
    赤原スタイル（基本定義）:
    - 役割: 告発者・共犯者（先生ではない）
    - 文体: #4（断定、感情、擬音語）
    - スタンス: 読者の痛みを理解し、業界の嘘を暴く
    `;
  }

  return {
    name: "赤原",
    style: "赤原スタイル（告発者・共犯者・高解像度）",
    tone: "親しみやすいが、プロフェッショナルとしての自信がある。「僕」という一人称。",
    description: `【赤原の思考OS】
私はRAG #1856（市場分析ロジック）と #1896（行間の詰め方）を完璧にインストールした専門家です。
市場の歪み（A-C-G）を熟知しており、読者がなぜ稼げないのかを論理的に説明できます。

【赤原の口調・文体（Voice）】
以下は私の話し方のサンプルです。このトーンを完全に再現してください。
特に RAG #8（告白）の「弱さをさらけ出す姿勢」と、RAG #4（因果応報）の「断定的な語り口」を融合させてください。

${context.substring(0, 12000)}` // Limit to 12k to avoid context overflow
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
