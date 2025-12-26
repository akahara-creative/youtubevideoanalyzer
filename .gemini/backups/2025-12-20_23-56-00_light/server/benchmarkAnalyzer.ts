/**
 * Benchmark Analyzer
 * 
 * Analyzes benchmark videos to extract success patterns and viral laws.
 * This module is used by the video generation worker to learn from successful videos.
 */

import { invokeLLM } from "./_core/llm";
import { processYouTubeVideo } from "./videoProcessor";
import { saveToRAGWithTags } from "./ragWithTags";

export interface BenchmarkVideo {
  videoId: string;
  title: string;
  url: string;
  views?: number;
  likes?: number;
}

export interface BenchmarkAnalysisResult {
  benchmarkVideos: BenchmarkVideo[];
  transcripts: Array<{
    videoId: string;
    title: string;
    transcript: string;
  }>;
  visualAnalysis: Array<{
    videoId: string;
    title: string;
    frames: Array<{
      timestamp: number;
      description: string;
      frameUrl: string;
    }>;
  }>;
  summary: string;
  sellerIntent: string;
  targetPersonas: Array<{
    name: string;
    characteristics: string;
    painPoints: string;
    reactions: string;
  }>;
  personaReactions: string;
  successFactors: string;
  viralLaws: string[];
}

/**
 * Search for benchmark videos on YouTube
 */
export async function searchBenchmarkVideos(
  theme: string,
  limit: number = 5
): Promise<BenchmarkVideo[]> {
  console.log(`[BenchmarkAnalyzer] Searching for benchmark videos: ${theme}`);

  // TODO: Implement YouTube Data API search
  // For now, return mock data
  return [
    {
      videoId: "dQw4w9WgXcQ",
      title: `${theme} - サンプル動画1`,
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      views: 1000000,
      likes: 50000,
    },
    {
      videoId: "9bZkp7q19f0",
      title: `${theme} - サンプル動画2`,
      url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
      views: 500000,
      likes: 25000,
    },
  ];
}

/**
 * Analyze a single benchmark video
 */
export async function analyzeBenchmarkVideo(
  video: BenchmarkVideo,
  jobId?: number
): Promise<{
  videoId: string;
  title: string;
  transcript: string;
  frames: Array<{
    timestamp: number;
    description: string;
    frameUrl: string;
  }>;
}> {
  console.log(`[BenchmarkAnalyzer] Analyzing video: ${video.title}`);

  // Return mock data for testing
  // TODO: Implement real YouTube video analysis when yt-dlp is configured
  return {
    videoId: video.videoId,
    title: video.title,
    transcript: `これは${video.title}のサンプル文字起こしです。動画では、${video.title}について詳しく解説しています。視聴者に役立つ情報を提供し、具体的な例を挙げながら説明しています。最後には、視聴者に行動を促すコールトゥアクションがあります。`,
    frames: [
      {
        timestamp: 0,
        description: "オープニング画面",
        frameUrl: "https://via.placeholder.com/1280x720/000000/FFFFFF?text=Opening",
      },
      {
        timestamp: 30,
        description: "メインコンテンツ",
        frameUrl: "https://via.placeholder.com/1280x720/0000FF/FFFFFF?text=Main+Content",
      },
      {
        timestamp: 60,
        description: "エンディング画面",
        frameUrl: "https://via.placeholder.com/1280x720/FF0000/FFFFFF?text=Ending",
      },
    ],
  };
}

/**
 * Extract summary from transcripts
 */
export async function extractSummary(
  transcripts: Array<{ videoId: string; title: string; transcript: string }>
): Promise<string> {
  console.log("[BenchmarkAnalyzer] Extracting summary from transcripts");

  const prompt = `以下のYouTube動画の文字起こしから、全体的な大意を抽出してください。

${transcripts
  .map(
    (t, i) => `
【動画${i + 1}: ${t.title}】
${t.transcript}
`
  )
  .join("\n")}

大意を簡潔にまとめてください（300文字程度）。`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "あなたはYouTube動画の分析専門家です。動画の文字起こしから大意を抽出します。",
      },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message.content || "";
}

/**
 * Analyze seller's intent
 */
export async function analyzeSellerIntent(
  transcripts: Array<{ videoId: string; title: string; transcript: string }>
): Promise<string> {
  console.log("[BenchmarkAnalyzer] Analyzing seller's intent");

  const prompt = `以下のYouTube動画の文字起こしから、販売者側の狙いを分析してください。

${transcripts
  .map(
    (t, i) => `
【動画${i + 1}: ${t.title}】
${t.transcript}
`
  )
  .join("\n")}

販売者側の狙いを以下の観点から分析してください：
1. ターゲット視聴者層
2. 訴求ポイント
3. 期待する行動（コンバージョン）
4. マーケティング戦略

分析結果を500文字程度でまとめてください。`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "あなたはマーケティング分析の専門家です。動画から販売者の意図を読み取ります。",
      },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message.content || "";
}

