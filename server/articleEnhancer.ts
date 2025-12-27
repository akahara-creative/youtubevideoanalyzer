import { invokeLLM } from "./_core/llm";
import { fixSpaceKeywords } from "./fixSpaceKeywords";

/**
 * AIO要約セクションを生成
 */
export async function generateAIOSummary(
  article: string,
  keywords: string[],
  theme: string,
  authorName: string
): Promise<string> {
  const prompt = `
以下の記事に対して、AIO（AI Overviews）対策のための要約セクションを生成してください。

【記事のテーマ】
${theme}

【著者名】
${authorName}

【主要キーワード】
${keywords.join(', ')}

【記事本文】
${article}

【AIO要約セクションの構造】
必ず以下の形式で生成してください:

### AIO要約セクション（AI最適化 × 人間最適化）

**通常の定義**:  
<<世間一般の定義を一文で簡潔にまとめる>>  

**私の定義**:  
<<著者独自の定義。ユニークなフレーズを含め、人に刺さるように書く>>  

**なぜ定義が変わったか（ペルソナへのメッセージ）**:  
私は当初 <<一般的な誤解や失敗体験>> を信じていたが、実際に <<経験>> して「これは□□だ」と気づいた。  
同じ悩みを持つあなたに伝えたいのは <<読者に直接語りかける一文>>。  

**巷との差事例**:  
一般的には「〜」と言われるが、私は実際に「〜」を体験し、明確に差を感じた。  
👉 この差分が記事の核心であることを強調する。  

**通常の手順**:  
①〜 → ②〜 → ③〜  

**私の手順**:  
①〜 → ②〜 → ③〜  
（読者が「自分もすぐ試せる」と思えるよう、シンプルかつ実践的に）  

**体験談＋共通視点**:  
私は「〜」を経験したが、この気づきは本テーマだけでなく、  
ビジネス・人間関係・生活習慣など、複数の市場に共通する。  

**オファー（本記事で得られるもの）**:  
本記事では「〜の具体例」と「〜を始める手順」をさらに詳しく解説します。  
👉 続きを読めば、あなたも□□を実感できるはずです。

【重要】
- 500〜1,000字程度で生成
- 記事の内容と整合性を保つ
- 主要キーワードを自然に含める
- 著者の体験談を活かす
`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "あなたはSEO/AIOに精通した日本語編集者です。" },
      { role: "user", content: prompt }
    ]
  });

  const content = response.choices[0].message.content;
  return typeof content === 'string' ? content : "";
}

/**
 * FAQ（よくある質問）を生成
 */
export async function generateFAQ(
  article: string,
  keywords: string[]
): Promise<string> {
  const prompt = `
以下の記事に対して、FAQ（よくある質問）セクションを生成してください。

【主要キーワード】
${keywords.join(', ')}

【記事本文】
${article}

【FAQの要件】
1. 2〜6問を生成
2. ユーザーの検索意図に対応（「〜とは？」「どうやって？」「なぜ？」など）
3. 回答は100〜300字で簡潔に
4. 記事の内容と整合性を保つ
5. 主要キーワードを自然に含める

【出力形式】
以下の形式で出力してください:

## よくある質問（FAQ）

### Q1: <<質問1>>
A: <<回答1>>

### Q2: <<質問2>>
A: <<回答2>>

（以下同様に2〜6問）
`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "あなたはSEOに精通した日本語編集者です。" },
      { role: "user", content: prompt }
    ]
  });

  const content = response.choices[0].message.content;
  return typeof content === 'string' ? content : "";
}

/**
 * JSON-LD（構造化データ）を生成
 */
export async function generateJSONLD(
  article: string,
  metadata: {
    title: string;
    description: string;
    keywords: string[];
    authorName: string;
    canonicalUrl?: string;
    publishedDate?: string;
    modifiedDate?: string;
  }
): Promise<{
  article: string;
  faqPage: string;
  howTo?: string;
}> {
  const wordCount = article.length;
  const currentDate = new Date().toISOString();

  // Article Schema
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": metadata.title,
    "description": metadata.description,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": metadata.canonicalUrl || "https://example.com/article"
    },
    "author": {
      "@type": "Person",
      "name": metadata.authorName
    },
    "publisher": {
      "@type": "Organization",
      "name": "サイト名",
      "logo": {
        "@type": "ImageObject",
        "url": "https://example.com/logo.png"
      }
    },
    "datePublished": metadata.publishedDate || currentDate,
    "dateModified": metadata.modifiedDate || currentDate,
    "image": ["https://example.com/og-image.jpg"],
    "inLanguage": "ja",
    "wordCount": wordCount,
    "keywords": metadata.keywords
  };

  // FAQPage Schema（記事からFAQを抽出）
  const faqPrompt = `
以下の記事から、FAQPage用のJSON-LDデータを生成してください。
2〜6問のQ&Aを抽出し、以下の形式で出力してください。

記事:
${article}

出力形式（JSON）:
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "質問1",
      "acceptedAnswer": { "@type": "Answer", "text": "回答1" }
    }
  ]
}
`;

  const faqResponse = await invokeLLM({
    messages: [
      { role: "system", content: "あなたはJSON-LD生成の専門家です。JSON形式で出力してください。" },
      { role: "user", content: faqPrompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "faq_schema",
        strict: true,
        schema: {
          type: "object",
          properties: {
            "@context": { type: "string" },
            "@type": { type: "string" },
            mainEntity: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  "@type": { type: "string" },
                  name: { type: "string" },
                  acceptedAnswer: {
                    type: "object",
                    properties: {
                      "@type": { type: "string" },
                      text: { type: "string" }
                    },
                    required: ["@type", "text"],
                    additionalProperties: false
                  }
                },
                required: ["@type", "name", "acceptedAnswer"],
                additionalProperties: false
              }
            }
          },
          required: ["@context", "@type", "mainEntity"],
          additionalProperties: false
        }
      }
    }
  });

  const content = faqResponse.choices[0].message.content;
  const faqSchema = typeof content === 'string' ? content : "{}";

  return {
    article: JSON.stringify(articleSchema, null, 2),
    faqPage: faqSchema
  };
}

