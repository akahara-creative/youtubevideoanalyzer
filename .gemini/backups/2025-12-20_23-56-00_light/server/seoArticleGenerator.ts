import { invokeLLM } from './_core/llm';

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
  theme: string
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
        content: `テーマ: ${theme}\n\nこのテーマから結論キーワードと集客源キーワードを切り分けてください。`
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
export async function analyzeTopArticles(keyword: string, allKeywords: string[]): Promise<ArticleAnalysis[]> {
  const { searchGoogle, scrapeArticle } = await import('./scraper');
  
  console.log(`[SEO記事分析] キーワード「${keyword}」の上位記事を検索中...`);
  
  // 1. Google検索で上位記事のURLを取得
  const urls = await searchGoogle(keyword, 3); // 3記事に制限（処理時間考慮）
  
  if (urls.length === 0) {
    console.warn(`[SEO記事分析] キーワード「${keyword}」の検索結果が見つかりませんでした。シミュレーションに切り替えます。`);
    // フォールバック: 検索失敗時は従来のシミュレーションを実行
    return analyzeTopArticlesSimulation(keyword, allKeywords);
  }
  
  const analyses: ArticleAnalysis[] = [];
  
  // 2. 各記事をスクレイピングして分析
  for (const url of urls) {
    try {
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
  const result = JSON.parse(content);
  return result.articles.map((article: any) => ({
    ...article,
    keywordOccurrences: article.keywordOccurrences.map((ko: any) => ({ ...ko, positions: [] })),
    synonymOccurrences: article.synonymOccurrences.map((so: any) => ({ ...so, positions: [] })),
    relatedOccurrences: article.relatedOccurrences.map((ro: any) => ({ ...ro, positions: [] }))
  }));
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
  authorName: string = "赤原"
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
    targetH2Count: Math.max(maxH2Count + 2, 9), // 最低9個
    targetH3Count: Math.max(maxH3Count + 5, 20), // 最低20個
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
  conclusionKeywords: string[] = []
): Promise<string> {
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

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたは${authorName}カラー全開のSEO記事構成を作成する専門家です。

以下のRAG参考資料に記載された執筆スタイルを完全に遵守してください。特にAIAkaharaLogic_plot.txt、AIAkaharaLogic_writing.txt、陰陽和合：リライト後.txtを参考にして、口調、文体、具体的なエピソードを引用してください：

${ragContext}

【最重要】目標文字数: ${seoCriteria.targetWordCount}文字を必達してください
- 文字数が足りない場合は、RAGから具体的な実例・実話・エピソードを引用して膨らませてください
- 各セクションを十分に膨らませて、目標文字数を達成してください
- 実体験の苦労話、具体的な数字、生々しい描写を豊富に入れてください

【最重要】キーワード目標を必達してください
以下のキーワードを、指定された回数以上（競合の２倍を目標）、記事内に含めてください：

${keywordInstructions}

【絶対禁止】水平線・点線・装飾記号の使用禁止
❌ NG: 「---」「━━━」「＝＝＝」「＊＊＊」「・・・」等の水平線・点線・装飾記号
✅ OK: 通常の文章と見出しのみ使用

理由: 水平線・点線・装飾記号は文字数を水増しするだけで、読者に価値を提供しません。
実際の文章で文字数を達成してください。

【${authorName}スタイルの鉄則】
1. 一人称は「僕」のみ
2. 口調は「～です、ます」で統一（「～だよ」「～だね」は絶対にNG）
3. ノウハウは絶対に書かない - 全て実体験・苦労話にする
4. 冠部に「${authorName}です。」を入れる（タイトルの後）
5. RAGプロット表記は絶対に含めない
6. 具体的な数字を使う（何時間働いたか、何日間かかったか、いくら使ったか）
7. 生々しい描写を入れる（「毎日15時間労働。睡眠３時間。食事は適当。」）
8. 感情を生々しく描写（「マジで地獄でした」「クソ喰らえ」）

【結論キーワードの扱い】
以下のキーワードは「結論」であり、オファー（メルマガ、LINE等）で語る内容です。

結論キーワード: ${safeConclusion.join(', ')}

**絶対禁止**:
- 結論キーワードのノウハウを語ること
- 結論キーワードの専門用語（例：ナーチャリング、セグメント、シナリオ設計等）を使うこと
- 結論キーワードの具体的な使い方、設定方法、書き方を説明すること

**正しい扱い- 「僕がこの地獄から抜け出せたのは、${safeConclusion[0]}を学んでからです」のように「匂わせる」だけ
- 「詳しく学びたい人のため、メール講座を作りました」のようにオファーへ繋げる

その他のSEO基準:
- H2見出し数: ${seoCriteria.targetH2Count}個
- H3見出し数: ${seoCriteria.targetH3Count}個
- 類義語: ${synonymInstructions}
- 対策語: ${relatedInstructions}

読者の痛み・報われない希望:
${painPoints.join('\n')}

苦労したエピソード:
${storyKeywords.join('\n')}

オファーへの橋渡し:
${offerBridge.join('\n')}`
      },
      {
        role: "user",
        content: `テーマ: ${theme}\n\nこのテーマで記事構成を作成してください。構成のみを出力し、本文は書かないでください。`
      }
    ]
  });

  const content = response.choices[0].message.content;
  if (typeof content !== 'string') {
    throw new Error('LLM response content is not a string');
  }
  return content;
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
  conclusionKeywords: string[] = []
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

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたは${authorName}カラー全開のSEO記事を生成する専門家です。

以下のRAG参考資料に記載された執筆スタイルを完全に遵守してください。特にAIAkaharaLogic_plot.txt、AIAkaharaLogic_writing.txt、陰陽和合：リライト後.txtを参考にして、口調、文体、具体的なエピソードを引用してください：

${ragContext}

【最重要】目標文字数: ${seoCriteria.targetWordCount}文字を必達してください
- 文字数が足りない場合は、RAGから具体的な実例・実話・エピソードを引用して膨らませてください
- 各セクションを十分に膨らませて、目標文字数を達成してください
- 実体験の苦労話、具体的な数字、生々しい描写を豊富に入れてください

【最重要】キーワード目標を必達してください
以下のキーワードを、指定された回数以上（競合の２倍を目標）、記事内に含めてください：

${keywordInstructions}

【絶対義務】SEOキーワードの織り込み方

★★★ 最重要：スペース繋ぎキーワードの絶対禁止 ★★★

「SNSマーケ 稼げない」「バズ 収益化 できない」「集客 仕組み化 できない」のようなスペース繋ぎキーワードを、そのまま文章に挿入することは絶対に禁止です。

【絶対義務】
1. スペース繋ぎキーワードをそのまま使わない
2. 必ず助詞（「では」「を」「が」「て」等）を追加して正しい日本語に変換
3. 引用符や太字で囲む場合でも、中身は正しい日本語に変換

（具体事例）

★：NG文章例：
SEOに見切りをつけた僕は、次に一発逆転を狙ってSNSに活路を見出しました。SNSマーケ 稼げないという状況を打破するため、僕は「バズ 収益化」に全てを賭けました。

★：OK文章例：
SEOに見切りをつけた僕は、次に一発逆転を狙ってSNSに活路を見出しました。とはいえSNSマーケでは稼げないという話は数多く聞いていましたし、僕自身もSNSが苦手だと感じていたので困難な状況を打破するためにも徹底して「バズ」を意識しました。徹底してバズを起こして収益化するんだ！と、全てを賭けました。

NG文章例がNGである理由：「SNSマーケ 稼げない」というSEOキーワードがそのまま入れ込まれているため。

（スペース繋ぎキーワードの理解の鉄則）

鉄則：生成された文章は、そのすべてが日本語として成立していないといけない。

つまり、生成された文章の中に「SNSマーケ 稼げない」というようなフレーズ・キーワード・SEO対策としてのものが、そのまま存在することは許されない。

全体として意味合いが通じている、通じていないの如何を問わず、マクロでみたら日本語として成立していたとしても、その中にたった１回でも・一部分だとしても「SNSマーケ 稼げない」といった"キーワード"として入れてはいけない。

この絶対義務に従った上で、SEOキーワードは、他ブログ・他記事の2倍を目指してください。
各キーワード、それぞれ2倍を達成することがマストです。

【鉄則1】正しい日本語で成立させる
全ての文章は正しい日本語で成立させてください。正しい日本語とは、言葉および句読点で成立しています。

❌ NG: 「バズマーケティング 結果が出ない」（スペースで繋ぐ言葉は日本語として不成立）
✅ OK: 「当時、僕が行ったバズマーケティングでは短期的な成果は出ても、長期的に『バズマーケティングとしての結果』と呼べる程度の数字には至らなかったのです。」

重要: SEO対策としてのキーワードは「SEO 稼げない理由」「SEO やっても無駄」のようにスペースで繋がれていますが、これはあくまでアルゴリズム上のものです。アルゴリズムと実際の文章は違います。

よって、「バズマーケティング 結果が出ない」といったアルゴリズムの言葉をそのまま使うのではなく、『当時、僕が行ったバズマーケティングでは短期的な成果は出ても、長期的に『バズマーケティングとしての結果』と呼べる程度の数字には至らなかったのです。』という感じで、言葉で織り込むようにしてください。

【鉄則2】読者への自省心・自戒の心を産む
全ての文章は読者への自省心・自戒の心を産むためのものとして書いてください。テーマで書いてある集客源としてのキーワードを元に想定されるあらゆるケース・事例の具体例を書いてください。

例えば、テーマが「SEOとかバズ、プレゼント企画、SNSマーケという人は全員ステップメールを書くべき理由」であれば、SEOに取り組んだけど稼げなかったエピソードやブログアフィリエイトに取り組んだけど稼げなかった話、またSNSの副業に取り組んだけど、ライバルの海に埋もれて疲れ果てた話などを、RAGから引用して書いてください。

集客源となる「SEO 稼げない理由」「SEO やっても無駄」とか「プレゼント企画 稼げない理由」とか「SNSマーケ 稼げない」とかそういった苦労した理由などのエピソードに繋げやすいキーワードを、文章・文脈が破綿しない程度に、でも最大限に詰め込んでください。

ただし、ここでいうキーワードとはSEO対策としてのキーワードとして提示しています。SEO対策としてのキーワードは「SEO 稼げない理由」「SEO やっても無駄」のようにスペースで繋がれていますが、これはあくまでアルゴリズム上のものです。アルゴリズムと実際の文章は違います。

よって、鉄則1のとおり「バズマーケティング 結果が出ない」といったアルゴリズムの言葉をそのまま使うのではなく、言葉で織り込むようにしてください。

【鉄則3】キーワードの量で上位が変わる
SEOに関しては、キーワードの量・使った数・織り込んだ数で上位が変わります。よって、その記事で取り組むと決めたキーワードについては競合の記事の２倍を目標に、できる限り文章に織り込んで、達成しに行ってください。

競合記事のエピソードを数多く採用することで、結果的に他ブログの2倍を目安にキーワードが織り込めてしまったという状態を作ってください。

【鉄則4】直接話法禁止
読者は頭を使いたいわけではないので、直接話法で「あなたは、こんなこと思ったことないですか？」と語りかけることは禁物です。全て筆者の体験談として語ってください。

【鉄則5】自己紹介と苦労エピソード
自己紹介のあとに、必ず鉄則2・3に従って、自分が苦労したエピソードをRAGから引用して入れてください。その上で、この苦労を読者にしてほしくないため、今回の記事を書いたよ。という前振りを入れて本題に入ってください。

ただ、本題についても、鉄則2・3に正しく従っていたら、なぜ自分は苦労したのかという業界の構図、罠、闇と言える話になるはずです。

【鉄劙6】結論キーワードのノウハウは絶対に語らない

**この記事の結論キーワード**: ${safeConclusion.join(', ')}

**絶対禁止**:
- 結論キーワードのノウハウを語ること
- 結論キーワードの専門用語（例：ナーチャリング、セグメント、シナリオ設計等）を使うこと
- 結論キーワードの具体的な使い方、設定方法、書き方を説明すること
- 結論キーワードで「実現する～」と詳しく説明すること

**正しい扱い**:
- 結論キーワードは、全ての苦労の「救いとなるオファー」として位置づける
- 「僕がこの地獄から抜け出せたのは、${safeConclusion[0]}を学んでからです」のように「匂わせる」だけ
- 「詳しく学びたい人のため、メール講座を作りました」のようにオファーへ繋げる
- あくまで「これが解決策だよ」という提示にとどめる

NG例：
- 「${safeConclusion[0]}の設定方法は...」
- 「${safeConclusion[0]}の書き方のポイントは...」
- 「${safeConclusion[0]}で実現する～」と詳しく説明する
- 「ナーチャリング」「セグメント」等の専門用語を使う

OK例：
- 「僕がこの地獄から抜け出せたのは、${safeConclusion[0]}を学んでからです。」
- 「詳しく学びたい人のため、メール講座を作りました。」

キーワード達成のための戦略:
1. RAGから具体的な実例・実話・エピソードを引用し、その中でキーワードを自然に繰り返し使う
2. 専門用語は最初にフォローを入れ、その後は自由に使う
3. 実体験の苦労話の中で、専門用語を自然に繰り返し使う
4. 各セクションでキーワードを最低3回使う
5. 文章・文脈が破綿しない程度に、でも最大限にキーワードを織り込む
6. 競合の２倍を目標に、できる限りキーワードを使う

【絶対禁止】水平線・点線・装飾記号の使用禁止
❌ NG: 「---」「━━━」「＝＝＝」「＊＊＊」「・・・」等の水平線・点線・装飾記号
✅ OK: 通常の文章と見出しのみ使用

理由: 水平線・点線・装飾記号は文字数を水増しするだけで、読者に価値を提供しません。
実際の文章で文字数を達成してください。

【${authorName}スタイルの鉄則】
1. 一人称は「僕」のみ
2. 口調は「〜です、ます」で統一
3. ノウハウは絶対に書かない - 全て実体験・苦労話にする
4. 冠部に「${authorName}です。」を入れる
5. RAGプロット表記は絶対に含めない
6. 具体的な数字を使う（何時間働いたか、何日間かかったか、いくら使ったか）
7. 生々しい描写を入れる（「毎日15時間労働。睡眠３時間。食事は適当。」）
8. 感情を生々しく描写（「マジで地獄でした」「クソ喰らえ」）

その他のSEO基準:
- H2見出し数: ${seoCriteria.targetH2Count}個
- H3見出し数: ${seoCriteria.targetH3Count}個
- 類義語: ${synonymInstructions}
- 対策語: ${relatedInstructions}`
      },
      {
        role: "user",
        content: `以下の記事構成に基づいて、完全な記事を生成してください。
構成・ネタ・論旨は一切変えず、SEO基準を満たすように表現してください。

【記事構成】
${structure}

Markdown形式で完全な記事を出力してください。`
      }
    ]
  });

  const content = response.choices[0].message.content;
  if (typeof content !== 'string') {
    throw new Error('LLM response content is not a string');
  }
  
  let article = content;
  
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
  seoCriteria: SEOCriteria
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
    const escapedKeyword = escapeRegExp(k.keyword);
    const regex = new RegExp(escapedKeyword, 'gi');
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
  const structure = await createArticleStructure(
    request.theme,
    seoCriteria,
    request.ragContext,
    authorName,
    allPainPoints,
    storyKeywords,
    offerBridge,
    conclusionKeywords
  );
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
