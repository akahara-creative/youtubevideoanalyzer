interface WordPressExportOptions {
  body: string;
  aioSection?: string;
  faq?: Array<{ question: string; answer: string }>;
  metaInfo?: {
    metaDescription?: string;
    metaKeywords?: string[];
    jsonLD?: any;
  } | null;
}

/**
 * SEO記事をWordPress用HTMLに変換
 * 本文・AIOセクション・FAQ・JSON-LD・メタ情報を1つのHTMLにまとめる
 */
export async function generateWordPressHTML(options: WordPressExportOptions): Promise<string> {
  const { body, aioSection, faq, metaInfo } = options;
  const metaDescription = metaInfo?.metaDescription;
  const metaKeywords = metaInfo?.metaKeywords;
  const jsonLD = metaInfo?.jsonLD;

  // Markdownを HTMLに変換（動的インポート）
  const { marked } = await import('marked');
  const articleHTML = body ? await marked(body) : '';

  let html = '';

  // HTMLヘッダー（文字化け防止のためUTF-8を明示）
  html += '<!DOCTYPE html>\n';
  html += '<html lang="ja">\n';
  html += '<head>\n';
  html += '<meta charset="UTF-8">\n';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
  html += '<title>WordPress用HTML</title>\n';
  html += '</head>\n';
  html += '<body>\n\n';

  // メタ情報（コメントとして記載、WordPressのSEOプラグインで設定する際の参考用）
  if (metaDescription || metaKeywords) {
    html += '<!-- SEOメタ情報\n';
    if (metaDescription) {
      html += `メタディスクリプション: ${metaDescription}\n`;
    }
    if (metaKeywords && metaKeywords.length > 0) {
      html += `メタキーワード: ${metaKeywords.join(', ')}\n`;
    }
    html += '-->\n\n';
  }

  // JSON-LD構造化データ（headタグ内に配置する用）
  if (jsonLD) {
    html += '<!-- 以下のJSON-LDをWordPressのheadタグ内に配置してください -->\n';
    html += '<script type="application/ld+json">\n';
    html += JSON.stringify(jsonLD, null, 2);
    html += '\n</script>\n\n';
  }

  // 本文
  html += '<!-- 記事本文 -->\n';
  html += '<article class="seo-article">\n';
  html += articleHTML;
  html += '</article>\n\n';

  // AIOセクション
  if (aioSection) {
    html += '<!-- AIO（All In One）セクション -->\n';
    html += '<section class="aio-section" style="background: #f8f9fa; padding: 20px; margin: 30px 0; border-left: 4px solid #007bff;">\n';
    html += '<h2 style="color: #007bff; margin-top: 0;">📝 この記事の要点</h2>\n';
    const aioHTML = aioSection ? await marked(aioSection) : '';
    html += aioHTML;
    html += '</section>\n\n';
  }

  // FAQセクション
  if (faq && faq.length > 0) {
    html += '<!-- FAQセクション -->\n';
    html += '<section class="faq-section" style="margin: 30px 0;">\n';
    html += '<h2>❓ よくある質問</h2>\n';
    html += '<div class="faq-list">\n';
    
    for (const item of faq) {
      html += '<div class="faq-item" style="margin-bottom: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px;">\n';
      html += `<h3 style="color: #333; margin-top: 0;">Q: ${item.question}</h3>\n`;
      const answerHTML = await marked(item.answer);
      html += `<div class="faq-answer" style="color: #666;">\n${answerHTML}</div>\n`;
      html += '</div>\n';
    }
    
    html += '</div>\n';
    html += '</section>\n\n';
  }

  // 使用方法の説明（コメント）
  html += '<!-- \n';
  html += 'WordPress投稿への貼り付け方法:\n';
  html += '1. WordPressの投稿編集画面で「テキストエディタ」または「HTMLエディタ」に切り替え\n';
  html += '2. 上記のHTMLをすべてコピーして貼り付け\n';
  html += '3. JSON-LD部分は、テーマのheader.phpまたはSEOプラグインに設定\n';
  html += '4. メタ情報は、SEOプラグイン（Yoast SEO、All in One SEO等）に設定\n';
  html += '-->\n\n';

  // HTML終了タグ
  html += '</body>\n';
  html += '</html>\n';

  return html;
}