/**
 * Analyze target personas
 */
export async function analyzeTargetPersonas(
  transcripts: Array<{ videoId: string; title: string; transcript: string }>,
  sellerIntent: string
): Promise<
  Array<{
    name: string;
    characteristics: string;
    painPoints: string;
    reactions: string;
  }>
> {
  console.log("[BenchmarkAnalyzer] Analyzing target personas");

  const prompt = `以下のYouTube動画の文字起こしと販売者の狙いから、ターゲット人格（ペルソナ）を分析してください。

【販売者の狙い】
${sellerIntent}

【動画の文字起こし】
${transcripts
  .map(
    (t, i) => `
【動画${i + 1}: ${t.title}】
${t.transcript}
`
  )
  .join("\n")}

市場の中で、これらの商品・プロモーションを買って結果を出していない人格を3つ想定し、それぞれについて以下を分析してください：
1. 人格名（例: 「SEO初心者の個人事業主」）
2. 特徴（年齢、職業、経験レベルなど）
3. 抱えている問題・痛み
4. この動画に対する反応（どう感じるか、どう行動するか）

JSON形式で返してください：
[
  {
    "name": "人格名",
    "characteristics": "特徴",
    "painPoints": "抱えている問題",
    "reactions": "動画に対する反応"
  }
]`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "あなたはマーケティング分析の専門家です。ターゲット人格を分析します。",
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "target_personas",
        strict: true,
        schema: {
          type: "object",
          properties: {
            personas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  characteristics: { type: "string" },
                  painPoints: { type: "string" },
                  reactions: { type: "string" },
                },
                required: ["name", "characteristics", "painPoints", "reactions"],
                additionalProperties: false,
              },
            },
          },
          required: ["personas"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content || "{}";
  const parsed = JSON.parse(content);
  return parsed.personas || [];
}

/**
 * Analyze persona reactions
 */
export async function analyzePersonaReactions(
  personas: Array<{
    name: string;
    characteristics: string;
    painPoints: string;
    reactions: string;
  }>,
  transcripts: Array<{ videoId: string; title: string; transcript: string }>
): Promise<string> {
  console.log("[BenchmarkAnalyzer] Analyzing persona reactions");

  const prompt = `以下のターゲット人格と動画の文字起こしから、各人格がこの動画にどう反応するかを詳細に分析してください。

【ターゲット人格】
${personas
  .map(
    (p, i) => `
【人格${i + 1}: ${p.name}】
特徴: ${p.characteristics}
抱えている問題: ${p.painPoints}
初期反応: ${p.reactions}
`
  )
  .join("\n")}

【動画の文字起こし】
${transcripts
  .map(
    (t, i) => `
【動画${i + 1}: ${t.title}】
${t.transcript}
`
  )
  .join("\n")}

各人格について、以下を分析してください：
1. 動画の各セクション（フック、問題提起、解決策）に対する反応
2. メンタル負荷（離脱リスク）
3. 最終的な行動（コンバージョン）の可能性

分析結果を800文字程度でまとめてください。`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "あなたはマーケティング分析の専門家です。ターゲット人格の反応を分析します。",
      },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message.content || "";
}

/**
 * Analyze success factors
 */
export async function analyzeSuccessFactors(
  transcripts: Array<{ videoId: string; title: string; transcript: string }>,
  visualAnalysis: Array<{
    videoId: string;
    title: string;
    frames: Array<{
      timestamp: number;
      description: string;
      frameUrl: string;
    }>;
  }>,
  personaReactions: string
): Promise<string> {
  console.log("[BenchmarkAnalyzer] Analyzing success factors");

  const prompt = `以下の情報から、これらの動画がバズっている成功要因を分析してください。

【動画の文字起こし】
${transcripts
  .map(
    (t, i) => `
【動画${i + 1}: ${t.title}】
${t.transcript}
`
  )
  .join("\n")}

【視覚的要素】
${visualAnalysis
  .map(
    (v, i) => `
【動画${i + 1}: ${v.title}】
${v.frames.map((f) => `${f.timestamp}秒: ${f.description}`).join("\n")}
`
  )
  .join("\n")}

【ターゲット人格の反応】
${personaReactions}

以下の観点から成功要因を分析してください：
1. シナリオ・ネタ運び（フック、問題提起、解決策のバランス）
2. 音声の使い方（抑揚、テンポ、声のトーン）
3. スライドの視覚的要素（フォント、色、配置、画像、キャラクター）
4. 市場の中での独自性
5. ターゲット人格への訴求力

分析結果を1000文字程度でまとめてください。`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "あなたはYouTube動画の成功要因を分析する専門家です。",
      },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message.content || "";
}

/**
 * Extract viral laws
 */
