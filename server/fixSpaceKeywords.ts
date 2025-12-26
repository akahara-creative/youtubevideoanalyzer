import { invokeLLM } from "./_core/llm";

/**
 * スペース繋ぎキーワードを検出してリライトする関数
 * 
 * 例: 「SNSマーケ 稼げない」→「SNSマーケでは稼げない」
 */
/**
 * 記事をセクションごとに分割して処理するヘルパー関数
 */
async function processBySections(article: string, processFn: (section: string) => Promise<string>): Promise<string> {
  // H2見出しで分割 (## )
  let sections = article.split(/(?=^## )/gm);
  
  // H2がない、またはセクションが少なすぎる（かつ文章が長い）場合はH3で分割
  if (sections.length < 2 && article.length > 5000) {
    console.log('[processBySections] H2が見つからないため、H3で分割します');
    sections = article.split(/(?=^### )/gm);
  }

  // それでも分割できず、かつ長すぎる場合は、単純に文字数で分割（4000文字ごと）
  if (sections.length < 2 && article.length > 5000) {
    console.log('[processBySections] 見出しが見つからないため、文字数で分割します');
    const chunkSize = 4000;
    sections = [];
    for (let i = 0; i < article.length; i += chunkSize) {
      sections.push(article.substring(i, i + chunkSize));
    }
  }
  
  const processedSections = [];
  for (const section of sections) {
    if (!section.trim()) {
      processedSections.push(section);
      continue;
    }
    
    // セクションがまだ長すぎる場合（8000文字以上）は、さらに分割して処理
    if (section.length > 8000) {
       console.log('[processBySections] セクションが長すぎるため、さらに分割して処理します');
       const subChunks = [];
       const chunkSize = 4000;
       for (let i = 0; i < section.length; i += chunkSize) {
         subChunks.push(section.substring(i, i + chunkSize));
       }
       
       for (const chunk of subChunks) {
         processedSections.push(await processFn(chunk));
       }
    } else {
       processedSections.push(await processFn(section));
    }
  }
  
  return processedSections.join('');
}

/**
 * スペース繋ぎキーワードを検出してリライトする関数
 * 
 * 例: 「SNSマーケ 稼げない」→「SNSマーケでは稼げない」
 */
export async function fixSpaceKeywords(article: string): Promise<string> {
  return processBySections(article, async (section) => {
    // スペース繋ぎキーワードのパターンを検出
    const spaceKeywordPattern = /([A-Za-zァ-ヶー一-龠ぁ-ん]+)\s+([A-Za-zァ-ヶー一-龠ぁ-ん]+)/g;  
    const matches = section.match(spaceKeywordPattern);
    
    if (!matches || matches.length === 0) {
      return section;
    }
    
    console.log(`[fixSpaceKeywords] セクション内で${matches.length}個のスペース繋ぎキーワードを検出しました`);
    
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
5. **重要: 見出し（##, ###）などのMarkdown記法は絶対に削除・変更しないこと。**
6. それ以外の部分は一切変更しない

【修正例】
- 「## SNSマーケ 稼げない」→「## SNSマーケでは稼げない」
- 「### バズ 収益化」→「### バズを起こして収益化」

修正後の文章のみを返してください。`
        },
        {
          role: "user",
          content: section
        }
      ],
      max_tokens: 8192
    });
    
    const fixedSection = response.choices[0].message.content;
    
    if (typeof fixedSection !== 'string') {
      console.error('[fixSpaceKeywords] LLM response is not a string');
      return section;
    }
    
    return fixedSection;
  });
}

/**
 * ノウハウ記述を検出して削除する関数
 * 
 * 例: 「ペルソナ設定の徹底：〜」「ストーリーテリングとブランディング」等
 */
export async function removeHowToContent(article: string): Promise<string> {
  return processBySections(article, async (section) => {
    // ノウハウ記述のパターンを検出
    const howToPatterns = [
      /###\s*[^:\n]+の方法[^\n]*/g,
      /###\s*[^:\n]+のポイント[^\n]*/g,
      /###\s*[^:\n]+の戦略[^\n]*/g,
      /###\s*[^:\n]+の徹底[^\n]*/g,
      /###\s*ペルソナ設定[^\n]*/g,
      /###\s*ストーリーテリング[^\n]*/g,
      /ナーチャリング/g,
    ];
    
    let hasHowTo = false;
    for (const pattern of howToPatterns) {
      if (pattern.test(section)) {
        hasHowTo = true;
        break;
      }
    }
    
    if (!hasHowTo) {
      return section;
    }
    
    console.log(`[removeHowToContent] セクション内でノウハウ記述を検出しました`);
    
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

【重要ルール】
1. **削除対象以外の見出し（##, ###）は絶対に維持すること。** 見出しを勝手に削除したり、Markdown記号を消したりしないこと。
2. セクション全体が削除対象でない限り、元の見出し構造を保つこと。

削除後の文章のみを返してください。`
        },
        {
          role: "user",
          content: section
        }
      ],
      max_tokens: 8192
    });
    
    const cleanedSection = response.choices[0].message.content;
    
    if (typeof cleanedSection !== 'string') {
      console.error('[removeHowToContent] LLM response is not a string');
      return section;
    }
    
    return cleanedSection;
  });
}
