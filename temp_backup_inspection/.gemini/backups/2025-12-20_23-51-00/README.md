# YouTube動画分析アプリ

YouTube動画の分析、AIチャット、RAGドキュメント管理、SEO記事生成、動画生成などの機能を統合したWebアプリケーションです。

## 主な機能

### 1. YouTube動画分析
- YouTube動画のURLを入力して、音声文字起こし（Whisper API）、映像内容分析、コード認識、学習ポイント抽出を実行
- 分析結果を履歴として保存し、後から参照可能

### 2. AIチャット
- RAGドキュメントを参照しながら、AIとチャットで対話
- 発信者名タグでRAGドキュメントをフィルタリングして、特定の発信者のスタイルで回答を生成

### 3. RAGドキュメント管理
- txt, docx, pdf形式のファイルをアップロードしてRAGドキュメントとして登録
- タグをチェックボックス形式で管理（生成ジャンル、発信者名、コンテンツタイプ、テーマ、重要度）
- ピックアップボタンで優先ドキュメントを指定
- タグ削除時にRAGドキュメントからも自動的に削除される連動削除機能

### 4. SEO記事生成
- テーマを入力して、SEO最適化された記事を自動生成
- 発信者名をドロップダウンで選択し、その発信者名タグ＋ピックアップされたRAGドキュメントのみを参照
- 生成された記事をWordPress形式でエクスポート可能

### 5. 動画生成
- テーマを入力して、YouTube動画の台本を自動生成
- 発信者名をドロップダウンで選択し、その発信者名タグ＋ピックアップされたRAGドキュメントのみを参照
- **⚠️ 音声機能について**: 現在VoiceVox音声生成機能は一時的に無効化されています（`ENABLE_VOICE=false`）。動画はサイレント音声トラックのみで生成されます。Cursor移行後にVoiceVox APIを直接実装予定です。

### 6. 戦略レコメンデーション
- YouTube動画の分析結果から、コンテンツ戦略を提案

## 技術スタック

- **フロントエンド**: React 19, Tailwind CSS 4, Wouter, shadcn/ui
- **バックエンド**: Express 4, tRPC 11, Drizzle ORM
- **データベース**: MySQL/TiDB
- **AI**: OpenAI API（GPT-4, Whisper）
- **認証**: Manus OAuth
- **ストレージ**: S3（Manus built-in）

## クイックスタート

### 前提条件
- Node.js 22.x
- pnpm
- MySQL/TiDB データベース

### セットアップ手順

1. **依存関係のインストール**
```bash
pnpm install
```

2. **環境変数の設定**
`.env`ファイルを作成し、以下の環境変数を設定します：
```
DATABASE_URL=mysql://user:password@host:port/database
JWT_SECRET=your-jwt-secret
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=your-owner-name
BUILT_IN_FORGE_API_URL=https://forge-api.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-api-key
VITE_FRONTEND_FORGE_API_URL=https://forge-api.manus.im
VITE_APP_TITLE=YouTube動画分析アプリ
VITE_APP_LOGO=/logo.svg
```

3. **データベースのマイグレーション**
```bash
pnpm db:push
```

4. **開発サーバーの起動**
```bash
pnpm dev
```

5. **ブラウザでアクセス**
```
http://localhost:3000
```

## プロジェクト構造

```
youtube-video-analyzer/
├── client/               # フロントエンドコード
│   ├── public/          # 静的ファイル
│   └── src/
│       ├── pages/       # ページコンポーネント
│       ├── components/  # 再利用可能なUIコンポーネント
│       ├── contexts/    # Reactコンテキスト
│       ├── hooks/       # カスタムフック
│       └── lib/         # ライブラリ（tRPCクライアントなど）
├── server/              # バックエンドコード
│   ├── _core/          # フレームワークコア（OAuth、tRPCなど）
│   ├── db.ts           # データベースヘルパー
│   └── routers.ts      # tRPCルーター
├── drizzle/            # データベーススキーマ
│   └── schema.ts
├── shared/             # 共有定数・型
└── storage/            # S3ヘルパー
```

## 主要なファイル

- `server/routers.ts` - tRPCプロシージャの定義
- `drizzle/schema.ts` - データベーステーブルの定義
- `client/src/App.tsx` - ルーティング設定
- `client/src/pages/Import.tsx` - RAGドキュメント管理ページ
- `client/src/pages/SEOArticle.tsx` - SEO記事生成ページ
- `server/seoArticleJobProcessor.ts` - SEO記事生成のバックグラウンド処理
- `server/videoComposer.ts` - 動画合成のメイン処理（ENABLE_VOICEフラグで音声制御）
- `server/voicevoxClient.ts` - VoiceVox API呼び出しロジック（DO NOT remove）

## 開発ワークフロー

1. **スキーマ変更** - `drizzle/schema.ts`を編集し、`pnpm db:push`を実行
2. **データベースヘルパー追加** - `server/db.ts`にクエリヘルパーを追加
3. **tRPCプロシージャ追加** - `server/routers.ts`にプロシージャを追加
4. **フロントエンドUI実装** - `client/src/pages/`にページコンポーネントを追加し、`trpc.*`フックを使用

## VoiceVox音声機能について（重要）

### 現在の状況
- VoiceVox音声生成機能は一時的に無効化されています（`server/videoComposer.ts`の`ENABLE_VOICE=false`で制御）
- 動画は**サイレント音声トラック**のみで生成されます
- VoiceVox関連のコードは削除せず保持しています

### Cursor移行時の実装手順
1. `server/videoComposer.ts`の`ENABLE_VOICE`を`true`に変更
2. VoiceVox APIを直接呼び出す実装を完了（レート制限なし）
3. 複数チャンクを並列処理できるように最適化
4. 音声ダウンロード失敗時のリトライ処理を強化

### 関連ファイル
- `server/videoComposer.ts`: 音声生成のメイン処理（ENABLE_VOICEフラグで制御）
- `server/voicevoxClient.ts`: VoiceVox API呼び出しロジック（Retry-Afterヘッダー読み取り、20回リトライ、テキスト分割実装済み）
- `server/videoRenderer.ts`: ffmpegによる動画レンダリング（サイレント音声トラック生成実装済み）

### 既知の問題
- VoiceVox APIの音声ダウンロードが失敗し続ける問題（"Downloaded audio buffer is empty"エラー）
- この問題はCursor環境で直接実装することで解決予定

## トラブルシューティング

詳細なトラブルシューティング情報は、`SETUP_GUIDE.md`を参照してください。

## ライセンス

MIT License

## 作成者

Manus AI