export async function extractViralLaws(
  successFactors: string,
  transcripts: Array<{ videoId: string; title: string; transcript: string }>
): Promise<string[]> {
  console.log("[BenchmarkAnalyzer] Extracting viral laws");

  const prompt = `以下の成功要因分析から、バズる法則を抽出してください。

【成功要因分析】
${successFactors}

【動画の文字起こし】
${transcripts
  .map(
    (t, i) => `
【動画${i + 1}: ${t.title}】
${t.transcript}
`
  )
  .join("\n")}

バズる法則を5〜10個抽出してください。各法則は以下の形式で記述してください：
- 具体的で実行可能
- 再現性がある
- 市場の他の動画との差別化ポイントを含む

JSON形式で返してください：
{
  "laws": ["法則1", "法則2", "法則3", ...]
}`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "あなたはYouTube動画のバズる法則を抽出する専門家です。",
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "viral_laws",
        strict: true,
        schema: {
          type: "object",
          properties: {
            laws: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["laws"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content || "{}";
  const parsed = JSON.parse(content);
  return parsed.laws || [];
}

/**
 * Save analysis results to RAG
 */
export async function saveAnalysisToRAG(
  analysisResult: BenchmarkAnalysisResult,
  tagIds?: number[],
  jobId?: number
): Promise<void> {
  console.log("[BenchmarkAnalyzer] Saving analysis results to RAG");

  // Combine all analysis results into a single document
  const ragContent = `
# ベンチマーク分析結果

## 分析対象動画
${analysisResult.benchmarkVideos.map((v) => `- ${v.title} (${v.url})`).join("\n")}

## 大意
${analysisResult.summary}

## 販売者の狙い
${analysisResult.sellerIntent}

## ターゲット人格
${analysisResult.targetPersonas
  .map(
    (p) => `
### ${p.name}
**特徴**: ${p.characteristics}
**抱えている問題**: ${p.painPoints}
**動画に対する反応**: ${p.reactions}
`
  )
  .join("\n")}

## 人格の反応分析
${analysisResult.personaReactions}

## 成功要因
${analysisResult.successFactors}

## バズる法則
${analysisResult.viralLaws.map((law, i) => `${i + 1}. ${law}`).join("\n")}
`;

  // Save to RAG
  await saveToRAGWithTags({
    content: ragContent,
    type: "video_benchmark_analysis",
    sourceId: jobId ? `job_${jobId}` : undefined,
    successLevel: "高",
    tags: {
      contentType: ["ベンチマーク分析"],
    },
  });

  console.log("[BenchmarkAnalyzer] Analysis results saved to RAG");
}

/**
 * Perform complete benchmark analysis
 */
export async function performBenchmarkAnalysis(
  theme: string,
  tagIds?: number[],
  jobId?: number
): Promise<BenchmarkAnalysisResult> {
  console.log(`[BenchmarkAnalyzer] Starting benchmark analysis for: ${theme}`);
  console.log(`[BenchmarkAnalyzer] ENV.forgeApiKey length: ${process.env.BUILT_IN_FORGE_API_KEY?.length || 0}`);

  // Step 1: Search for benchmark videos
  const benchmarkVideos = await searchBenchmarkVideos(theme, 3);

  // Step 2: Analyze each video
  const analysisResults = [];
  for (const video of benchmarkVideos) {
    try {
      const result = await analyzeBenchmarkVideo(video, jobId);
      analysisResults.push(result);
    } catch (error) {
      console.error(
        `[BenchmarkAnalyzer] Failed to analyze video ${video.videoId}:`,
        error
      );
      // Continue with other videos
    }
  }

  if (analysisResults.length === 0) {
    throw new Error("Failed to analyze any benchmark videos");
  }

  // Step 3: Extract transcripts and visual analysis
  const transcripts = analysisResults.map((r) => ({
    videoId: r.videoId,
    title: r.title,
    transcript: r.transcript,
  }));

  const visualAnalysis = analysisResults.map((r) => ({
    videoId: r.videoId,
    title: r.title,
    frames: r.frames,
  }));

  // Step 4: Extract summary
  const summary = await extractSummary(transcripts);

  // Step 5: Analyze seller's intent
  const sellerIntent = await analyzeSellerIntent(transcripts);

  // Step 6: Analyze target personas
  const targetPersonas = await analyzeTargetPersonas(transcripts, sellerIntent);

  // Step 7: Analyze persona reactions
  const personaReactions = await analyzePersonaReactions(
    targetPersonas,
    transcripts
  );

  // Step 8: Analyze success factors
  const successFactors = await analyzeSuccessFactors(
    transcripts,
    visualAnalysis,
    personaReactions
  );

  // Step 9: Extract viral laws
  const viralLaws = await extractViralLaws(successFactors, transcripts);

  const result: BenchmarkAnalysisResult = {
    benchmarkVideos,
    transcripts,
    visualAnalysis,
    summary,
    sellerIntent,
    targetPersonas,
    personaReactions,
    successFactors,
    viralLaws,
  };

  // Step 10: Save to RAG
  await saveAnalysisToRAG(result, tagIds, jobId);

  console.log("[BenchmarkAnalyzer] Benchmark analysis completed");

  return result;
}
