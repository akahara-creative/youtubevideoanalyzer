import { invokeLLM } from "./_core/llm";

/**
 * SEO記事リライト機能
 * 
 * 不足キーワードを自然に追加して目標達成率を向上させる
 * 赤原カラー（自省心、自嘲、皮肉）を維持しながら、描写を膨らませる
 */

export interface KeywordTarget {
  keyword: string;
  current: number;
  target: number;
  shortage: number;
}

export interface RewriteOptions {
  article: string;
  keywordTargets: KeywordTarget[];
  theme: string;
  authorName: string;
}

/**
 * 不足キーワードを優先度順にソート
 */
function prioritizeKeywords(targets: KeywordTarget[]): KeywordTarget[] {
  return targets
    .filter(t => t.shortage > 0)
    .sort((a, b) => b.shortage - a.shortage);
}

/**
 * スペース繋ぎキーワードを自然な日本語に変換する例を生成
 */
function generateNaturalExamples(keyword: string): string[] {
  const parts = keyword.split(/\s+/);
  
  if (parts.length === 2) {
    return [
      `${parts[0]}では${parts[1]}`,
      `${parts[0]}で${parts[1]}`,
      `${parts[0]}に取り組んでも${parts[1]}`,
      `${parts[0]}を続けても${parts[1]}`,
    ];
  } else if (parts.length === 3) {
    return [
      `${parts[0]}を${parts[1]}して${parts[2]}`,
      `${parts[0]}の${parts[1]}が${parts[2]}`,
      `${parts[0]}で${parts[1]}を試みても${parts[2]}`,
    ];
  }
  
  return [keyword.replace(/\s+/g, '')];
}

/**
 * 記事をリライトして不足キーワードを追加
 */
export async function rewriteArticle(options: RewriteOptions): Promise<string> {
  const { article, keywordTargets, theme, authorName } = options;
  
  // 不足キーワードを優先度順にソート
  const prioritizedTargets = prioritizeKeywords(keywordTargets);
  
  if (prioritizedTargets.length === 0) {
    return article; // 不足キーワードがない場合はそのまま返す
  }
  
  // 不足キーワードの情報をまとめる
  const keywordInfo = prioritizedTargets.map(t => 
    `- 「${t.keyword}」: 現在${t.current}回 → 目標${t.target}回（不足${t.shortage}回）`
  ).join('\n');
  
  // 自然な日本語の例を生成
  const naturalExamples = prioritizedTargets.map(t => {
    const examples = generateNaturalExamples(t.keyword);
    return `「${t.keyword}」の自然な使い方:\n${examples.map(ex => `  - ${ex}`).join('\n')}`;
  }).join('\n\n');
  
  const prompt = `あなたは赤原カラー全開のSEOライターです。以下の記事をリライトして、不足しているキーワードを自然に追加してください。

【元の記事】
${article}

【テーマ】
${theme}

【著者名】
${authorName}

【不足キーワード】
${keywordInfo}

【自然な日本語の例】
${naturalExamples}

【リライトの絶対ルール】

★★★ 最重要：スペース繋ぎキーワードの絶対禁止 ★★★

1. **スペース繋ぎキーワードをそのまま使わない**
   - ❌ NG: 「SNSマーケ 稼げない」「バズ 収益化」
   - ✅ OK: 「SNSマーケでは稼げない」「バズを起こして収益化」

2. **赤原カラーを維持**
   - 自省心・自戒の心を産む文章
   - 実体験として・自嘲、自分への皮肉を全開に語る
   - 直接話法禁止（「あなたは〜」NG）

3. **結論キーワード（ステップメール等）のノウハウは語らない**
   - 匂わせるだけ
   - オファーへ繋げる

4. **描写を膨らませる**
   - 不足キーワードに関連する段落を特定
   - 読者の痛みを先回りしたエピソードを追加
   - 具体例や体験談を増やす

5. **自然な追加**
   - 無意味にキーワードを詰め込まない
   - エピソードを活かして自然に織り込む
   - 正しい日本語で成立させる

【リライト方針】

1. 不足キーワードが最も多いものから優先的に追加
2. 各キーワードに関連する段落を拡張
3. 赤原カラー（自嘲、皮肉、実体験）を維持しながら描写を膨らませる
4. スペース繋ぎキーワードは必ず助詞（「では」「を」「が」「て」等）で繋ぐ
5. 目標回数を達成するまで自然に追加

【出力形式】
リライト後の記事全文を出力してください。元の記事の構造（見出し、段落）は維持してください。`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "あなたは赤原カラー全開のSEOライターです。自省心・自戒の心を産む文章を書き、実体験として・自嘲、自分への皮肉を全開に語ります。スペース繋ぎキーワードは絶対に使いません。"
      },
      {
        role: "user",
        content: prompt
      }
    ]
  });

  const rewrittenArticle = response.choices[0].message.content || article;
  
  return rewrittenArticle;
}
