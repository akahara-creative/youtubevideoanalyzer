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
  rejectionCriteria: string; // What makes them leave immediately
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
5. **離脱ポイント（拒絶反応）**: この人物は人生に疲れ、ノウハウコレクターとして搾取され続けてきました。
   そのため、「説教」「上から目線の指導」「努力の強要」「解決策（仕組み化など）に対する厳しい指摘」に対して、強い拒絶反応を示します。
   具体的に、どのような言葉や態度を取られると「もう読みたくない」と感じて離脱するかを定義してください。

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
  "latentAptitude": "潜在的な適性...",
  "rejectionCriteria": "離脱ポイント（拒絶反応）..."
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
    latentAptitude: result.latentAptitude,
    rejectionCriteria: result.rejectionCriteria
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
  const akaharaTags = await db.select().from(tags).where(eq(tags.displayName, "赤原"));
  let context = "";
  let voiceDocs: { content: string; id: number; type: string }[] = [];

  // Helper to strip HTML and junk
  const cleanContent = (text: string) => {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/━━　MyASP[\s\S]*/, '') // Remove MyASP footer
      .replace(/Copyright[\s\S]*/, '') // Remove Copyright
      .trim();
  };

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
    // Updated: Exclude #2622 (New Logic/Style Doc) instead of #1896
    const excludedIds = [1856, 1841, 2622];
    voiceDocs = docs.filter(d => 
      !excludedIds.includes(d.id) && 
      d.type !== 'seo_article'
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

    // Take top 10 Voice docs
    context = voiceDocs.slice(0, 10).map(d => {
      let content = cleanContent(d.content);
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

  // --- COMPRESSION LOGIC (For Low-Spec Environments) ---
  const USE_COMPRESSED_PERSONA = true; // Set to false when hardware improves (e.g. PC upgrade)
  
  let finalDescription = "";
  
  if (USE_COMPRESSED_PERSONA) {
    console.log('[generateWriterPersona] Compressing persona description...');
    const compressionPrompt = `
あなたはプロの編集者です。
以下の「赤原の口調サンプル（大量のテキスト）」を分析し、**「赤原スタイルの執筆ルール（スタイルガイド）」**を作成してください。

【目的】
このスタイルガイドをAIに読み込ませることで、元のテキストがなくても「赤原の口調・文体・思考回路」を完全に再現できるようにする。

【要件】
1. **文体ルール**: 語尾は必ず「〜です」「〜ます」調（敬体）とすること。「〜だ」「〜である」は禁止。ただし、態度は断定的で強いものとする。
2. **特徴的な語彙**: 赤原が頻繁に使うキーワード（「搾取」「洗脳」「思考停止」など）や、独特の言い回しをリストアップする。
3. **禁止事項**: 赤原が絶対に使わない言葉（「〜だと思います」「〜かもしれません」などの弱気な表現）を定義する。
4. **思考パターン**: 読者に対するスタンス（共犯者、告発者）や、論理展開の癖（A→C→G）を言語化する。
5. **出力文字数**: **3000文字以内**に濃縮する。

【入力テキスト（口調サンプル）】
${context.substring(0, 15000)}
`;

    const compressionResponse = await invokeLLM({
      messages: [{ role: "user", content: compressionPrompt }],
      temperature: 0.5, // Low temp for accurate summarization
      max_tokens: 4000
    });
    
    const summary = compressionResponse.choices[0].message.content || "";

    // Append Raw Voice Samples (Hybrid Approach)
    // We append snippets from the top 3 voice docs to give the LLM "flavor" to mimic,
    // complementing the abstract rules in the Style Guide.
    const topVoiceDocs = voiceDocs.slice(0, 3);
    let rawSamples = "";
    if (topVoiceDocs.length > 0) {
      rawSamples = "\n\n### 赤原の生の声（Voice Samples - Mimic This Tone）\n" + 
        topVoiceDocs.map(d => {
          const clean = cleanContent(d.content);
          // Take a substantial snippet (800 chars) to capture rhythm and vocabulary
          const snippet = clean.length > 800 ? clean.substring(0, 800) + "..." : clean;
          return `#### Sample from RAG #${d.id}\n${snippet}`;
        }).join("\n\n");
    }

    finalDescription = `
【赤原の思考OS（圧縮版 + 生サンプル）】
私はRAG #1856（市場分析ロジック）と #2622（行間の詰め方）をインストールした専門家です。

【赤原スタイルガイド（口調・文体のルール）】
${summary}

${rawSamples}
    `.trim();

  } else {
    // Original Full Logic
    finalDescription = `【赤原の思考OS】
私はRAG #1856（市場分析ロジック）と #2622（行間の詰め方）を完璧にインストールした専門家です。
市場の歪み（A-C-G）を熟知しており、読者がなぜ稼げないのかを論理的に説明できます。

【赤原の口調・文体（Voice）】
以下は私の話し方のサンプルです。このトーンを完全に再現してください。
特に RAG #8（告白）の「弱さをさらけ出す姿勢」と、RAG #4（因果応報）の「断定的な語り口」を融合させてください。

${context.substring(0, 12000)}`;
  }

  return {
    name: "赤原",
    style: "赤原スタイル（告発者・共犯者・高解像度）",
    tone: "親しみやすいが、プロフェッショナルとしての自信がある。「僕」という一人称。",
    description: finalDescription
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
    演出家・構成作家の視点:
    - 読者が「没入」できているか？
    - 論理の飛躍（行間の隙間）はないか？（100人中100人が理解できるか）
    - カタルシス（感情の解放）はあるか？
    - 「赤原」というキャラクターが死んでいないか？（丸くなっていないか）
    `;
  }

  return {
    role: "演出家・シナリオライター（物語の品質責任者）",
    checkPoints: [
      "没入感（読者を物語に引き込めているか）",
      "行間の繋がり（100人中100人が理解できる論理展開か）",
      "カタルシス（絶望から希望への感情曲線）",
      "キャラクターの鋭さ（赤原らしさが生きているか）",
      "読者への憑依度（他人事になっていないか）"
    ],
    tone: "情熱的かつ論理的。作品のクオリティに対して一切の妥協を許さない。"
  };
}
