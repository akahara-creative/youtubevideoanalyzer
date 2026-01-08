import { invokeLLM, InvokeParams } from './_core/llm';
import { GeneratedPersonas, generateTargetPersona, generateWriterPersona, generateEditorPersona } from './personaGenerator';
import { 
  getStructureSystemPrompt, 
  getStructureSystemPromptLocal, 
  getWritingSystemPrompt, 
  getWritingSystemPromptLocal 
} from "./prompts/seoPrompts";

/**
 * SEO記事生成の8ステッププロセス
 * 
 * プロセス定義：
 * 1. テーマ決定
 * 2. 検索ワード想定
 * 3. 上位10記事分析（文字数、H2/H3、キーワード・類義語・対策語の出現回数・配置）
 * 4. 全てを上回る基準作成
 * 5. RAG参照で赤原カラー全開の構成作成
 * 6. (5)の構成を維持しつつ(4)の基準を満たす記事生成（「あなた」禁止、筆者の体験談）
 * 7. 品質チェック＋基準クリア確認
 * 8. エクスポート格納
 */

export interface SEOArticleRequest {
  theme: string;
  keywords: string[];
  ragContext: string;
}

export interface ArticleAnalysis {
  url: string;
  title: string;
  wordCount: number;
  h2Count: number;
  h3Count: number;
  keywordOccurrences: Array<{ keyword: string; count: number; positions: number[] }>;
  synonymOccurrences: Array<{ synonym: string; count: number; positions: number[] }>;
  relatedOccurrences: Array<{ related: string; count: number; positions: number[] }>;
  strategy?: string;
  specialNotes?: string;
}

export interface SEOCriteria {
  targetWordCount: number;
  targetH2Count: number;
  targetH3Count: number;
  targetKeywords: Array<{ keyword: string; minCount: number }>;
  targetSynonyms: Array<{ synonym: string; minCount: number }>;
  targetRelated: Array<{ related: string; minCount: number }>;
}

/**
 * ステップ1.5: 結論キーワードと集客源キーワードの切り分け
 * 
 * 例: 「SEOとかバズ、プレゼント企画、SNSマーケという人は全員ステップメールを書くべき理由」
 * - 結論キーワード: ステップメール（オファーで語る、SEO対策から外す）
 * - 集客源キーワード: 「SEO 稼げない理由」「プレゼント企画 稼げない」等（SEO対策の対象）
 */
export async function separateKeywords(
  theme: string,
  remarks?: string
): Promise<{
  conclusionKeywords: string[];
  trafficKeywords: string[];
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたはSEOの専門家です。

テーマから以下の2種類のキーワードを切り分けてください：

1. **結論キーワード**: 読者に「やった方がいいよ」と勧める答えになるキーワード
   - これはオファー（メルマガ、LINE等）で語る内容なので、SEO対策から外す
   - 例: 「ステップメール」

2. **集客源キーワード**: 読者が検索しそうな悩み・問題のキーワード
   - これがSEO対策の対象
   - 例: 「SEO 稼げない理由」「プレゼント企画 稼げない」「SNSマーケ 稼げない」

以下のJSON形式で返してください：
{
  "conclusionKeywords": ["結論キーワード1", "結論キーワード2"],
  "trafficKeywords": ["集客源キーワード1", "集客源キーワード2", "集客源キーワード3"]
}`
      },
      {
        role: "user",
        content: `テーマ: ${theme}
${remarks ? `\n備考（意図・方向性）: ${remarks}` : ''}

このテーマ${remarks ? 'と備考' : ''}から結論キーワードと集客源キーワードを切り分けてください。`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "keyword_separation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            conclusionKeywords: {
              type: "array",
              items: { type: "string" },
              description: "結論キーワード（オファーで語る）"
            },
            trafficKeywords: {
              type: "array",
              items: { type: "string" },
              description: "集客源キーワード（SEO対策の対象）"
            }
          },
          required: ["conclusionKeywords", "trafficKeywords"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0].message.content as string;
  const result = JSON.parse(content);
  return result;
}

/**
 * ステップ2: 検索ワード想定（集客源キーワードのみ）
 * 集客源キーワードから関連する検索ワードを生成
 */
export async function generateSearchKeywords(trafficKeywords: string[]): Promise<string[]> {
  // 集客源キーワードをそのまま返す（既に切り分け済み）
  return trafficKeywords;
}

/**
 * ステップ3: 上位10記事の分析
 * 検索ワードごとに上位10記事を分析
 */
export async function analyzeTopArticles(
  keyword: string, 
  allKeywords: string[],
  onProgress?: (message: string) => Promise<void>
): Promise<ArticleAnalysis[]> {
  const { searchGoogle, scrapeArticle } = await import('./scraper');
  
  console.log(`[SEO記事分析] キーワード「${keyword}」の上位記事を検索中...`);
  
  // 1. Google検索で上位記事のURLを取得
  const urls = await searchGoogle(keyword, 5); // 5記事に拡大（ランキング上位狙い）
  
  if (urls.length === 0) {
    console.warn(`[SEO記事分析] キーワード「${keyword}」の検索結果が見つかりませんでした。シミュレーションに切り替えます。`);
    // フォールバック: 検索失敗時は従来のシミュレーションを実行
    return analyzeTopArticlesSimulation(keyword, allKeywords);
  }
  
  const analyses: ArticleAnalysis[] = [];
  
  // 2. 各記事をスクレイピングして分析
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      if (onProgress) {
        await onProgress(`記事分析中 (${i + 1}/${urls.length}): ${url}`);
      }
      // スクレイピング実行
      const scrapedData = await scrapeArticle(url);
      
      if (!scrapedData.content || scrapedData.content.length < 500) {
        console.log(`[SEO記事分析] コンテンツが短すぎるためスキップ: ${url}`);
        continue;
      }
      
      // LLMで記事内容を分析
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `あなたはSEO分析の専門家です。
提供された競合記事のテキストを分析し、SEO戦略や特徴を抽出してください。

以下のJSON形式で分析結果を返してください：
{
  "keywordOccurrences": [{"keyword": "キーワード1", "count": 15}, {"keyword": "キーワード2", "count": 8}],
  "synonymOccurrences": [{"synonym": "類義語", "count": 8}],
  "relatedOccurrences": [{"related": "関連語", "count": 12}],
  "strategy": "この記事のターゲット読者と、どのような訴求でコンバージョン（成約）を狙っているか",
  "specialNotes": "独自の体験談、図解の有無、権威性の出し方などの特徴"
}

重要：
- keywordOccurrencesには、指定された「全キーワード」が記事内に何回出現するかをカウント（または推定）して記載してください。
- strategyとspecialNotesは、日本語で具体的に記述してください。`
          },
          {
            role: "user",
            content: `分析対象キーワード: ${keyword}
全キーワードリスト: ${allKeywords.join(', ')}

【記事データ】
タイトル: ${scrapedData.title}
URL: ${url}
文字数: ${scrapedData.wordCount}
H2見出し: ${scrapedData.h2.join(' / ')}
H3見出し: ${scrapedData.h3.join(' / ')}

【記事本文（抜粋）】
${scrapedData.content.substring(0, 15000)}` // コンテキスト制限のため15000文字に制限
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "single_article_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                keywordOccurrences: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      keyword: { type: "string" },
                      count: { type: "integer" }
                    },
                    required: ["keyword", "count"],
                    additionalProperties: false
                  }
                },
                synonymOccurrences: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      synonym: { type: "string" },
                      count: { type: "integer" }
                    },
                    required: ["synonym", "count"],
                    additionalProperties: false
                  }
                },
                relatedOccurrences: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      related: { type: "string" },
                      count: { type: "integer" }
                    },
                    required: ["related", "count"],
                    additionalProperties: false
                  }
                },
                strategy: { type: "string" },
                specialNotes: { type: "string" }
              },
              required: ["keywordOccurrences", "synonymOccurrences", "relatedOccurrences", "strategy", "specialNotes"],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0].message.content as string;
      const llmAnalysis = JSON.parse(content);
      
      analyses.push({
        url: url,
        title: scrapedData.title,
        wordCount: scrapedData.wordCount,
        h2Count: scrapedData.h2.length,
        h3Count: scrapedData.h3.length,
        keywordOccurrences: llmAnalysis.keywordOccurrences.map((ko: any) => ({ ...ko, positions: [] })),
        synonymOccurrences: llmAnalysis.synonymOccurrences.map((so: any) => ({ ...so, positions: [] })),
        relatedOccurrences: llmAnalysis.relatedOccurrences.map((ro: any) => ({ ...ro, positions: [] })),
        strategy: llmAnalysis.strategy,
        specialNotes: llmAnalysis.specialNotes
      });
      
    } catch (error) {
      console.error(`[SEO記事分析] 記事分析エラー (${url}):`, error);
      // エラー時はスキップ
    }
  }
  
  // 1件も取得できなかった場合はシミュレーションにフォールバック
  if (analyses.length === 0) {
    console.warn(`[SEO記事分析] 有効な記事分析データが取得できませんでした。シミュレーションに切り替えます。`);
    return analyzeTopArticlesSimulation(keyword, allKeywords);
  }
  
  return analyses;
}

/**
 * (旧) 上位記事分析シミュレーション
 * 検索やスクレイピングに失敗した場合のフォールバック用
 */
async function analyzeTopArticlesSimulation(keyword: string, allKeywords: string[]): Promise<ArticleAnalysis[]> {
  // LLMを使用して上位記事の情報を取得（実際の検索は行わず、LLMの知識ベースから推定）
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたはSEO分析の専門家です。指定されたキーワードで検索上位に表示されそうな記事の特徴を分析してください。

重要：keywordOccurrencesには、指定された全キーワードの出現回数を記載してください。

以下のJSON形式で3記事分のデータを返してください：
[
  {
    "url": "https://example.com/article1",
    "title": "記事タイトル",
    "wordCount": 3000,
    "h2Count": 5,
    "h3Count": 10,
    "keywordOccurrences": [{"keyword": "キーワード1", "count": 15}, {"keyword": "キーワード2", "count": 8}],
    "synonymOccurrences": [{"synonym": "類義語", "count": 8}],
    "relatedOccurrences": [{"related": "関連語", "count": 12}],
    "strategy": "初心者向けに網羅性を重視した戦略",
    "specialNotes": "図解が多く、滞在時間が長いと推測される"
  }
]`
      },
      {
        role: "user",
        content: `キーワード: ${keyword}\n全キーワード: ${allKeywords.join(', ')}\n\nこのキーワードで検索上位に表示されそうな記事を3つ分析してください。`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "article_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            articles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: { type: "string" },
                  title: { type: "string" },
                  wordCount: { type: "integer" },
                  h2Count: { type: "integer" },
                  h3Count: { type: "integer" },
                  keywordOccurrences: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        keyword: { type: "string" },
                        count: { type: "integer" }
                      },
                      required: ["keyword", "count"],
                      additionalProperties: false
                    }
                  },
                  synonymOccurrences: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        synonym: { type: "string" },
                        count: { type: "integer" }
                      },
                      required: ["synonym", "count"],
                      additionalProperties: false
                    }
                  },
                  relatedOccurrences: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        related: { type: "string" },
                        count: { type: "integer" }
                      },
                      required: ["related", "count"],
                      additionalProperties: false
                    }
                  },
                  strategy: { type: "string" },
                  specialNotes: { type: "string" }
                },
                required: ["url", "title", "wordCount", "h2Count", "h3Count", "keywordOccurrences", "synonymOccurrences", "relatedOccurrences", "strategy", "specialNotes"],
                additionalProperties: false
              }
            }
          },
          required: ["articles"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0].message.content as string;
  // Clean content of markdown code blocks if present
  const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    const result = JSON.parse(cleanedContent);
    return result.articles.map((article: any) => ({
      ...article,
      keywordOccurrences: article.keywordOccurrences.map((ko: any) => ({ ...ko, positions: [] })),
      synonymOccurrences: article.synonymOccurrences.map((so: any) => ({ ...so, positions: [] })),
      relatedOccurrences: article.relatedOccurrences.map((ro: any) => ({ ...ro, positions: [] }))
    }));
  } catch (error) {
    console.error("Error parsing simulation result for keyword", keyword, error);
    return []; // Return an empty array or handle as appropriate
  }
}

