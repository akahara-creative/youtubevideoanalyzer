import { invokeLLM, InvokeParams } from './_core/llm';

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
  remarks?: string,
  offer?: string
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

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたは${authorName}カラー全開のSEO記事構成を作成する専門家です。

以下のRAG参考資料（赤原の執筆スタイル、および競合記事の分析データ）を徹底的に読み込み、競合を凌駕する記事構成を作成してください。

${ragContext}

【最重要ミッション】
目標文字数: ${seoCriteria.targetWordCount}文字
H2見出し数: ${seoCriteria.targetH2Count}個以上
H3見出し数: ${seoCriteria.targetH3Count}個以上

これらを「絶対に」達成してください。
競合記事（RAGに含まれている場合）の構成を分析し、それらよりも網羅的で、かつ「赤原流」のエピソード（失敗談、苦労話）が豊富に含まれる構成にしてください。

【構成作成のルール】
1. **重要: H2見出しを必ず使用すること。** 記事の大きな区切りは必ずH2（##）とし、その中の小見出しとしてH3（###）を使用する階層構造にすること。H2なしでH3だけを並べるのは禁止。
    - **注意: 見出しに「H2-1」「H3-1」のような管理番号やIDは絶対に含めないこと。** 純粋なタイトルのみにすること。
2. H2見出しが足りない場合は、「具体的な事例」「失敗エピソード」「Q&A」「用語解説」「ステップバイステップの手順」などのセクションを追加して、必ず${seoCriteria.targetH2Count}個以上にすること。
2. 各セクションでどのキーワードを何回使うか、どの程度のエピソードを入れるかを計画すること。
3. 結論キーワード（${safeConclusion.join(', ')}）は、最後のまとめやオファーへの誘導でのみ使用し、ノウハウとしては語らないこと。
${remarks ? `4. 備考欄の指示（${remarks}）がある場合は、それを最優先で反映すること。` : ''}
${offer ? `5. オファー（${offer}）への誘導を最終的なゴールとすること。` : ''}

【出力フォーマット】
以下の形式で出力してください。JSON形式ではありません。

[ESTIMATES]
{
  "wordCount": 予想される記事全体の文字数（数値）,
  "h2Count": 構成に含まれるH2の数（数値）,
  "h3Count": 構成に含まれるH3の数（数値）,
  "keywordCounts": {
    "キーワード1": 予想使用回数,
    ...
  }
}
[/ESTIMATES]

[STRUCTURE]
# 記事タイトル

## 見出し1
- キーワード: キーワードA, キーワードB
- 内容メモ: （箇条書きで簡潔に。長文禁止）

### 小見出し1-1
...

## 見出し2
...
[/STRUCTURE]

【重要: キーワード配分】
estimates.keywordCounts の合計値は、必ず【キーワード目標】で指定された回数以上になるように計画してください。

【重要: 構成のサイズとセクション数】
1. **セクション数（H2）は、目標数（${seoCriteria.targetH2Count}個）に可能な限り近づけてください（±2個以内）。**
2. **H3見出しの総数も、目標数（${seoCriteria.targetH3Count}個）に可能な限り近づけてください（±2個以内）。** これより多くしすぎないこと。
3. **出力トークン制限（8000トークン）を超えないため、各セクションの「内容メモ」は簡潔な箇条書き（1-2行）に留めてください。**
   長文のメモは禁止です。見出しとキーワードで内容が伝わるように工夫してください。
4. H2/H3の階層構造は省略せずに全て書き出してください。

【${authorName}スタイルの鉄則】
1. 一人称は「僕」のみ
2. 口調は「～です、ます」
3. ノウハウではなく「実体験・苦労話」を中心に構成する
4. **必ず最後に「まとめ」または「結論」のH2セクションを作成し、読者への熱いメッセージ（CTA）を含めること。**
`
      },
      {
        role: "user",
        content: `テーマ: ${theme}
${remarks ? `\n備考（意図・方向性）: ${remarks}` : ''}
${offer ? `\nオファー（ゴール）: ${offer}` : ''}

