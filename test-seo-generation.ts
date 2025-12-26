import 'dotenv/config';
import { generateSEOArticle, SEOCriteria } from './server/seoArticleGenerator';

async function testGeneration() {
  const theme = "案件をとっても、SNS集客しても、動画編集で稼げない人へ";
  const remarks = `〇：要件
自分のコミュニティーに来た人から相談された内容として書いてください。『その人は、動画編集界隈で苦しんでいた。ただ、メルマガで書いているとある事を教えた結果、人生の自由が得られた。この記事は、もしもあの時、動画界隈から出なかったらゾッとする。そう言われた内容をまとめた内容です。』そんなスタンスで書いてください。

〇：書いて欲しい内容
動画編集は、結局のところ案件をもらう下請けでしかない。結果、営業を辞めることもできないし、走り続けるしかない。それはSNSの投稿も同じ。真似・パクリ・テンプレで埋もれることが前提。結果知名度を上げるしかないが、それは炎上リスクでもあり身バレリスクでもある。スクールをするにも人間関係で疲弊する。だから、手離れする仕組み化がおすすめ。そんな記事にして下さい。仕組み化とか、そっち系でSEOのキーワードを並べるのではなく、動画編集　副業とかそっちでSEOキーワードを積み上げて下さい。仕組み化の詳細な解説はしなくていいです。むしろ、仕組み化を学びたい！という気分にして、メルマガに登録する。そんな流れをつくって下さい。`;
  const offer = "メルマガ登録";
  
  // Mock Structure (Simplified but structured)
  const structure = `# 案件をとっても、SNS集客しても、動画編集で稼げない人へ

## 動画編集の副業で稼げない現実とは？
### 案件が取れない地獄
### 単価が安すぎて時給換算で絶望
### 競合が多すぎて埋もれる

## なぜ動画編集スクールに通っても稼げないのか
### スクールで教わることは全員同じ
### 差別化できないポートフォリオ
### 営業メールを送っても無視される日々

## SNS集客の罠とリスク
### 毎日投稿してもフォロワーが増えない
### 炎上リスクと身バレの恐怖
### 顔出しなしでは信頼されない現実

## 労働集約型ビジネスの限界
### 働かないと収入がゼロになる恐怖
### 自由な時間は一生手に入らない
### クライアントワークのストレス

## 本当に自由になるための「仕組み化」とは
### 労働から解放される唯一の方法
### 自動で収益が発生する仕組み
### 動画編集スキルを活かした次のステップ

## まとめ：動画編集の地獄から抜け出そう`;

  const criteria: SEOCriteria = {
    targetWordCount: 5000, // Reduced for test speed, but structure implies length
    targetH2Count: 5,
    targetH3Count: 15,
    targetKeywords: [
      { keyword: "動画編集 稼げない", minCount: 5 },
      { keyword: "動画編集 副業", minCount: 5 },
      { keyword: "動画編集 案件", minCount: 5 },
      { keyword: "SNS集客", minCount: 5 },
      { keyword: "仕組み化", minCount: 5 }
    ],
    targetRelated: [],
    targetSynonyms: []
  };

  const ragContext = "（RAG Context Placeholder）";
  const authorName = "赤原";
  const conclusionKeywords = ["仕組み化"];
  const generatedPersonas = {
    target: { characteristics: "30代男性", episodes: {}, struggles: "稼げない", frustrations: "怒り", latentAptitude: "適性あり" },
    writer: { name: "赤原", style: "赤原スタイル", tone: "僕", philosophy: "本質" },
    editor: { role: "構成作家", checkPoints: [], tone: "厳格" }
  };

  console.log("Starting generation test...");
  const article = await generateSEOArticle(
    structure,
    criteria,
    ragContext,
    authorName,
    conclusionKeywords,
    generatedPersonas as any,
    remarks,
    offer
  );

  console.log("Generation complete.");
  console.log("Length:", article.length);
  console.log("Start:", article.substring(0, 200));
  console.log("End:", article.substring(article.length - 200));
}

testGeneration();
