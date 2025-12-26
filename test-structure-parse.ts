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
### 顔出しなしでは信頼されない現実`;

function parseStructure(md: string) {
  const lines = md.split('\n');
  const sections: { title: string; content: string }[] = [];
  let currentTitle = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join('\n') });
      }
      currentTitle = line;
      currentContent = [];
    } else if (currentTitle) {
      currentContent.push(line);
    }
  }
  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join('\n') });
  }
  return sections;
}

const sections = parseStructure(structure);
console.log(JSON.stringify(sections, null, 2));