/**
 * ステップ3.5: 競合記事から「巷の記事・商品から見出される読者の報われない希望」を収集
 * 
 * 例: 「SEO 稼げない理由」で検索すると、以下のような読者の痛みが見える：
 * - 「SEOで書いても埋もれた」
 * - 「3ヶ月書いても1日10アクセス」
 * - 「毎日5時間かけて書いて、誰も読まない」
 */
export async function extractPainPoints(
  keyword: string,
  analyses: ArticleAnalysis[]
): Promise<{
  painPoints: string[];  // 読者の痛み・報われない希望
  realVoices: string[];  // 競合記事から抽出した読者の生の声
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたはSEO分析の専門家です。

競合記事から「読者の痛み・報われない希望」を抽出してください。

例:
- キーワード: 「SEO 稼げない理由」
- 読者の痛み: 「SEOで書いても埋もれた」「3ヶ月書いても1日10アクセス」「毎日5時間かけて書いて、誰も読まない」

以下のJSON形式で返してください：
{
  "painPoints": ["痛み1", "痛み2", "痛み3"],
  "realVoices": ["生の声1", "生の声2", "生の声3"]
}`
      },
      {
        role: "user",
        content: `キーワード: ${keyword}

競合記事:
${analyses.map(a => `- ${a.title} (${a.wordCount}文字)`).join('\n')}

これらの記事から、読者の痛み・報われない希望を抽出してください。`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "pain_points_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            painPoints: {
              type: "array",
              items: { type: "string" },
              description: "読者の痛み・報われない希望"
            },
            realVoices: {
              type: "array",
              items: { type: "string" },
              description: "競合記事から抽出した読者の生の声"
            }
          },
          required: ["painPoints", "realVoices"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0].message.content as string;
  const result = JSON.parse(content);
  return result;
}

/**
 * ステップ3.6: 苦労したエピソードに繋げやすいキーワードを生成
 * 
 * 読者の痛みを、筆者（赤原）の実体験の苦労話に変換
 * 例: 「SEOで書いても埋もれた」→ 「僕もSEOで書いたが、3ヶ月間1日10アクセスだった」
 */
export async function generateStoryKeywords(
  painPoints: string[],
  trafficKeywords: string[],
  authorName: string = "赤原"
): Promise<{
  storyKeywords: string[];  // 苦労したエピソードに繋げやすいキーワード
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたは${authorName}スタイルの記事を書く専門家です。

読者の痛み・報われない希望を、筆者（${authorName}）の実体験の苦労話に変換してください。

**重要**:
- 「僕」という一人称で語る
- 具体的な数字を入れる（例: 3ヶ月、1日10アクセス、15時間労働）
- 生々しい描写を入れる（例: 「マジで地獄だった」「完全に壊れた」）
- 集客源キーワードを自然に組み込む

例:
- 読者の痛み: 「SEOで書いても埋もれた」
- 苦労話: 「僕もSEOで書いたが、3ヶ月間1日10アクセスだった。マジで地獄。毎日5時間かけて書いて、誰も読まない。」

以下のJSON形式で返してください：
{
  "storyKeywords": ["苦労話1", "苦労話2", "苦労話3"]
}`
      },
      {
        role: "user",
        content: `集客源キーワード: ${trafficKeywords.join(', ')}

読者の痛み・報われない希望:
${painPoints.join('\n')}

これらを${authorName}の実体験の苦労話に変換してください。`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "story_keywords_generation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            storyKeywords: {
              type: "array",
              items: { type: "string" },
              description: "苦労したエピソードに繋げやすいキーワード"
            }
          },
          required: ["storyKeywords"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0].message.content as string;
  const result = JSON.parse(content);
  return result;
}

/**
 * ステップ3.7: 「巷の記事・商品から見出される読者の報われない希望」を集める
 * 
 * 読者の痛みを、結論キーワード（例: ステップメール）を学ぶためのオファーに繋げる
 * 例: 「SEOやバズに頼らず、ステップメールで自動化すれば、この地獄から抜け出せる」
 */
