import { invokeLLM } from "./_core/llm";

/**
 * スペース繋ぎキーワードを検出してリライトする関数
 * 
 * 例: 「SNSマーケ 稼げない」→「SNSマーケでは稼げない」
 */
export async function fixSpaceKeywords(article: string): Promise<string> {
  // スペース繋ぎキーワードのパターンを検出
  // 英字・カタカナ・漢字・ひらがな + スペース + 英字・カタカナ・漢字・ひらがな
  const spaceKeywordPattern = /([A-Za-zァ-ヶー一-龠ぁ-ん]+)\s+([A-Za-zァ-ヶー一-龠ぁ-ん]+)/g;  
  const matches = article.match(spaceKeywordPattern);
  
  if (!matches || matches.length === 0) {
    // スペース繋ぎキーワードが見つからない場合はそのまま返す
    return article;
  }
  
  // 検出されたスペース繋ぎキーワードをLLMでリライト
  console.log(`[fixSpaceKeywords] ${matches.length}個のスペース繋ぎキーワードを検出しました:`, matches);
  
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたは日本語の文章校正の専門家です。

以下の文章に含まれる「スペース繋ぎキーワード」（例：「SNSマーケ 稼げない」「バズ 収益化」）を、正しい日本語に修正してください。

【修正ルール】
1. スペースで繋がれた単語の間に、適切な助詞（「では」「を」「が」「で」「に」「は」等）を追加する
2. 文脈に合わせて自然な日本語にする
3. 引用符や太字で囲まれている場合でも、中身は正しい日本語に修正する
4. それ以外の部分は一切変更しない

【修正例】
- 「SNSマーケ 稼げない」→「SNSマーケでは稼げない」
- 「バズ 収益化」→「バズを起こして収益化」
- 「集客 仕組み化 できない」→「集客を仕組み化できない」
- 「SEO 集客 安定しない」→「SEOでの集客は安定しない」

修正後の文章全体を返してください。`
      },
      {
        role: "user",
        content: article
      }
    ]
  });
  
  const fixedArticle = response.choices[0].message.content;
  
  if (typeof fixedArticle !== 'string') {
    console.error('[fixSpaceKeywords] LLM response is not a string');
    return article;
  }
  
  console.log(`[fixSpaceKeywords] スペース繋ぎキーワードの修正が完了しました`);
  
  return fixedArticle;
}

/**
 * ノウハウ記述を検出して削除する関数
 * 
 * 例: 「ペルソナ設定の徹底：〜」「ストーリーテリングとブランディング」等
 */
export async function removeHowToContent(article: string): Promise<string> {
  // ノウハウ記述のパターンを検出
  const howToPatterns = [
    /H3\.\s*[^:\n]+の方法[^\n]*/g,
    /H3\.\s*[^:\n]+のポイント[^\n]*/g,
    /H3\.\s*[^:\n]+の戦略[^\n]*/g,
    /H3\.\s*[^:\n]+の徹底[^\n]*/g,
    /H3\.\s*ペルソナ設定[^\n]*/g,
    /H3\.\s*ストーリーテリング[^\n]*/g,
    /ナーチャリング/g,
  ];
  
  let hasHowTo = false;
  for (const pattern of howToPatterns) {
    if (pattern.test(article)) {
      hasHowTo = true;
      break;
    }
  }
  
  if (!hasHowTo) {
    // ノウハウ記述が見つからない場合はそのまま返す
    return article;
  }
  
  console.log(`[removeHowToContent] ノウハウ記述を検出しました`);
  
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたは日本語の文章校正の専門家です。

以下の文章から、「ノウハウを語る部分」を削除してください。

【削除対象】
- 「～の方法」「～のポイント」「～の戦略」「～の徹底」などの見出しとその内容
- 「ペルソナ設定」「ストーリーテリング」「ブランディング」「ナーチャリング」などの具体的な手法の説明
- 「～することで」「～が重要です」などの具体的なノウハウの説明
- ステップメールの専門用語（ナーチャリング、セグメント、シナリオ設計等）を含む文章

【削除しない部分】
- 筆者の体験談や苦労話
- 「僕がこの地獄から抜け出せたのは、〜を学んでからです」のような結果の提示
- 「詳しく学びたい人のため、メール講座を作りました」のようなオファーへの誘導

削除後の文章全体を返してください。`
      },
      {
        role: "user",
        content: article
      }
    ]
  });
  
  const cleanedArticle = response.choices[0].message.content;
  
  if (typeof cleanedArticle !== 'string') {
    console.error('[removeHowToContent] LLM response is not a string');
    return article;
  }
  
  console.log(`[removeHowToContent] ノウハウ記述の削除が完了しました`);
  
  return cleanedArticle;
}