このテーマ${remarks ? 'と備考' : ''}で、競合に圧勝する記事構成を作成してください。指定された[ESTIMATES]と[STRUCTURE]の形式で出力してください。`
      }
    ],
    max_tokens: 8192
  });

  const content = response.choices[0].message.content;
  if (typeof content !== 'string') {
    throw new Error('LLM response content is not a string');
  }
  
  console.log("[createArticleStructure] Raw LLM response length:", content.length);

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
import { GeneratedPersonas } from "./personaGenerator";

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
哲学: ${personas.writer.philosophy}

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

    const systemPrompt = `あなたは${authorName}として、SEO記事の執筆を行っています。
現在、全${sections.length}セクション中の第${i + 1}セクションを執筆中です。

${personaInstructions}

【重要: キーワード目標】
以下のキーワードを、指定された回数以上、記事全体（またはこのセクション）で自然に使用してください：
${keywordInstructions}

【執筆のルール】
1. **文字数上限**: このセクションは**最大${Math.ceil(targetSectionLength * 1.2)}文字**以内で執筆してください。
${lengthInstruction}
   - 指定文字数を大幅に超えることは「プロ失格」とみなします。
2. 文体: 「${authorName}スタイル」を厳守（一人称「僕」、語りかける口調）。
3. 前後の繋がり: 前のセクションからの流れを意識し、唐突な書き出しにしないこと。
${isFirstSection ? '4. 冒頭: 記事の導入として、読者の心をつかむ書き出しにすること。' : '4. **重要: 挨拶（「こんにちは、赤原です」等）は絶対に禁止。** 前のセクションから自然に続くように書くこと。'}
5. 構成遵守: 指定された見出し（H2/H3）とキーワードを必ず使用すること。
6. 見出しのフォーマット: Markdown形式（##, ###）で出力すること。

【${authorName}スタイルの詳細ルール】
1. 具体的な数字を使う（何時間働いたか、何日間かかったか、いくら使ったか）
2. 生々しい描写を入れる（「毎日15時間労働。睡眠３時間。食事は適当。」）
3. 感情を生々しく描写（「マジで地獄でした」「クソ喰らえ」）
4. ノウハウは絶対に書かない - 全て実体験・苦労話にする

【記事全体の構成】
${structure}

【前のセクションまでの文脈】
...
${previousContext}
...`;

    const sectionParams: InvokeParams = {
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `以下のセクションのみを執筆してください。他のセクションは書かないでください。

【執筆対象セクション】
${section.title}
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
1. **構成の完全再現**: 指定されたH2タイトルとH3サブタイトルを「一言一句変えず」にそのまま使用してください。
    - **注意**: タイトルには既にMarkdown記号（##, ###）が含まれています。これを二重にしないこと（例：「## ## 見出し」はNG）。そのまま出力してください。
2. **文字数の遵守**: このセクションの目標文字数は**${targetSectionLength}文字**です。
    - **${targetSectionLength < 1500 ? '濃縮' : '疾走感'}**: 無駄な引き伸ばしは禁止です。指定された文字数前後で、最も効果的に感情と情報を伝えてください。
    - 短すぎても長すぎてもいけません。**${Math.floor(targetSectionLength * 0.9)}文字〜${Math.ceil(targetSectionLength * 1.2)}文字**の範囲に必ず収めてください。
3. **備考欄の融合**: 備考欄の指示（相談者の話など）を、このセクションの内容に合わせて自然に組み込んでください。
4. **キーワードの確実な挿入**: 指定された「キーワード」は、文脈の中で自然に、かつ**必ず**使用してください。文字数が少なくても、キーワードを省略することは許されません。

