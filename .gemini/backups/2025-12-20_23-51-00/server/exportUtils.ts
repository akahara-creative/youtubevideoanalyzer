import { TimelineSegment, VideoAnalysis } from "../drizzle/schema";

/**
 * Generate Markdown export from analysis and segments
 */
export function generateMarkdownExport(
  analysis: VideoAnalysis,
  segments: TimelineSegment[]
): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${analysis.title || "YouTube動画分析結果"}`);
  lines.push("");

  // Metadata
  lines.push("## 動画情報");
  lines.push("");
  lines.push(`- **URL**: ${analysis.youtubeUrl}`);
  lines.push(`- **動画ID**: ${analysis.videoId}`);
  lines.push(`- **分析日時**: ${new Date(analysis.createdAt).toLocaleString("ja-JP")}`);
  lines.push("");

  // Summary
  if (analysis.summary) {
    lines.push("## 動画の要約");
    lines.push("");
    lines.push(analysis.summary);
    lines.push("");
  }

  // Learning Points
  if (analysis.learningPoints) {
    lines.push("## 学習ポイント");
    lines.push("");
    lines.push(analysis.learningPoints);
    lines.push("");
  }

  // Timeline
  if (segments && segments.length > 0) {
    lines.push("## タイムライン");
    lines.push("");

    for (const segment of segments) {
      const startMin = Math.floor(segment.startTime / 60);
      const startSec = segment.startTime % 60;
      const endMin = Math.floor(segment.endTime / 60);
      const endSec = segment.endTime % 60;

      lines.push(
        `### [${startMin}:${String(startSec).padStart(2, "0")} - ${endMin}:${String(endSec).padStart(2, "0")}]`
      );
      lines.push("");

      if (segment.frameUrl) {
        lines.push(`![フレーム](${segment.frameUrl})`);
        lines.push("");
      }

      if (segment.transcription) {
        lines.push("**音声文字起こし:**");
        lines.push("");
        lines.push(segment.transcription);
        lines.push("");
      }

      if (segment.visualDescription) {
        lines.push("**映像内容:**");
        lines.push("");
        lines.push(segment.visualDescription);
        lines.push("");
      }

      if (segment.codeContent) {
        lines.push("**コード:**");
        lines.push("");
        lines.push("```");
        lines.push(segment.codeContent);
        lines.push("```");
        lines.push("");

        if (segment.codeExplanation) {
          lines.push("**コードの説明:**");
          lines.push("");
          lines.push(segment.codeExplanation);
          lines.push("");
        }
      }

      lines.push("---");
      lines.push("");
    }
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push("*この分析結果はYouTube動画分析アプリによって自動生成されました。*");

  return lines.join("\n");
}

/**
 * Generate HTML content for PDF export
 */
export function generateHtmlForPdf(
  analysis: VideoAnalysis,
  segments: TimelineSegment[]
): string {
  const htmlParts: string[] = [];

  htmlParts.push(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${analysis.title || "YouTube動画分析結果"}</title>
  <style>
    body {
      font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1 {
      color: #8b5cf6;
      border-bottom: 3px solid #8b5cf6;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    h2 {
      color: #6d28d9;
      margin-top: 40px;
      margin-bottom: 20px;
      border-left: 5px solid #8b5cf6;
      padding-left: 15px;
    }
    h3 {
      color: #7c3aed;
      margin-top: 30px;
      margin-bottom: 15px;
      font-size: 1.1em;
    }
    .metadata {
      background-color: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .metadata p {
      margin: 8px 0;
    }
    .metadata strong {
      color: #6d28d9;
    }
    .section {
      margin-bottom: 30px;
    }
    .timeline-item {
      border-left: 4px solid #8b5cf6;
      padding-left: 20px;
      margin-bottom: 40px;
      page-break-inside: avoid;
    }
    .timestamp {
      color: #8b5cf6;
      font-weight: bold;
      font-size: 1.1em;
      margin-bottom: 15px;
    }
    .frame-image {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 15px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .content-block {
      margin: 15px 0;
    }
    .content-label {
      font-weight: bold;
      color: #6d28d9;
      margin-bottom: 8px;
    }
    .transcription {
      background-color: #faf5ff;
      padding: 15px;
      border-radius: 6px;
      margin: 10px 0;
    }
    .visual-description {
      background-color: #f0fdf4;
      padding: 15px;
      border-radius: 6px;
      margin: 10px 0;
    }
    .code-block {
      background-color: #1e293b;
      color: #e2e8f0;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 10px 0;
    }
    .code-block pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .code-explanation {
      background-color: #eff6ff;
      padding: 15px;
      border-radius: 6px;
      margin: 10px 0;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 0.9em;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(analysis.title || "YouTube動画分析結果")}</h1>
  
  <div class="metadata">
    <p><strong>URL:</strong> ${escapeHtml(analysis.youtubeUrl)}</p>
    <p><strong>動画ID:</strong> ${escapeHtml(analysis.videoId)}</p>
    <p><strong>分析日時:</strong> ${new Date(analysis.createdAt).toLocaleString("ja-JP")}</p>
  </div>`);

  // Summary
  if (analysis.summary) {
    htmlParts.push(`
  <div class="section">
    <h2>動画の要約</h2>
    <p>${escapeHtml(analysis.summary).replace(/\n/g, "<br>")}</p>
  </div>`);
  }

  // Learning Points
  if (analysis.learningPoints) {
    htmlParts.push(`
  <div class="section">
    <h2>学習ポイント</h2>
    <p>${escapeHtml(analysis.learningPoints).replace(/\n/g, "<br>")}</p>
  </div>`);
  }

  // Timeline
  if (segments && segments.length > 0) {
    htmlParts.push(`
  <div class="section">
    <h2>タイムライン</h2>`);

    for (const segment of segments) {
      const startMin = Math.floor(segment.startTime / 60);
      const startSec = segment.startTime % 60;
      const endMin = Math.floor(segment.endTime / 60);
      const endSec = segment.endTime % 60;

      htmlParts.push(`
    <div class="timeline-item">
      <div class="timestamp">${startMin}:${String(startSec).padStart(2, "0")} - ${endMin}:${String(endSec).padStart(2, "0")}</div>`);

      if (segment.frameUrl) {
        htmlParts.push(`
      <img src="${escapeHtml(segment.frameUrl)}" alt="フレーム" class="frame-image">`);
      }

      if (segment.transcription) {
        htmlParts.push(`
      <div class="content-block">
        <div class="content-label">音声文字起こし</div>
        <div class="transcription">${escapeHtml(segment.transcription)}</div>
      </div>`);
      }

      if (segment.visualDescription) {
        htmlParts.push(`
      <div class="content-block">
        <div class="content-label">映像内容</div>
        <div class="visual-description">${escapeHtml(segment.visualDescription).replace(/\n/g, "<br>")}</div>
      </div>`);
      }

      if (segment.codeContent) {
        htmlParts.push(`
      <div class="content-block">
        <div class="content-label">コード</div>
        <div class="code-block"><pre>${escapeHtml(segment.codeContent)}</pre></div>`);

        if (segment.codeExplanation) {
          htmlParts.push(`
        <div class="code-explanation">${escapeHtml(segment.codeExplanation).replace(/\n/g, "<br>")}</div>`);
        }

        htmlParts.push(`
      </div>`);
      }

      htmlParts.push(`
    </div>`);
    }

    htmlParts.push(`
  </div>`);
  }

  htmlParts.push(`
  <div class="footer">
    <p>この分析結果はYouTube動画分析アプリによって自動生成されました。</p>
  </div>
</body>
</html>`);

  return htmlParts.join("\n");
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
