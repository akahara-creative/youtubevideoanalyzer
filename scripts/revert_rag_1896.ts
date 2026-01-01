import 'dotenv/config';
import { getDb } from '../server/db';
import { ragDocuments } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const originalContent = `
（証拠動画１：商品設計・セールスレター・特典・ステップメール構成・ステップメール執筆・・・これら全てを１０分で終わらせる）

（証拠動画２：ブログコンセプト・ブログのトーン・キャラクター・記事執筆・・・これら全てを５分で終わらせる）

こんにちは。赤原です。

世の中の常識は嘘である。
ということを証明するために、このメールを書いています。

「ブログはオワコン」
「SNSは毎日投稿」
「商品は時間をかけて作る」
「ステップメールは超大作を書く」

ぜーんぶ嘘です。
ポジショントークです。

なぜなら、これらを真に受けている人は、いつまで経っても労働から抜け出せないからです。

僕が提唱しているのは「仕組み化」です。
もっと言えば「フルオート化」です。

ブログも、SNSも、ステップメールも、商品作成も、
全てAIに任せて、自分は寝ていても売上が上がる状態を作る。

これが僕のゴールであり、あなたに提示するゴールです。

「そんなの無理だ」
「怪しい」
「詐欺だ」

そう思うなら、このメールは閉じてください。
一生、労働収入で疲弊し続けてください。

でも、もし少しでも「現状を変えたい」「楽をして稼ぎたい」と思うなら、
僕についてきてください。

（証拠動画１）を見ていただければわかるとおり、
僕のやり方なら、従来１ヶ月かかっていた作業が１０分で終わります。

（証拠動画２）を見ていただければわかるとおり、
ブログ記事なんて５分で書けます。

これが「現実」です。

あなたは、いつまで「嘘」を信じ続けますか？
`;

async function main() {
  const db = await getDb();
  if (!db) return;

  await db.update(ragDocuments)
    .set({ content: originalContent.trim() })
    .where(eq(ragDocuments.id, 1896));

  console.log(`Reverted RAG 1896. Length: ${originalContent.trim().length} chars.`);
}

main();