export async function generateOfferBridge(
  painPoints: string[],
  storyKeywords: string[],
  conclusionKeywords: string[],
  authorName: string = "赤原",
  offer?: string
): Promise<{
  offerBridge: string[];  // オファーへの橋渡し
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたは${authorName}スタイルの記事を書く専門家です。

読者の痛み・報われない希望を、結論キーワード（オファー）への橋渡しに変換してください。

**重要**:
- 「僕」という一人称で語る
- 苦労したエピソードを使いながら、結論キーワードが解決策であることを示す
- 「この地獄から抜け出せる」「人生が変わった」等の表現を使う
- オファー（メルマガ、LINE等）への自然な流れを作る
${offer ? `- **具体的なオファー内容（${offer}）への誘導を必ず含める**` : ''}

例:
- 読者の痛み: 「SEOで書いても埋もれる」「バズ狙いで疲弊している」
- 結論キーワード: ステップメール
- 橋渡し: 「僕もSEOやバズに振り回されて、毎日15時間働いてた。でも、ステップメールを学んでから、この地獄から抜け出せた。今は自動化できて、人生が変わった。」

以下のJSON形式で返してください：
{
  "offerBridge": ["橋渡し1", "橋渡し2", "橋渡し3"]
}`
      },
      {
        role: "user",
        content: `読者の痛み・報われない希望:
${painPoints.join('\n')}

苦労したエピソード:
${storyKeywords.join('\n')}

結論キーワード（オファー）:
${conclusionKeywords.join(', ')}

${offer ? `具体的なオファー内容:
${offer}
` : ''}

これらを使って、結論キーワードが解決策であることを示す橋渡しを作ってください。`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "offer_bridge_generation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            offerBridge: {
              type: "array",
              items: { type: "string" },
              description: "オファーへの橋渡し"
            }
          },
          required: ["offerBridge"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0].message.content as string;
  const result = JSON.parse(content);
  return result;
}

/**
 * ステップ4: SEO基準作成
 * 分析結果から全てを上回る基準を作成
 */
export function createSEOCriteria(analyses: ArticleAnalysis[], userTargetWordCount: number = 5000): SEOCriteria {
  const competitorMaxWordCount = Math.max(...analyses.map(a => a.wordCount));
  const maxH2Count = Math.max(...analyses.map(a => a.h2Count));
  const maxH3Count = Math.max(...analyses.map(a => a.h3Count));
  
  // ユーザー指定文字数と競合最大文字数を比較し、大きい方を採用
  const maxWordCount = Math.max(userTargetWordCount, competitorMaxWordCount + 500);

  // キーワード出現回数の集計
  const keywordMap = new Map<string, number[]>();
  const synonymMap = new Map<string, number[]>();
  const relatedMap = new Map<string, number[]>();

  analyses.forEach(analysis => {
    analysis.keywordOccurrences.forEach(ko => {
      if (!keywordMap.has(ko.keyword)) keywordMap.set(ko.keyword, []);
      keywordMap.get(ko.keyword)!.push(ko.count);
    });
    analysis.synonymOccurrences.forEach(so => {
      if (!synonymMap.has(so.synonym)) synonymMap.set(so.synonym, []);
      synonymMap.get(so.synonym)!.push(so.count);
    });
    analysis.relatedOccurrences.forEach(ro => {
      if (!relatedMap.has(ro.related)) relatedMap.set(ro.related, []);
      relatedMap.get(ro.related)!.push(ro.count);
    });
  });

  // 各キーワードの最大出現回数を取得
  // 注意: 競合の2倍を目標とする（どうせ達成できないので、高めの目標を設定）
  const targetKeywords = Array.from(keywordMap.entries()).map(([keyword, counts]) => ({
    keyword,
    minCount: Math.max(Math.ceil(Math.max(...counts) * 2), 5) // 最大値の2倍、最低5回
  }));

  const targetSynonyms = Array.from(synonymMap.entries()).map(([synonym, counts]) => ({
    synonym,
    minCount: Math.max(Math.ceil(Math.max(...counts) * 2), 3) // 最大値の2倍、最低3回
  }));

  const targetRelated = Array.from(relatedMap.entries()).map(([related, counts]) => ({
    related,
    minCount: Math.max(Math.ceil(Math.max(...counts) * 2), 3) // 最大値の2倍、最低3回
  }));

  return {
    targetWordCount: maxWordCount,
    // 文字数ベースでH2数を計算（3000文字あたり1セクション）
    // Akaharaスタイルは1セクションが長くなる傾向があるため、セクション数を抑える
    targetH2Count: Math.max(Math.ceil(maxWordCount / 3000), 5),
    // H3も文字数ベースで制限（1000文字あたり1セクション）
    targetH3Count: Math.max(Math.ceil(maxWordCount / 1000), 15),
    targetKeywords,
    targetSynonyms,
    targetRelated
  };
}

/**
 * ステップ5: RAG参照で赤原カラー全開の構成作成
 * RAGから赤原スタイルの参考資料を取得し、記事構成を作成
 */
export async function createArticleStructure(
  theme: string,
  seoCriteria: SEOCriteria,
  ragContext: string,
  authorName: string = "赤原",
  painPoints: string[],
  storyKeywords: string[],
  offerBridge: string[],
  conclusionKeywords: string[] = [],
  generatedPersonas: GeneratedPersonas,
  remarks?: string,
  offer?: string,
  akaharaLogic?: { A: string; B: string; C: string; D: string; E: string; F: string; G: string; H: string; }
): Promise<{ structure: string; estimates: { wordCount: number; h2Count: number; h3Count: number; keywordCounts: Record<string, number> } }> {
  // conclusionKeywordsが空配列の場合のデフォルト値
  const safeConclusion = conclusionKeywords.length > 0 ? conclusionKeywords : ['結論キーワード'];
  const keywordInstructions = seoCriteria.targetKeywords
    .map(k => `- ${k.keyword}: 最低${k.minCount}回`)
    .join('\n');

  const synonymInstructions = seoCriteria.targetSynonyms
    .map(s => `- ${s.synonym}: 最低${s.minCount}回`)
    .join('\n');

  const relatedInstructions = seoCriteria.targetRelated
    .map(r => `- ${r.related}: 最低${r.minCount}回`)
    .join('\n');

  // Writer Persona Description
  const writerPersonaDescription = generatedPersonas?.writer?.description || "赤原（詳細不明）";

  // 1. Initial Structure Generation
  console.log("[createArticleStructure] Generating initial structure...");
  const initialResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: process.env.USE_OLLAMA === 'true' 
          ? getStructureSystemPromptLocal(authorName, seoCriteria, ragContext, writerPersonaDescription, remarks, offer, akaharaLogic)
          : getStructureSystemPrompt(authorName, seoCriteria, ragContext, writerPersonaDescription, remarks, offer, akaharaLogic)
      },
      {
        role: "user",
        content: `テーマ: ${theme}
${remarks ? `\n備考（意図・方向性）: ${remarks}` : ''}
${offer ? `\nオファー（ゴール）: ${offer}` : ''}

このテーマ${remarks ? 'と備考' : ''}で、競合に圧勝する記事構成を作成してください。

【重要：絶対遵守ルール】
1. **目標文字数: ${seoCriteria.targetWordCount}文字以上**（これを下回る構成は禁止）
2. **H2見出し数: ${seoCriteria.targetH2Count}個以上**（これより少ないと文字数が足りません）
3. **H3見出し数: ${seoCriteria.targetH3Count}個以上**
4. 競合の2倍のボリュームを目指してください。

指定された[ESTIMATES]と[STRUCTURE]の形式で出力してください。`
      }
    ],
    max_tokens: 8192
  });

  let content = initialResponse.choices[0].message.content;
  if (typeof content !== 'string') {
    throw new Error('LLM response content is not a string');
  }

  // 2. Reader Persona Critique (Self-Correction)
  console.log("[createArticleStructure] Running Reader Persona Critique...");
  const critiqueResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたは「利己的で短気な読者（ペルソナ）」です。
提示された記事構成を見て、**「自分の悩みが解決しそうか？」「読み進めたいと思うか？」**を厳しく判定してください。

【あなたの特徴（ペルソナ）】
${generatedPersonas?.target ? `
特徴: ${generatedPersonas.target.characteristics}
現在の苦悩: ${generatedPersonas.target.struggles}
市場への怒り: ${generatedPersonas.target.frustrations}
**離脱ポイント（絶対に許せないこと）: ${generatedPersonas.target.rejectionCriteria}**
` : ''}

【あなたの判断基準（これがあったら即離脱）】
1. **「解決策（仕組み化・ステップメール等）」について説教されていないか？**
   - 「簡単に稼げると思うな」「仕組み化は大変だ」などと、**解決策に対してハードルを上げられたり、説教されたりしたら、即座に「読みたくない」と拒絶してください。**
   - 読者は「救い」を求めています。解決策は「希望（天国）」でなければなりません。
2. **「俺の悩み」から始まっているか？**
   - いきなり「労働収入はダメだ」とか説教されていないか？
   - 「英語が話せるようになりたい」「動画編集で稼ぎたい」という**俺の顕在的欲求（ウォンツ）**に寄り添っているか？
3. **「なぜ俺が失敗したのか」が納得できるか？**
   - 単なる精神論ではなく、「市場の構造（A→C→G）」を使って、俺が騙されていた理由を論理的に説明してくれているか？

【出力形式】
ダメ出しがある場合は、具体的に「ここで説教されているから読みたくない」「解決策が難しそうで嫌だ」と指摘してください。
完璧なら「修正なし」と答えてください。`
      },
      {
        role: "user",
        content: `以下の記事構成を評価してください：
${content}`
      }
    ]
  });

  const critique = critiqueResponse.choices[0].message.content;
  console.log("[createArticleStructure] Reader Critique Result:", critique);

  // 2.5. Editor Persona Critique (Quality Control)
  console.log("[createArticleStructure] Running Editor Persona Critique...");
  const editorPersonaDescription = generatedPersonas?.editor?.role ? 
    `あなたは「${generatedPersonas.editor.role}」です。\n性格: ${generatedPersonas.editor.tone}\nチェックポイント: ${generatedPersonas.editor.checkPoints.join(', ')}` : 
    "あなたは「厳格な構成作家」です。";

  const editorCritiqueResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `${editorPersonaDescription}
提示された記事構成を、**「一つの作品（読み物）」としての完成度**で厳しく判定してください。

【あなたの判断基準】
1. **作品としての「熱」と「没入感」**
   - 単なる情報の羅列（解説記事）になっていないか？
   - 読者が冒頭から引き込まれ、最後まで一気に読ませる「ドラマ」や「カタルシス」が設計されているか？
2. **論理の完全性（行間の繋がり）**
   - **「100人中100人が同じ理解」**をできるか？論理の飛躍（説明不足の行間）はないか？
   - 導入の「悩み」から、結論の「解決策」まで、論理が一本の線で繋がっているか？
3. **赤原としての「鋭さ」**
   - 筆者（赤原）のキャラクターが活きているか？
   - 凡庸な「いい人」や「先生」になっていないか？（毒、棘、共犯者としてのスタンスが必要）

【出力形式】
ダメ出しがある場合は、具体的に「第X章の論理が飛躍している」「ここのカタルシスが弱い」と指摘してください。
完璧なら「修正なし」と答えてください。`
      },
      {
        role: "user",
        content: `以下の記事構成を評価してください：
${content}`
      }
    ]
  });
  const editorCritique = editorCritiqueResponse.choices[0].message.content;
  console.log("[createArticleStructure] Editor Critique Result:", editorCritique);

  // 3. Refinement (if needed)
  const needsRefinement = (critique && !critique.includes("修正なし")) || (editorCritique && !editorCritique.includes("修正なし"));

  if (needsRefinement) {
    console.log("[createArticleStructure] Refining structure based on critiques...");
    const refineResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: process.env.USE_OLLAMA === 'true' 
            ? getStructureSystemPromptLocal(authorName, seoCriteria, ragContext, writerPersonaDescription, remarks, offer, akaharaLogic)
            : getStructureSystemPrompt(authorName, seoCriteria, ragContext, writerPersonaDescription, remarks, offer, akaharaLogic)
        },
        {
          role: "user",
          content: `作成した構成に対して、以下の厳しい指摘がありました。

【読者（ペルソナ）からの指摘】
${critique || '特になし'}

【構成作家（編集者）からの指摘】
${editorCritique || '特になし'}

【指示】
これらの指摘を全て踏まえて、構成を修正してください。
**「読者の感情（ウォンツ）」を満たしつつ、「作品としての完成度（論理・熱量）」を高めてください。**
赤原としての「鋭さ」と「共感」を両立させた、最高傑作に仕上げてください。

出力は再度 [ESTIMATES] と [STRUCTURE] の形式で行ってください。`
        }
      ],
      max_tokens: 8192
    });

    const refinedContent = refineResponse.choices[0].message.content;
    if (typeof refinedContent === 'string') {
      content = refinedContent;
    }
  }
  
  console.log("[createArticleStructure] Final LLM response length:", content.length);

  // Parse custom format
  let estimates = { wordCount: 0, h2Count: 0, h3Count: 0, keywordCounts: {} as Record<string, number> };
  let structure = "";

  const estimatesMatch = content.match(/\[ESTIMATES\]([\s\S]*?)\[\/ESTIMATES\]/);
  if (estimatesMatch && estimatesMatch[1]) {
    try {
      // Remove any markdown code blocks if present inside the tag
      const jsonText = estimatesMatch[1].replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      estimates = JSON.parse(jsonText);
    } catch (e) {
      console.warn("[createArticleStructure] Failed to parse estimates JSON:", e);
    }
  }

  const structureMatch = content.match(/\[STRUCTURE\]([\s\S]*?)\[\/STRUCTURE\]/);
  if (structureMatch && structureMatch[1]) {
    structure = structureMatch[1].trim();
  } else {
    // Fallback: if no tags, assume the whole text is structure (or try to find markdown)
    console.warn("[createArticleStructure] No [STRUCTURE] tags found. Using full content as structure fallback.");
    // Try to find the start of markdown (first #)
    const firstHash = content.indexOf('#');
    if (firstHash >= 0) {
      structure = content.substring(firstHash);
    } else {
      structure = content;
    }
  }

  // Final check for empty structure
  if (!structure || structure.length < 100) {
     console.warn("[createArticleStructure] Structure seems too short or empty.");
  }

  // Ensure estimates are populated if missing
  if (estimates.wordCount === 0) {
      const h2Count = (structure.match(/^## /gm) || []).length;
      const h3Count = (structure.match(/^### /gm) || []).length;
      estimates.wordCount = structure.length * 2; // Rough estimate
      estimates.h2Count = h2Count;
      estimates.h3Count = h3Count;
  }

  return {
    estimates,
    structure
  };
}

/**
 * ステップ6: 記事生成
 * 構成を維持しつつSEO基準を満たす記事を生成
 */


export async function generateSEOArticle(
  structure: string,
  seoCriteria: SEOCriteria,
  ragContext: string,
  authorName: string = "赤原",
  conclusionKeywords: string[] = [],
  personas?: GeneratedPersonas,
  remarks?: string,
  offer?: string
): Promise<string> {
  // conclusionKeywordsが空配列の場合のデフォルト値
  const safeConclusion = conclusionKeywords.length > 0 ? conclusionKeywords : ['結論キーワード'];
  const keywordInstructions = seoCriteria.targetKeywords
    .map(k => `- ${k.keyword}: 最低${k.minCount}回（競合の2倍を目標）`)
    .join('\n');

  const synonymInstructions = seoCriteria.targetSynonyms
    .map(s => `- ${s.synonym}: 最低${s.minCount}回`)
    .join('\n');

  const relatedInstructions = seoCriteria.targetRelated
    .map(r => `- ${r.related}: 最低${r.minCount}回`)
    .join('\n');

  // ペルソナ情報がある場合は、プロンプトに追加
  let personaInstructions = "";
  if (personas) {
    personaInstructions = `
【執筆者ペルソナ：${personas.writer.name}】
性格・トーン: ${personas.writer.tone}
執筆スタイル: ${personas.writer.style}
詳細定義（思考・口調）: ${personas.writer.description}

【ターゲット読者ペルソナ】
特徴: ${personas.target.characteristics}
幼少期エピソード: ${personas.target.episodes.childhood}
学生時代エピソード: ${personas.target.episodes.student}
社会人エピソード: ${personas.target.episodes.adult}
現在の苦悩（集客元ネタ）: ${personas.target.struggles}
市場への怒り・葛藤: ${personas.target.frustrations}
潜在的な適性（解決策ネタ）: ${personas.target.latentAptitude}

【重要指示】
1. 執筆者は「${personas.writer.name}」になりきってください。
2. ターゲット読者の「苦悩」や「怒り」に深く共感し、代弁してください。
3. ターゲットのエピソード（幼少期〜現在）と類似した執筆者の実体験（RAG参照）を交えて語ってください。
4. ターゲットが「自分は解決策に向いている」と気づけるように、潜在的な適性を指摘してください。
`;
  }

  // 構造を解析してセクションに分割
  const sections = parseStructure(structure);
  let article = "";
  
  // タイトル（H1）があれば最初に追加
  const titleMatch = structure.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    article += `# ${titleMatch[1]}\n\n`;
  }

  // 各セクションの目標文字数を計算（実際のセクション数で割る）
  const targetSectionLength = Math.floor(seoCriteria.targetWordCount / sections.length);

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    console.log(`[generateSEOArticle] Generating section ${i + 1}/${sections.length}: ${section.title}`);
    const isFirstSection = i === 0;
    
    // 直前の文脈を取得（最大3000文字）
    const previousContext = article.slice(-3000);

    // 文字数に応じた執筆モードの決定
    let lengthInstruction = "";
    if (targetSectionLength < 1500) {
      lengthInstruction = `
【重要：ショートモード（濃縮）】
このセクションの目標文字数は**${targetSectionLength}文字**です。
**ミッション**: Akaharaスタイルの「熱量」を維持したまま、文章を極限まで**「濃縮」**してください。
- ダラダラと説明するのではなく、**短く鋭い言葉**で読者の心を刺してください。
- 「エスプレッソ」のように、苦味とコクを凝縮するイメージです。
- 冗長な経過説明は省き、**感情のピーク（絶望・怒り・決意）**だけを切り取って描写してください。
- 文字数は少ないですが、インパクトは最大化してください。
- **目標文字数の1.2倍（${Math.ceil(targetSectionLength * 1.2)}文字）以内**に収めることが、プロの構成力の見せ所です。`;
    } else if (targetSectionLength > 3000) {
      lengthInstruction = `
【重要：ロングモード】
このセクションの目標文字数は**${targetSectionLength}文字**とたっぷりあります。
Akaharaスタイルの真骨頂である「圧倒的な具体性」と「泥臭いエピソード」を存分に展開してください。
- 感情の揺れ動きを細部まで描写してください。
- 読者が「自分ごとか」と錯覚するレベルまで、情景描写を掘り下げてください。`;
    } else {
      lengthInstruction = `
【重要：スタンダードモード（疾走感）】
このセクションの目標文字数は**${targetSectionLength}文字**です。
標準的なAkaharaスタイルですが、**「疾走感」**を意識してください。
- 1つのエピソードに沈み込みすぎず、テンポよく展開させてください。
- 読者を飽きさせないよう、次々と場面を展開させる「映画の予告編」のようなスピード感を持って執筆してください。
- **目標文字数の1.3倍（${Math.ceil(targetSectionLength * 1.3)}文字）**を目安に、熱量をコントロールしてください。`;
    }

    const systemPrompt = process.env.USE_OLLAMA === 'true'
      ? getWritingSystemPromptLocal(authorName, i, sections.length, personaInstructions, keywordInstructions, targetSectionLength, lengthInstruction, isFirstSection, structure, previousContext)
      : getWritingSystemPrompt(authorName, i, sections.length, personaInstructions, keywordInstructions, targetSectionLength, lengthInstruction, isFirstSection, structure, previousContext);

    // Programmatically append the H2 header to ensure correct formatting
    // Ensure section.title has proper markdown (add ## if missing)
    let header = section.title.trim();
    if (!header.startsWith('#')) {
       header = `## ${header}`;
    }
    // Add header to article
    article += `\n\n${header}\n\n`;

    const sectionParams: InvokeParams = {
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `以下のセクションの**本文のみ**を執筆してください。
**見出し（${section.title}）はシステムが自動挿入するため、絶対に出力しないでください。**

【執筆対象セクション内容】
${section.content}

${!isFirstSection ? `
【直前の文脈（ここから自然に繋げてください）】
...${previousContext}

【絶対厳守のルール: 文脈の維持】
1. **再導入の禁止**: 登場人物（Tさんなど）や設定（コミュニティに来たことなど）は既に読者に伝わっています。「Tさんという人がいました」「彼は相談に来ました」といった**説明的な再導入は絶対に禁止**です。
2. **自然な接続**: 直前の文脈から、息継ぎなしで読めるように滑らかに繋げてください。
    - NG例: 「さて、次は〜の話をします」「ところで、Tさんは〜」
    - OK例: 「そんな彼が次に直面したのは、〜という地獄でした」「しかし、それでも彼は諦めきれませんでした」
` : ''}

【絶対厳守のルール: 構成と分量】
1. **H2見出し出力禁止**: H2見出しは書かず、いきなり本文（またはH3見出し）から書き始めてください。
2. **文字数の遵守**: このセクションの目標文字数は**${targetSectionLength}文字**です。
    - **${targetSectionLength < 1500 ? '濃縮' : '疾走感'}**: 無駄な引き伸ばしは禁止です。指定された文字数前後で、最も効果的に感情と情報を伝えてください。
    - 短すぎても長すぎてもいけません。**${Math.floor(targetSectionLength * 0.9)}文字〜${Math.ceil(targetSectionLength * 1.2)}文字**の範囲に必ず収めてください。
3. **備考欄の融合**: 備考欄の指示（相談者の話など）を、このセクションの内容に合わせて自然に組み込んでください。
4. **キーワードの確実な挿入**: 指定された「キーワード」は、文脈の中で自然に、かつ**必ず**使用してください。文字数が少なくても、キーワードを省略することは許されません。
5. **チャット返答の禁止**: 「承知しました」「以下に執筆します」などの前置きは一切不要です。記事の本文のみを出力してください。`
        }
      ]
    };

    const response = await invokeLLM({
      ...sectionParams,
      max_tokens: 4096
    });

    const content = response.choices[0].message.content;
    if (typeof content !== 'string') {
      throw new Error('LLM response content is not a string');
    }
    
    // Clean up content: Remove H2 if LLM disobeyed and outputted it anyway
    const cleanContent = content.replace(/^##\s+.*\n/g, '').trim();
    
    console.log(`[generateSEOArticle] Section ${i + 1} start: ${cleanContent.substring(0, 100).replace(/\n/g, ' ')}...`);

    article += cleanContent + "\n\n";
  }

  // 途切れチェックと補完
  let trimmedArticle = article.trim();
  // 不要な終了タグがあれば削除
  if (trimmedArticle.endsWith('</article>')) {
    article = article.replace('</article>', '');
    trimmedArticle = article.trim();
  }

  const lastChar = trimmedArticle.slice(-1);
  const validEndings = ['。', '！', '？', '!', '?', '>', '}', ']', ')', '\n'];
  
  if (!validEndings.includes(lastChar) && !trimmedArticle.endsWith('```')) {
    console.warn('[generateSEOArticle] Article appears truncated. Attempting to complete...');
    try {
      const completionResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `あなたは${authorName}です。執筆中の記事が途中で切れてしまいました。
文脈を読み取り、自然な形で文章を完結させてください。
必ず「〜です・〜ます」調で書いてください。`
          },
          {
            role: "user",
            content: `以下の文章の続きを書いて、記事を完結させてください：
\n${trimmedArticle.slice(-2000)}`
          }
        ],
        max_tokens: 1024
      });
      
      const completion = completionResponse.choices[0].message.content;
      if (typeof completion === 'string' && completion) {
        console.log('[generateSEOArticle] Completion added:', completion.substring(0, 50) + '...');
        article += completion + "\n\n";
      }
    } catch (e) {
      console.error('[generateSEOArticle] Failed to complete truncated article:', e);
    }
  }
  
  // RAGプロット表記を完全削除
  // パターン1: （A-Plot：誘惑と失敗）
  article = article.replace(/（[A-Z]-Plot[^）]*）/g, '');
  article = article.replace(/\([A-Z]-Plot[^)]*\)/g, '');
  
  // パターン2: （RAG A, B）、（RAG C, D）
  article = article.replace(/（RAG[^）]*）/g, '');
  article = article.replace(/\(RAG[^)]*\)/g, '');
  
  // パターン3: （A）、（B）、（C）等
  article = article.replace(/（[A-H]）：?/g, '');
  article = article.replace(/\([A-H]\):?/g, '');
  
  // パターン4: 【RAG5：D（裏切り）】
  article = article.replace(/【RAG[^】]*】/g, '');
  article = article.replace(/\[RAG[^\]]*\]/g, '');
  
  // 水平線・点線・装飾記号を自動削除
  article = article.replace(/^---+$/gm, ''); // Markdownの水平線
  article = article.replace(/^━+$/gm, ''); // 点線
  article = article.replace(/^＝+$/gm, ''); // 装飾記号
  article = article.replace(/^\*+$/gm, ''); // 装飾記号
  article = article.replace(/^・+$/gm, ''); // 点線
  article = article.replace(/^\s*$/gm, ''); // 空行を削除
  article = article.replace(/\n{3,}/g, '\n\n'); // 連続する空行を2行に制限
  
  // LLMの思考過程を削除
  article = article.replace(/文字数達成のための[^\n]*\n/g, '');
  article = article.replace(/キーワードカウント計画[^\n]*\n/g, '');
  article = article.replace(/構成と内容の確認[^\n]*\n/g, '');
  article = article.replace(/戦略で、[0-9,]+文字とキーワード目標を達成する[^\n]*\n/g, '');
  
  return article;
}