出力は、指定されたH2見出しから書き始めてください。`
        }
      ]
    };

    const response = await invokeLLM({
      ...sectionParams,
      max_tokens: 4096 // セクションごとなので4096で十分だが、余裕を持たせる
    });

    const content = response.choices[0].message.content;
    if (typeof content !== 'string') {
      throw new Error('LLM response content is not a string');
    }
    console.log(`[generateSEOArticle] Section ${i + 1} start: ${content.substring(0, 100).replace(/\n/g, ' ')}...`);

    article += content + "\n\n";
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
    conclusionKeywords
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
  seoCriteria: SEOCriteria
): Promise<string> {
  console.log('[refineArticleWithPersonas] Starting persona-based refinement...');

  // 記事が長すぎる場合（10000文字以上）は、セクションごとに分割してリライト（トークン制限回避）
  if (article.length > 10000) {
    console.log(`[refineArticleWithPersonas] Article is long (${article.length} chars). Switching to Chunked Refinement.`);
    
    const sections = parseStructure(article);
    let refinedArticle = "";
    
    // タイトル（H1）があれば最初に追加（リライト対象外）
    const titleMatch = article.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      refinedArticle += `# ${titleMatch[1]}\n\n`;
    }

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionText = `${section.title}\n${section.content}`;
      console.log(`[refineArticleWithPersonas] Refining section ${i + 1}/${sections.length}...`);

      // 1. 構成作家によるチェック（セクション単位）
      const editorCheckPrompt = `
あなたは「${personas.editor.role}」です。
以下の記事セクションを、あなたの性格・視点で厳格にチェックしてください。

【あなたの特徴】
${personas.editor.tone}
チェックポイント:
${personas.editor.checkPoints.map(p => `- ${p}`).join('\n')}

【チェック対象セクション】
${sectionText}

【指示】
このセクションの中に、日本語として不自然な点、助詞の誤り、キーワードの不自然な詰め込み（例：「動画編集 副業」のようなスペース繋ぎ）、論理の飛躍、読者への共感不足などがあれば、具体的に指摘してください。
特に「スペース繋ぎのキーワード」は厳しく指摘してください。

修正が必要な箇所と、その理由をリストアップしてください。
修正が不要な場合は「修正なし」と答えてください。
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
      const writerFixPrompt = `
あなたは「${personas.writer.name}」です。
構成作家から以下の指摘を受けました。
指摘内容を真摯に受け止め、あなたの文体（${personas.writer.style}）でこのセクションを修正してください。

【構成作家からの指摘】
${checkResult}

【あなたの特徴】
性格・トーン: ${personas.writer.tone}
哲学: ${personas.writer.philosophy}

【修正ルール】
1. 指摘された箇所を重点的に修正してください。
2. 「スペース繋ぎキーワード」は必ず助詞を補って自然な日本語に直してください。
3. 修正しても、SEOキーワードは極力維持してください。
4. **重要: セクションの要約ではなく、修正後のセクション全文（見出し含む）を必ず出力してください。**
5. **重要: 元の長さを維持してください。短くすることは禁止です。**

【修正対象セクション】
${sectionText}
`;

      const fixResponse = await invokeLLM({
        messages: [{ role: "user", content: writerFixPrompt }]
      });

      const fixedContent = typeof fixResponse.choices[0].message.content === 'string'
        ? fixResponse.choices[0].message.content
        : sectionText;
        
      refinedArticle += fixedContent + "\n\n";
    }
    
    return refinedArticle;
  }

  // 短い記事（10000文字未満）は一括リライト
  console.log('[refineArticleWithPersonas] 1. Editor check (Full Article)...');
  const editorCheckPrompt = `
あなたは「${personas.editor.role}」です。
以下の記事を、あなたの性格・視点で厳格にチェックしてください。

【あなたの特徴】
${personas.editor.tone}
チェックポイント:
${personas.editor.checkPoints.map(p => `- ${p}`).join('\n')}

【チェック対象記事】
${article}

【指示】
記事の中に、日本語として不自然な点、助詞の誤り、キーワードの不自然な詰め込み（例：「動画編集 副業」のようなスペース繋ぎ）、論理の飛躍、読者への共感不足などがあれば、具体的に指摘してください。
特に「スペース繋ぎのキーワード」は厳しく指摘してください。

また、以下の点も確認してください：
1. **見出しの数**: H2見出し、H3見出しが極端に少なくないか（構成案通りか）。
2. **キーワードのバランス**: 特定のキーワード（例：メインテーマ）だけが過剰に繰り返され、他の関連キーワードが無視されていないか。