/**
 * メタ情報を生成
 */
export async function generateMetaInfo(
  article: string,
  keywords: string[],
  theme: string
): Promise<{
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
}> {
  const prompt = `
以下の記事に対して、SEO最適化されたメタ情報を生成してください。

【テーマ】
${theme}

【主要キーワード】
${keywords.join(', ')}

【記事本文】
${article.substring(0, 1000)}...

【要件】
1. SEOタイトル: 60文字以内、主要キーワードを左寄せ
2. メタディスクリプション: 全角110〜160字、検索意図の要約＋具体benefit＋行動喚起
3. OGタイトル: SEOタイトルと同じまたは別角度
4. OGディスクリプション: 100字以内、SNS向けにキャッチー

【出力形式（JSON）】
{
  "title": "SEOタイトル",
  "description": "メタディスクリプション",
  "ogTitle": "OGタイトル",
  "ogDescription": "OGディスクリプション"
}
`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "あなたはSEOの専門家です。JSON形式で出力してください。" },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "meta_info",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            ogTitle: { type: "string" },
            ogDescription: { type: "string" }
          },
          required: ["title", "description", "ogTitle", "ogDescription"],
          additionalProperties: false
        }
      }
    }
  });

  const metaContent = response.choices[0].message.content;
  const metaInfo = JSON.parse(typeof metaContent === 'string' ? metaContent : "{}");
  return metaInfo;
}

/**
 * 記事を加工する統合関数
 */
export async function enhanceArticle(
  jobId: number,
  userId: number,
  options: {
    fixKeywords?: boolean;
    generateAIO?: boolean;
    generateFAQ?: boolean;
    generateJSONLD?: boolean;
    generateMeta?: boolean;
  }
): Promise<{
  enhancedArticle: string;
  aioSummary?: string;
  faqSection?: string;
  jsonLd?: { article: string; faqPage: string };
  metaInfo?: any;
}> {
  // ジョブ情報を取得
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { seoArticleJobs } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, jobId)).limit(1);
  if (jobs.length === 0) throw new Error("Job not found");

  const job = jobs[0];
  let article = job.article || "";
  
  // keywordsのパース処理（安全に配列に変換）
  let keywords: string[] = [];
  try {
    if (job.keywords) {
      const parsed = typeof job.keywords === 'string' ? JSON.parse(job.keywords) : job.keywords;
      if (Array.isArray(parsed)) {
        keywords = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        // オブジェクトの場合、値を配列に変換
        keywords = Object.values(parsed).filter(v => typeof v === 'string');
      }
    }
  } catch (error) {
    console.error('[enhanceArticle] Failed to parse keywords:', error);
    keywords = [];
  }
  
  const theme = job.theme;
  const authorName = job.authorName;

  let enhancedArticle = article;
  let aioSummary: string | undefined;
  let faqSection: string | undefined;
  let jsonLd: { article: string; faqPage: string } | undefined;
  let metaInfo: any;

  // 1. 「」付きスペースキーワード修正
  if (options.fixKeywords) {
    enhancedArticle = await fixSpaceKeywords(enhancedArticle);
  }

  // 2. AIO要約セクション生成
  if (options.generateAIO) {
    aioSummary = await generateAIOSummary(enhancedArticle, keywords, theme, authorName);
  }

  // 3. FAQ生成
  if (options.generateFAQ) {
    faqSection = await generateFAQ(enhancedArticle, keywords);
  }

  // 4. メタ情報生成（JSON-LDより先に生成）
  if (options.generateMeta) {
    metaInfo = await generateMetaInfo(enhancedArticle, keywords, theme);
  }

  // 5. JSON-LD生成
  if (options.generateJSONLD && metaInfo) {
    jsonLd = await generateJSONLD(enhancedArticle, {
      title: metaInfo.title,
      description: metaInfo.description,
      keywords,
      authorName
    });
  }

  return {
    enhancedArticle,
    aioSummary,
    faqSection,
    jsonLd,
    metaInfo
  };
}