/**
 * ステップ8: エクスポート格納（後処理チェック付き）
 * スペース繋ぎキーワードを検出してリライト、ノウハウ記述を削除
 */
export async function exportArticleWithPostProcessing(
  article: string,
  conclusionKeywords: string[] = []
): Promise<string> {
  const { fixSpaceKeywords, removeHowToContent } = await import('./fixSpaceKeywords');
  
  // ステップ0: 「結論キーワード」プレースホルダーを実際のキーワードに置換
  let processedArticle = article;
  if (conclusionKeywords.length > 0) {
    const actualKeyword = conclusionKeywords[0];
    processedArticle = processedArticle.replace(/結論キーワード/g, actualKeyword);
    console.log(`[exportArticleWithPostProcessing] 「結論キーワード」を「${actualKeyword}」に置換しました`);
  }
  
  // ステップ1: スペース繋ぎキーワードを修正
  processedArticle = await fixSpaceKeywords(processedArticle);
  
  // ステップ2: ノウハウ記述を削除
  processedArticle = await removeHowToContent(processedArticle);
  
  return processedArticle;
}

/**
 * ステップ7: 品質チェック
 * コンテンツの品質とSEO基準のクリア確認
 */
export async function checkArticleQuality(
  article: string,
  seoCriteria: SEOCriteria,
  estimates?: {
    wordCount: number;
    h2Count: number;
    h3Count: number;
    keywordCounts: Record<string, number>;
  }
): Promise<{
  passed: boolean;
  wordCount: number;
  h2Count: number;
  h3Count: number;
  keywordCounts: Array<{ keyword: string; count: number; target: number }>;
  issues: string[];
}> {
  // 文字数カウント
  const wordCount = article.replace(/[#\s]/g, '').length;

  // H2/H3カウント
  const h2Count = (article.match(/^## /gm) || []).length;
  const h3Count = (article.match(/^### /gm) || []).length;

  // 正規表現の特殊文字をエスケープ
  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
  
  // キーワード出現回数カウント
  const keywordCounts = seoCriteria.targetKeywords.map(k => {
    // キーワードをスペースで分割
    const terms = k.keyword.split(/\s+/).filter(t => t.length > 0);
    
    if (terms.length === 0) {
      return { keyword: k.keyword, count: 0, target: k.minCount };
    }

    // 各単語の間に0-10文字の任意の文字（改行以外）を許容する正規表現を作成
    // 例: "動画編集 副業" -> /動画編集.{0,10}副業/gi
    const regexPattern = terms.map(t => escapeRegExp(t)).join('.{0,10}');
    const regex = new RegExp(regexPattern, 'gi');
    
    const matches = article.match(regex);
    return {
      keyword: k.keyword,
      count: matches ? matches.length : 0,
      target: k.minCount
    };
  });

  // 「あなた」チェック
  const hasAnata = article.includes('あなた');

  // 水平線・点線・装飾記号の検出
  const horizontalLinePatterns = [
    /^---+$/gm,  // Markdown水平線
    /^━━━+$/gm,  // 点線
    /^===+$/gm,  // 装飾記号
    /^\*\*\*+$/gm,  // 装飾記号
  ];
  const horizontalLineMatches = horizontalLinePatterns.flatMap(pattern => 
    article.match(pattern) || []
  );
  const hasHorizontalLines = horizontalLineMatches.length > 0;

  // キーワード羅列の検出（「**キーワードA**、**キーワードB**」パターン）
  const keywordListPattern = /\*\*[^*]+\*\*、\*\*[^*]+\*\*/g;
  const keywordListMatches = article.match(keywordListPattern) || [];
  const hasKeywordListing = keywordListMatches.length > 0;

  // 問題点の収集
  const issues: string[] = [];
  
  if (hasHorizontalLines) {
    issues.push(`水平線・点線・装飾記号が${horizontalLineMatches.length}個含まれています（削除してください）`);
  }
  
  if (hasKeywordListing) {
    issues.push(`キーワード羅列が${keywordListMatches.length}箇所検出されました（ブラックハットSEOリスク）`);
  }
  
  if (hasAnata) {
    issues.push('「あなた」という直接話法が含まれています（禁止）');
  }
  
  if (wordCount < seoCriteria.targetWordCount * 0.8) {
    issues.push(`文字数が目標の80%未満です（${wordCount}/${seoCriteria.targetWordCount}文字）`);
  }
  
  if (h2Count < seoCriteria.targetH2Count) {
    issues.push(`H2見出しが不足しています（${h2Count}/${seoCriteria.targetH2Count}個）`);
  }
  
  if (h3Count < seoCriteria.targetH3Count) {
    issues.push(`H3見出しが不足しています（${h3Count}/${seoCriteria.targetH3Count}個）`);
  }
  
  keywordCounts.forEach(kc => {
    if (kc.count < kc.target) {
      issues.push(`キーワード「${kc.keyword}」が不足しています（${kc.count}/${kc.target}回）`);
    }
  });

  // 予想との比較（もし提供されていれば）
  if (estimates) {
    if (wordCount < estimates.wordCount * 0.9) {
      issues.push(`文字数が構成段階の予想を大きく下回っています（予想: ${estimates.wordCount}, 実績: ${wordCount}）`);
    }
    if (h2Count < estimates.h2Count) {
      issues.push(`H2数が構成段階の予想を下回っています（予想: ${estimates.h2Count}, 実績: ${h2Count}）`);
    }
    if (h3Count < estimates.h3Count) {
      issues.push(`H3数が構成段階の予想を下回っています（予想: ${estimates.h3Count}, 実績: ${h3Count}）`);
    }
  }

  const passed = issues.length === 0;

  return {
    passed,
    wordCount,
    h2Count,
    h3Count,
    keywordCounts,
    issues
  };
}

/**
 * メイン処理: SEO記事生成の8ステップを実行
 */
export async function generateFullSEOArticle(
  request: SEOArticleRequest,
  authorName: string = "赤原",
  targetWordCount: number = 20000
): Promise<{
  article: string;
  quality: Awaited<ReturnType<typeof checkArticleQuality>>;
  seoCriteria: SEOCriteria;
}> {
  console.log('[SEO記事生成] ステップ1.5: 結論キーワードと集客源キーワードの切り分け');
  const { conclusionKeywords, trafficKeywords } = await separateKeywords(request.theme);
  console.log(`[SEO記事生成] 結論キーワード: ${conclusionKeywords.join(', ')}`);
  console.log(`[SEO記事生成] 集客源キーワード: ${trafficKeywords.join(', ')}`);

  console.log('[SEO記事生成] ステップ2: 検索ワード想定');
  const searchKeywords = await generateSearchKeywords(trafficKeywords);
  console.log(`[SEO記事生成] 検索ワード: ${searchKeywords.join(', ')}`);

  console.log('[SEO記事生成] ステップ2.5: ペルソナ生成');
  const targetPersona = await generateTargetPersona(request.theme, request.theme); // Simplified
  const writerPersona = await generateWriterPersona();
  const editorPersona = await generateEditorPersona();
  const generatedPersonas: GeneratedPersonas = {
    target: targetPersona,
    writer: writerPersona,
    editor: editorPersona
  };

  console.log('[SEO記事生成] ステップ3: 上位10記事の分析');
  const allAnalyses: ArticleAnalysis[] = [];
  for (const keyword of searchKeywords) {
    const analyses = await analyzeTopArticles(keyword, trafficKeywords);
    allAnalyses.push(...analyses);
  }
  console.log(`[SEO記事生成] 分析完了: ${allAnalyses.length}記事`);

  console.log('[SEO記事生成] ステップ3.5: 読者の痛み・報われない希望を収集');
  const allPainPoints: string[] = [];
  for (const keyword of searchKeywords) {
    const keywordAnalyses = allAnalyses.filter(a => 
      a.keywordOccurrences.some(ko => ko.keyword === keyword)
    );
    if (keywordAnalyses.length > 0) {
      const { painPoints } = await extractPainPoints(keyword, keywordAnalyses);
      allPainPoints.push(...painPoints);
    }
  }
  console.log(`[SEO記事生成] 読者の痛み: ${allPainPoints.length}個`);

  console.log('[SEO記事生成] ステップ3.6: 苦労したエピソードに繋げやすいキーワードを生成');
  const { storyKeywords } = await generateStoryKeywords(allPainPoints, trafficKeywords, authorName);
  console.log(`[SEO記事生成] 苦労話: ${storyKeywords.length}個`);

  console.log('[SEO記事生成] ステップ3.7: オファーへの橋渡しを生成');
  const { offerBridge } = await generateOfferBridge(allPainPoints, storyKeywords, conclusionKeywords, authorName);
  console.log(`[SEO記事生成] 橋渡し: ${offerBridge.length}個`);

  console.log('[SEO記事生成] ステップ4: SEO基準作成');
  const seoCriteria = createSEOCriteria(allAnalyses, targetWordCount);
  console.log(`[SEO記事生成] SEO基準: 文字数${seoCriteria.targetWordCount}, H2:${seoCriteria.targetH2Count}, H3:${seoCriteria.targetH3Count}`);

  console.log('[SEO記事生成] ステップ5: 記事構成作成');
  const structureResult = await createArticleStructure(
    request.theme,
    seoCriteria,
    request.ragContext,
    authorName,
    allPainPoints,
    storyKeywords,
    offerBridge,
    conclusionKeywords,
    generatedPersonas
  );
  const structure = structureResult.structure;
  console.log('[SEO記事生成] 構成作成完了');

  console.log('[SEO記事生成] ステップ6: 記事生成');
  const article = await generateSEOArticle(structure, seoCriteria, request.ragContext, authorName, conclusionKeywords);
  console.log('[SEO記事生成] 記事生成完了');

  console.log('[SEO記事生成] ステップ7: 品質チェック');
  const quality = await checkArticleQuality(article, seoCriteria);
  console.log(`[SEO記事生成] 品質チェック完了: ${quality.passed ? '合格' : '不合格'}`);
  if (!quality.passed) {
    console.log('[SEO記事生成] 問題点:', quality.issues);
  }

  return {
    article,
    quality,
    seoCriteria
  };
}
/**
 * ペルソナを用いた記事の品質チェックと修正（構成作家チェック -> 赤原修正 -> 確認）
 */
export async function refineArticleWithPersonas(
  article: string,
  personas: GeneratedPersonas,
  seoCriteria: SEOCriteria,
  painPoints: string[]
): Promise<string> {
  console.log('[refineArticleWithPersonas] Starting persona-based refinement...');

  console.log(`[refineArticleWithPersonas] Switching to Chunked Refinement for stability.`);
    
  const sections = parseStructure(article);
  let refinedArticle = "";
  
  // タイトル（H1）があれば最初に追加（リライト対象外）
  const titleMatch = article.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    refinedArticle += `# ${titleMatch[1]}\n\n`;
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    // Skip empty sections
    if (!section.title && !section.content.trim()) continue;

    const sectionText = section.title ? `${section.title}\n${section.content}` : section.content;
    console.log(`[refineArticleWithPersonas] Refining section ${i + 1}/${sections.length}...`);

    // 優先キーワード（出現回数が多い上位5つ）を抽出
    const priorityKeywords = seoCriteria.targetKeywords
      .sort((a, b) => b.minCount - a.minCount)
      .slice(0, 5)
      .map(k => k.keyword)
      .join(', ');

    // 1. 読者ペルソナによるチェック（セクション単位＋全体整合性）
    // 過去の文脈を要約して渡す（トークン節約のため、直近のセクションと、それ以前の要約を渡すのが理想だが、
    // ここでは簡易的に「これまでの構成タイトル」と「直前のセクション」を渡す）
    
    const previousTitles = sections.slice(0, i).map(s => s.title).join('\n');
    const nextTitles = sections.slice(i + 1).map(s => s.title).join('\n');
    
    // 直前のセクションの本文（最大1000文字）を取得して文脈とする
    const previousContext = refinedArticle.slice(-1000);

    const editorCheckPrompt = `
あなたは「利己的で短気な読者（ペルソナ）」です。
以下の記事セクションを読んで、**「自分の役に立つか？」「読み進めたいと思うか？」**を厳しく判定してください。
また、**「前の章と同じことを言っていないか（重複）」**も厳しくチェックしてください。

【あなたの特徴】
- 悩み：${painPoints.join('、')}
- 性格：自分勝手、結論を急ぐ、説教されるのが嫌い、難しい話（ノウハウ）は大嫌い
- 状態：労働収入の罠にハマっているが、自分では気づいていない

【記事の全体構成（現在地：${i + 1}/${sections.length}）】
[済] ${previousTitles}
[今] ${section.title}
[未] ${nextTitles}

【直前の文脈（ここから繋がっている）】
...${previousContext}

【チェック対象セクション】
${sectionText}

【判定基準（違反があれば即修正指示）】
1. **重複の徹底排除（最重要）**
   - 「これ、さっきも聞いたぞ？」と思ったら即アウト。
   - 特に「導入部」で話したことを第1章で繰り返していたら即削除。

2. **「ノウハウ・勉強」の禁止（絶対）**
   - 「ステップメールとは」「仕組みとは」みたいな**機能説明**があったら、「難しそうだから読みたくない」と拒絶しろ。
   - 「勉強が必要です」「努力が必要です」と言われたら、「じゃあいいや」と拒絶しろ。
   - **「テンプレート」という言葉があったら、「安っぽい」と吐き捨てろ。**

3. **口調警察（絶対遵守）**
   - **「お前」** → 「あなた」に直せ。
   - **「〜だ・〜である」** → 「〜です・〜ます」に直せ。
   - ただし、態度は「上から目線」「毒舌」を維持しろ。単なるいい子ちゃん言葉はNG。

4. **「先生ヅラ」していないか？**
   - 「〜について解説します」「〜を学びましょう」なんて言われたら、俺は即座にブラウザを閉じる。
   - 「教える」のではなく、「業界の嘘を暴く」「俺の失敗の原因を言い当てる」スタンスになっているか？

5. **「俺のメリット」があるか？**
   - 筆者の苦労話ばかりで、俺に何の得があるのか不明ではないか？
   - 「これを読めば（やれば）楽になれる」という**救い**が提示されているか？

【判定出力形式】
問題がない場合:
修正なし

問題がある場合（該当する問題点のみ列挙せよ）:
[問題点1]
箇所: "..."（問題のある具体的な文言を引用）
理由: 重複している / ノウハウを語っている / 口調が変 / テンプレートと言っている
指示: 削除せよ / "..."という表現に書き換えろ

[問題点2]
...
`;

    const checkResponse = await invokeLLM({
      messages: [{ role: "user", content: editorCheckPrompt }]
    });
    
    const checkResult = typeof checkResponse.choices[0].message.content === 'string' 
      ? checkResponse.choices[0].message.content 
      : "";

    if (checkResult.includes("修正なし")) {
      refinedArticle += sectionText + "\n\n";
      continue;
    }

    // 2. 赤原による修正（セクション単位）
    // 重要: ここで personas.writer.description (RAG Voice Samples) を渡さないと、
    // LLMは「赤原の口調」を忘れてしまい、一般的な丁寧語やカタコトになってしまう。
    const writerFixPrompt = `
あなたは「${personas.writer.name}」です。
以下の「赤原の思考OS」と「口調サンプル」を完全にインストールしています。

${personas.writer.description}

読者（ペルソナ）から以下の指摘を受けました。

【読者の指摘】
${checkResult}

【優先SEOキーワード（必ず含めること）】
${priorityKeywords}

【修正対象セクション本文】
${section.content}

【指示】
元のセクションをベースに、**指摘された箇所のみ**を修正した新しいセクションを作成してください。
指摘されていない部分は、元の表現（赤原スタイル）を極力維持してください。
ただし、修正箇所と前後の文脈が自然につながるように調整してください。

【禁止事項（再確認）】
- ノウハウ（機能説明）は書かない
- テンプレートという言葉は使わない
- 努力・勉強を強要しない
- 「お前」は使わず「あなた」を使う
- 「〜だ・〜である」ではなく「〜です・〜ます」を使う（ただし毒舌・断定は維持）

【出力形式】
修正後の**本文のみ**を出力してください（見出しやコードブロックは不要）。
`;


    const fixResponse = await invokeLLM({
      messages: [{ role: "user", content: writerFixPrompt }]
    });

    const fixedContent = typeof fixResponse.choices[0].message.content === 'string'
      ? fixResponse.choices[0].message.content
      : "";
      
    if (!fixedContent) {
      console.error('[refineArticleWithPersonas] Failed to generate fixed article for section. Reverting to original section.');
      refinedArticle += sectionText + "\n\n";
      continue;
    }

    // 安全装置: 修正後の文章が極端に短い（元の50%未満）場合は、途切れとみなして元に戻す
    if (fixedContent.length < section.content.length * 0.5) {
      console.warn(`[refineArticleWithPersonas] Fixed content for section is too short (${fixedContent.length} chars vs ${section.content.length} chars). Discarding fix to prevent truncation.`);
      refinedArticle += sectionText + "\n\n";
    } else {
      // 見出しを復元して追加（必ず改行を2つ入れる）
      // 正規表現で末尾の改行を確認し、不足していれば追加する
      const cleanFixedContent = fixedContent.trim();
      refinedArticle += section.title ? `\n\n${section.title}\n${cleanFixedContent}\n\n` : `${cleanFixedContent}\n\n`;
    }
  }

  return refinedArticle;
}


/**
 * ステップ3.8: 赤原ロジック（A-H）の生成
 * 
 * 市場の破綻の構図（A-H）を明確に定義する。
 * H（本質的改善策）は必ず「資産形成力（仕組み化）」に帰結させる。
 */
export async function generateAkaharaLogic(
  theme: string,
  painPoints: string[],
  trafficKeywords: string[],
  conclusionKeywords: string[],
  remarks?: string
): Promise<{
  A: string; // 表面的解決策
  B: string; // 相手の動機
  C: string; // 販売者の宣伝文句
  D: string; // 市場の顧客の問題
  E: string; // 市場の問題点
  F: string; // 販売者の問題点
  G: string; // 市場の歪み・問題点
  H: string; // 本質的改善策
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたは市場分析のプロフェッショナルです。
以下のテーマについて、「市場の破綻の構図（A〜H）」を定義してください。

【重要：思考プロセス】
以下の「2つの参考事例」から共通する**「論理構造（フレームワーク）」**を抽出し、**今回指定されたテーマ**に当てはめてA〜Hを定義してください。

**【共通する論理構造（A〜Hの定義）】**
*   **A（表面的解決策）**: その市場で流行っている、誰もが飛びつく安易なノウハウ。
*   **B（相手の動機）**: 顧客がそれを求める動機。多くの場合「楽したい」「現状から逃げたい」という安易な欲求。
*   **C（販売者の宣伝文句）**: Bの欲求を刺激する甘い言葉。「誰でも」「簡単に」「すぐに」など。
*   **D（市場の顧客の問題）**: 顧客自身が抱える本質的な欠陥。努力を嫌う、思考停止、依存心など。
*   **E（市場の問題点）**: Dの欠陥を見透かした上で、本質的解決ではなく「その場しのぎ」を高額で売っていること。
*   **F（販売者の問題点）**: なぜEのようなことをするのか？ それは販売者自身が**「ただのコピービジネス」**であり、本質を語る能力がない、あるいは**「保身（売れればいい）」**に走っているからである。
*   **G（市場の歪み）**: その市場では「本質的な力（H）」が提供されず、消費者が永遠に搾取される構造になっていること。
*   **H（本質的改善策）**: その業界・その市場が語らない、むしろ隠されていると言っても過言ではない、その業界での最大幸福を得るための**「本質的な力（一生モノの力）」**を定義する。
    *   英語市場なら「洞察力」が本質。
    *   稼ぐ系市場なら「仕組み化」が本質。
    *   **A〜Gの全ては、この「本質的な力」から目を背けた結果として起こっている。**
    *   業界は読者が目を背けていることをいいことに、つけ上がっている。これを全て暴き、本当の解決策（H）を提示するのが赤原スタイルである。

【参考事例1：英語市場】
A）表面的解決策：単語、フレーズ、文法、暗記
B）相手の動機：サラリーマンで昇進するため、就職のため
C）販売者の宣伝文句：「単語を覚えてペラペラになろう」
D）市場の顧客の問題：本質的には外国人と仲良くなりたいわけじゃない。
E）市場の問題点：対人関係の問題なのに「記憶術」を売っている。
F）販売者の問題点：保身。コピービジネス。
G）市場の歪み：「頭が真っ白になる」人への本質的解決策（資産）がない。
H）本質的改善策：**「洞察力」（興味がない人とも仲良くなれる力＝一生モノの力）**

【参考事例2：動画編集・SNSマーケ市場】
A）表面的解決策：案件をこなす単純作業
B）相手の動機：人生が辛い、楽したい
C）販売者の宣伝文句：「動画編集で稼ごう、自由になろう」
D）市場の顧客の問題：努力したくない、思考停止。
E）市場の問題点：労働案件（飼い殺し）を高額で売っている。
F）販売者の問題点：デスレースを是としている。
G）市場の歪み：「資産形成力（未来を担保する力）」がない。
H）本質的改善策：**「仕組み化」（自分の人生を担保する力＝一生モノの力）**

【指示】
上記の構造を応用し、**今回指定されたテーマ**におけるA〜Hを定義してください。
**Hは、その業界が隠している「本質的な力（一生モノの力）」を定義してください。**

**【重要：備考欄の反映】**
ユーザーからの備考欄（remarks）に、H（解決策）に関する指示がある場合は、**それを最優先で反映してください。**

以下のJSON形式で返してください：
{
  "A": "...",
  "B": "...",
  "C": "...",
  "D": "...",
  "E": "...",
  "F": "...",
  "G": "...",
  "H": "..."
}`
      },
      {
        role: "user",
        content: `テーマ: ${theme}
集客源キーワード: ${trafficKeywords.join(', ')}
読者の悩み: ${painPoints.join(', ')}
備考: ${remarks || 'なし'}

このテーマにおける市場の破綻の構図（A〜H）を作成してください。`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "akahara_logic_generation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            A: { type: "string" },
            B: { type: "string" },
            C: { type: "string" },
            D: { type: "string" },
            E: { type: "string" },
            F: { type: "string" },
            G: { type: "string" },
            H: { type: "string" }
          },
          required: ["A", "B", "C", "D", "E", "F", "G", "H"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0].message.content as string;
  const result = JSON.parse(content);
  return result;
}

function parseStructure(md: string) {
  const lines = md.split('\n');
  const sections: { title: string; content: string }[] = [];
  let currentTitle = '';
  let currentContent: string[] = [];

  const h2Regex = /^\s*##\s+(.+)$/;

  for (const line of lines) {
    const match = line.match(h2Regex);
    if (match) {
      // Push previous section (Intro or H2)
      if (currentContent.length > 0 || currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join('\n') });
      }
      currentTitle = line.trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  // Push last section
  if (currentContent.length > 0 || currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join('\n') });
  }
  return sections;
}
