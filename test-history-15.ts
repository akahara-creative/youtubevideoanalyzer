
import 'dotenv/config';
import { createArticleStructure, generateSEOArticle, refineArticleWithPersonas, createSEOCriteria } from './server/seoArticleGenerator';

async function runTest() {
  console.log('Starting History 15 Reproduction Test...');

  const theme = "案件をとっても、SNS集客しても、動画編集で稼げない人へ";
  const remarks = `〇：要件
自分のコミュニティーに来た人から相談された内容として書いてください。『その人は、動画編集界隈で苦しんでいた。ただ、メルマガで書いているとある事を教えた結果、人生の自由が得られた。この記事は、もしもあの時、動画界隈から出なかったらゾッとする。そう言われた内容をまとめた内容です。』そんなスタンスで書いてください。

〇：書いて欲しい内容
動画編集は、結局のところ案件をもらう下請けでしかない。結果、営業を辞めることもできないし、走り続けるしかない。それはSNSの投稿も同じ。真似・パクリ・テンプレで埋もれることが前提。結果知名度を上げるしかないが、それは炎上リスクでもあり身バレリスクでもある。スクールをするにも人間関係で疲弊する。だから、手離れする仕組み化がおすすめ。そんな記事にして下さい。仕組み化とか、そっち系でSEOのキーワードを並べるのではなく、動画編集　副業とかそっちでSEOキーワードを積み上げて下さい。仕組み化の詳細な解説はしなくていいです。むしろ、仕組み化を学びたい！という気分にして、メルマガに登録する。そんな流れをつくって下さい。`;
  const offer = "メルマガ登録";
  const targetWordCount = 20000;

  // Mock SEO Criteria (since we don't want to run full search/analysis which takes time)
  // We'll use a simplified version but with real keywords from the log
  const criteria = {
    targetWordCount: targetWordCount,
    targetH2Count: 14,
    targetH3Count: 42,
    targetKeywords: [
      { keyword: "動画編集 稼げない", minCount: 5 },
      { keyword: "動画編集 副業", minCount: 5 },
      { keyword: "動画編集 案件", minCount: 3 },
      { keyword: "動画編集 営業", minCount: 3 },
      { keyword: "動画編集 SNS集客", minCount: 3 },
      { keyword: "動画編集 下請け", minCount: 3 },
      { keyword: "動画編集 疲弊", minCount: 3 },
      { keyword: "動画編集 炎上リスク", minCount: 3 },
      { keyword: "動画編集 身バレ", minCount: 3 },
      { keyword: "動画編集 スクール", minCount: 3 }
    ],
    targetSynonyms: [],
    targetRelated: [],
    searchIntents: ["稼げない現実を知りたい", "辞めたい", "別の稼ぎ方を知りたい"],
    potentialNeeds: ["自動化したい", "楽に稼ぎたい"],
    persona: "30代男性、副業で動画編集をしているが疲弊している"
  };

  const ragContext = "（RAG Context Mock: 赤原の過去記事や競合記事の内容...）";
  const authorName = "赤原";
  const painPoints = ["毎日作業で眠れない", "単価が安い", "クライアントの要望が理不尽"];
  const storyKeywords = ["深夜3時", "納品直前の修正", "Zoomでのため息"];
  const offerBridge = ["労働集約からの脱却", "仕組み化の重要性"];
  const conclusionKeywords = ["仕組み化", "リストマーケティング"];

  // Step 5: Structure
  console.log('\n[Step 5] Generating Structure...');
  const structureResult = await createArticleStructure(
    theme,
    criteria,
    ragContext,
    authorName,
    painPoints,
    storyKeywords,
    offerBridge,
    conclusionKeywords,
    remarks,
    offer
  );

  console.log('Structure Result (Raw):', JSON.stringify(structureResult, null, 2).substring(0, 500) + '...');

  let structureMarkdown = structureResult.structure;
    
  // Sanitize structure (Logic from seoArticleJobProcessor.ts)
  if (structureMarkdown.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(structureMarkdown);
      if (parsed.structure && typeof parsed.structure === 'string') {
        console.log(`[Sanitize] Detected nested JSON in structure. Extracting inner structure.`);
        structureMarkdown = parsed.structure;
      }
    } catch (e) {
      console.warn(`[Sanitize] Failed to parse potential JSON structure:`, e);
    }
  }

  console.log('Sanitized Structure Length:', structureMarkdown.length);
  console.log('Sanitized Structure Start:', structureMarkdown.substring(0, 200));

  // Step 6: Generate Article
  console.log('\n[Step 6] Generating Article...');
  // We'll use a mock generatedPersonas for Step 6/7
  const generatedPersonas: any = {
    target: {
      profile: "30代男性、副業動画編集者",
      pain: "稼げない、疲弊している",
      goal: "仕組み化で自由になりたい",
      characteristics: [],
      episodes: [],
      struggles: [],
      frustrations: [],
      latentAptitude: []
    },
    writer: {
      name: "赤原",
      tone: "断定口調、毒舌だが愛がある、実体験ベース",
      style: "ストーリーテリング、感情的、論理的",
      philosophy: "労働からの解放、仕組み化"
    },
    editor: {
      role: "辛口編集者",
      tone: "論理的、厳しい、読者目線",
      checkPoints: ["論理の飛躍はないか", "独りよがりになっていないか", "SEOキーワードは自然か"]
    }
  };

  const article = await generateSEOArticle(
    structureMarkdown,
    criteria,
    ragContext,
    authorName,
    conclusionKeywords,
    generatedPersonas,
    remarks,
    offer
  );

  console.log('Generated Article Length:', article.length);
  console.log('Generated Article Start:', article.substring(0, 200));

  // Step 7: Refine Article
  console.log('\n[Step 7] Refining Article...');
  const refinedArticle = await refineArticleWithPersonas(article, generatedPersonas, criteria);

  console.log('Refined Article Length:', refinedArticle.length);
  console.log('Refined Article Start:', refinedArticle.substring(0, 200));
  
  if (refinedArticle.length < 5000) {
      console.error('FAILURE: Article is too short!');
      process.exit(1);
  } else {
      console.log('SUCCESS: Article generated successfully with sufficient length.');
  }
}

runTest().catch(console.error);