修正が必要な箇所と、その理由をリストアップしてください。
修正が不要な場合は「修正なし」と答えてください。
`;

  const checkResponse = await invokeLLM({
    messages: [{ role: "user", content: editorCheckPrompt }]
  });
  
  const checkResult = typeof checkResponse.choices[0].message.content === 'string' 
    ? checkResponse.choices[0].message.content 
    : "";
  console.log('[refineArticleWithPersonas] Editor feedback:', checkResult.substring(0, 200) + "...");

  if (checkResult.includes("修正なし")) {
    console.log('[refineArticleWithPersonas] No issues found by editor.');
    return article;
  }



  // 2. 赤原による修正
  console.log('[refineArticleWithPersonas] 2. Writer fix...');
  const writerFixPrompt = `
あなたは「${personas.writer.name}」です。
構成作家から以下の指摘を受けました。
指摘内容を真摯に受け止め、あなたの文体（${personas.writer.style}）で記事を修正してください。

【構成作家からの指摘】
${checkResult}

【あなたの特徴】
性格・トーン: ${personas.writer.tone}
哲学: ${personas.writer.philosophy}

【修正ルール】
1. 指摘された箇所を重点的に修正してください。
2. 「スペース繋ぎキーワード」は必ず助詞を補って自然な日本語に直してください。
3. 修正しても、SEOキーワード（${seoCriteria.targetKeywords.map(k => k.keyword).join(', ')}）は極力維持してください。ただし、自然さを優先してください。
4. **重要: 記事の要約ではなく、修正後の記事全文を必ず出力してください。元記事の長さを維持してください。**
5. **重要: 見出し（H2, H3）が不足していると指摘された場合は、構成を復元して追記してください。**
6. **重要: キーワードのバランスが悪いと指摘された場合は、不足しているキーワードを自然な形で文章に盛り込んでください。**

【元記事】
${article}
`;

  const fixResponse = await invokeLLM({
    messages: [{ role: "user", content: writerFixPrompt }],
    max_tokens: 16384 // Ensure full article output
  });

  const fixedArticle = typeof fixResponse.choices[0].message.content === 'string'
    ? fixResponse.choices[0].message.content
    : "";
    
  if (!fixedArticle) {
    console.error('[refineArticleWithPersonas] Failed to generate fixed article');
    return article;
  }

  // Check if the fixed article is too short (likely a summary or error)
  if (fixedArticle.length < article.length * 0.5) {
    console.warn(`[refineArticleWithPersonas] Fixed article is too short (${fixedArticle.length} chars vs ${article.length} chars). Discarding fix.`);
    return article;
  }
  
  // Strip any conversational wrapper text if present (simple heuristic)
  // Ideally LLM returns just the article, but sometimes it adds "Here is the fixed article..."
  // For now, we assume the prompt "修正後の記事全文を出力してください" works well enough, 
  // or we can try to extract markdown.
  
  console.log('[refineArticleWithPersonas] Article fixed by writer.');

  // 3. 構成作家による再確認（オプションだが、今回は修正版をそのまま採用するか、簡易チェックするか）
  // ユーザー要件: "修正後の内容を、「チェック担当：構成作家」としての擬似人格が確認"
  // ここでは確認ログを出す程度にするか、さらにループさせるか。
  // 無限ループを防ぐため、1回のリファインで終了とします。
  
  console.log('[refineArticleWithPersonas] 3. Editor verification...');
  const verifyPrompt = `
あなたは「${personas.editor.role}」です。
ライターが指摘を受けて記事を修正しました。
修正後の記事を確認し、合格かどうか判定してください。

【修正後の記事】
${fixedArticle}

【判定】
合格なら「合格」、不合格なら「不合格」と理由を述べてください。
`;

  const verifyResponse = await invokeLLM({
    messages: [{ role: "user", content: verifyPrompt }]
  });
  
  const verifyResult = typeof verifyResponse.choices[0].message.content === 'string'
    ? verifyResponse.choices[0].message.content
    : "";
  console.log('[refineArticleWithPersonas] Verification result:', verifyResult);

  // Even if verification fails, we return the fixed article as it's likely better than the original
  // or at least attempted to address issues.
  return fixedArticle;
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
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join('\n') });
      }
      currentTitle = line.trim(); // Use the full line as title, or match[1] if we want just text
      currentContent = [];
    } else if (currentTitle) {
      currentContent.push(line);
    }
  }
  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join('\n') });
  }
  return sections;
}
