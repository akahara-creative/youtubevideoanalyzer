/**
 * テキスト圧縮ユーティリティ
 * 長いテキストを要約・箇条書き化して60KB以内に収める
 */

import { invokeLLM } from "./llm";

const MAX_TEXT_LENGTH = 60000; // 60KB

/**
 * テキストを要約・箇条書き化して60KB以内に収める
 * 
 * @param text - 圧縮するテキスト
 * @param fieldName - フィールド名（summary, learningPointsなど）
 * @returns 圧縮されたテキスト
 */
export async function compressText(
  text: string,
  fieldName: string = "テキスト"
): Promise<string> {
  // 60KB以下ならそのまま返す
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }

  console.log(`[TextCompressor] ${fieldName}が${text.length}文字で60KBを超過しています。要約・箇条書き化します...`);

  try {
    // フィールド名に応じたプロンプトを生成
    let systemPrompt: string;
    let userPrompt: string;

    if (fieldName === "summary" || fieldName.includes("要約")) {
      systemPrompt = "あなたは長文の要約を専門とする編集者です。重要な情報を失わずに、簡潔で読みやすい要約を作成してください。";
      userPrompt = `以下の要約を、重要な情報を失わずに60KB（約20,000文字）以内に収まるように要約してください。箇条書きや見出しを活用して構造化してください。\n\n${text}`;
    } else if (fieldName === "learningPoints" || fieldName.includes("学習ポイント")) {
      systemPrompt = "あなたは学習コンテンツの編集者です。重要な学習ポイントを失わずに、箇条書き形式で整理してください。";
      userPrompt = `以下の学習ポイントを、重要な情報を失わずに60KB（約20,000文字）以内に収まるように箇条書きで整理してください。優先順位の高いポイントから順に並べてください。\n\n${text}`;
    } else {
      systemPrompt = "あなたは長文を要約する専門家です。重要な情報を失わずに、簡潔で読みやすい形式に変換してください。";
      userPrompt = `以下のテキストを、重要な情報を失わずに60KB（約20,000文字）以内に収まるように要約・箇条書き化してください。\n\n${text}`;
    }

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      maxTokens: 8192, // 十分な長さを確保
    });

    const compressedText = response.choices[0].message.content;
    const result = typeof compressedText === 'string' ? compressedText : JSON.stringify(compressedText);

    // それでも60KBを超える場合は、最後の手段として切り詰め
    if (result.length > MAX_TEXT_LENGTH) {
      console.warn(`[TextCompressor] 要約後も${result.length}文字で60KBを超過しています。切り詰めます。`);
      return result.substring(0, MAX_TEXT_LENGTH) + "... (切り詰め)";
    }

    console.log(`[TextCompressor] ${fieldName}を${text.length}文字から${result.length}文字に圧縮しました。`);
    return result;
  } catch (error) {
    console.error(`[TextCompressor] 要約に失敗しました:`, error);
    // エラーが発生した場合は、最後の手段として切り詰め
    return text.substring(0, MAX_TEXT_LENGTH) + "... (要約失敗のため切り詰め)";
  }
}

