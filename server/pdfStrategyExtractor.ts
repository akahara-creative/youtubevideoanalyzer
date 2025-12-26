import fs from 'fs';
import { execSync } from 'child_process';
import { invokeLLM } from './_core/llm';
import { saveToRAGWithTags } from './ragWithTags';

/**
 * Extract text from PDF file using pdftotext (poppler-utils)
 */
export async function extractTextFromPDF(pdfPath: string): Promise<string> {
  try {
    // Use pdftotext from poppler-utils (pre-installed in sandbox)
    const text = execSync(`pdftotext "${pdfPath}" -`, { encoding: 'utf-8' });
    return text;
  } catch (error) {
    console.error('[PDF Extractor] Error extracting text from PDF:', error);
    throw error;
  }
}

/**
 * Extract strategies from PDF text using LLM
 */
export async function extractStrategiesFromPDF(params: {
  pdfText: string;
  videoId?: string;
  videoTitle?: string;
}): Promise<{
  slideDesignPatterns: Array<{ content: string; tags: any }>;
  timingStrategies: Array<{ content: string; tags: any }>;
  structurePatterns: Array<{ content: string; tags: any }>;
  explanationPatterns: Array<{ content: string; tags: any }>;
  aiStrategies: Array<{ content: string; tags: any }>;
  learningPoints: Array<{ content: string; tags: any }>;
}> {
  console.log('[PDF Extractor] Extracting strategies from PDF text...');

  const prompt = `
以下は、YouTube動画の分析レポート（PDF）から抽出されたテキストです。
このテキストから、動画制作やコンテンツ生成に活用できる戦略的知見を抽出してください。

# 抽出するカテゴリー

## 1. スライドデザインパターン
- 画面構成の型（メイン表示エリア、オーバーレイ、キャラクター配置など）
- 色使いの戦略（背景色、フレーム色、テキスト色の組み合わせ）
- 視覚効果（エフェクト、グラフィック要素）
- フォント戦略

## 2. タイミング戦略
- タイトル表示のタイミング
- ワークフロー図の表示タイミング
- デモ・実演の開始タイミング
- 重要ポイントの強調タイミング

## 3. 構成パターン
- イントロ→本編→まとめの構成
- 問題提起→解決策→実演の流れ
- セクション分割の方法

## 4. 説明パターン
- 技術用語の説明方法
- 具体例の提示方法
- 視覚的な説明の型

## 5. AI活用戦略
- AI生成コンテンツの活用方法
- プロンプトの工夫
- 自動化の戦略

## 6. 学習ポイント
- 視聴者が学ぶべき重要なポイント
- 実践的なTips
- 避けるべき失敗パターン

# PDFテキスト

${params.pdfText.substring(0, 15000)}

# 出力形式

JSON形式で出力してください：

\`\`\`json
{
  "slideDesignPatterns": [
    {
      "content": "具体的なパターンの説明",
      "genre": ["動画"],
      "contentType": ["スライドデザイン"],
      "theme": ["技術解説"]
    }
  ],
  "timingStrategies": [...],
  "structurePatterns": [...],
  "explanationPatterns": [...],
  "aiStrategies": [...],
  "learningPoints": [...]
}
\`\`\`

各カテゴリーで、実際に活用できる具体的な戦略を3〜5個抽出してください。
`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'あなたは動画制作とコンテンツ戦略の専門家です。PDFから実践的な戦略を抽出します。' },
        { role: 'user', content: prompt }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'strategy_extraction',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              slideDesignPatterns: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    content: { type: 'string' },
                    genre: { type: 'array', items: { type: 'string' } },
                    contentType: { type: 'array', items: { type: 'string' } },
                    theme: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['content', 'genre', 'contentType', 'theme'],
                  additionalProperties: false
                }
              },
              timingStrategies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    content: { type: 'string' },
                    genre: { type: 'array', items: { type: 'string' } },
                    contentType: { type: 'array', items: { type: 'string' } },
                    theme: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['content', 'genre', 'contentType', 'theme'],
                  additionalProperties: false
                }
              },
              structurePatterns: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    content: { type: 'string' },
                    genre: { type: 'array', items: { type: 'string' } },
                    contentType: { type: 'array', items: { type: 'string' } },
                    theme: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['content', 'genre', 'contentType', 'theme'],
                  additionalProperties: false
                }
              },
              explanationPatterns: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    content: { type: 'string' },
                    genre: { type: 'array', items: { type: 'string' } },
                    contentType: { type: 'array', items: { type: 'string' } },
                    theme: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['content', 'genre', 'contentType', 'theme'],
                  additionalProperties: false
                }
              },
              aiStrategies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    content: { type: 'string' },
                    genre: { type: 'array', items: { type: 'string' } },
                    contentType: { type: 'array', items: { type: 'string' } },
                    theme: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['content', 'genre', 'contentType', 'theme'],
                  additionalProperties: false
                }
              },
              learningPoints: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    content: { type: 'string' },
                    genre: { type: 'array', items: { type: 'string' } },
                    contentType: { type: 'array', items: { type: 'string' } },
                    theme: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['content', 'genre', 'contentType', 'theme'],
                  additionalProperties: false
                }
              }
            },
            required: ['slideDesignPatterns', 'timingStrategies', 'structurePatterns', 'explanationPatterns', 'aiStrategies', 'learningPoints'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content in LLM response');
    }

    const strategies = JSON.parse(content);
    console.log('[PDF Extractor] Extracted strategies:', {
      slideDesignPatterns: strategies.slideDesignPatterns.length,
      timingStrategies: strategies.timingStrategies.length,
      structurePatterns: strategies.structurePatterns.length,
      explanationPatterns: strategies.explanationPatterns.length,
      aiStrategies: strategies.aiStrategies.length,
      learningPoints: strategies.learningPoints.length,
    });

    return strategies;
  } catch (error) {
    console.error('[PDF Extractor] Error extracting strategies:', error);
    throw error;
  }
}

/**
 * Save extracted strategies to RAG with tags
 */
export async function saveStrategiesToRAG(params: {
  strategies: Awaited<ReturnType<typeof extractStrategiesFromPDF>>;
  videoId?: string;
  successLevel?: '高' | '中' | '低';
}): Promise<{ savedCount: number }> {
  console.log('[PDF Extractor] Saving strategies to RAG...');

  let savedCount = 0;

  // Save each category of strategies
  const categories = [
    { key: 'slideDesignPatterns', type: 'slide_design_pattern' },
    { key: 'timingStrategies', type: 'timing_strategy' },
    { key: 'structurePatterns', type: 'structure_pattern' },
    { key: 'explanationPatterns', type: 'explanation_pattern' },
    { key: 'aiStrategies', type: 'ai_strategy' },
    { key: 'learningPoints', type: 'learning_point' },
  ];

  for (const category of categories) {
    const items = params.strategies[category.key as keyof typeof params.strategies];
    
    for (const item of items) {
      try {
        await saveToRAGWithTags({
          content: item.content,
          type: category.type,
          sourceId: params.videoId,
          successLevel: params.successLevel || '高',
          tags: {
            genre: item.genre,
            contentType: item.contentType,
            theme: item.theme,
          },
        });
        savedCount++;
      } catch (error) {
        console.error(`[PDF Extractor] Error saving ${category.type}:`, error);
      }
    }
  }

  console.log(`[PDF Extractor] Saved ${savedCount} strategies to RAG`);
  return { savedCount };
}

/**
 * Process PDF and extract strategies (main function)
 */
export async function processPDFAndExtractStrategies(params: {
  pdfPath: string;
  videoId?: string;
  videoTitle?: string;
  successLevel?: '高' | '中' | '低';
}): Promise<{
  strategies: Awaited<ReturnType<typeof extractStrategiesFromPDF>>;
  savedCount: number;
}> {
  console.log('[PDF Extractor] Processing PDF:', params.pdfPath);

  // 1. Extract text from PDF
  const pdfText = await extractTextFromPDF(params.pdfPath);
  console.log(`[PDF Extractor] Extracted ${pdfText.length} characters from PDF`);

  // 2. Extract strategies using LLM
  const strategies = await extractStrategiesFromPDF({
    pdfText,
    videoId: params.videoId,
    videoTitle: params.videoTitle,
  });

  // 3. Save strategies to RAG
  const { savedCount } = await saveStrategiesToRAG({
    strategies,
    videoId: params.videoId,
    successLevel: params.successLevel,
  });

  return { strategies, savedCount };
}
