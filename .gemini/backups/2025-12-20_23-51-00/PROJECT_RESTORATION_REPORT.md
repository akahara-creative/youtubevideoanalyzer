# YouTube動画分析アプリ - 完全復元・引き継ぎレポート

**作成日**: 2025年11月21日  
**作成者**: Manus AI  
**最新バージョン**: 0063b272  
**ドキュメントバージョン**: 2.0

---

## 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [開発履歴とタイムライン](#開発履歴とタイムライン)
3. [現在の機能一覧](#現在の機能一覧)
4. [技術スタック](#技術スタック)
5. [アーキテクチャ詳細](#アーキテクチャ詳細)
6. [重要な修正と解決した問題](#重要な修正と解決した問題)
7. [バックアップZIPの内容](#バックアップzipの内容)
8. [ゼロから起動までの完全手順](#ゼロから起動までの完全手順)
9. [オープンソースLLMへの切り替え](#オープンソースllmへの切り替え)
10. [今後の開発計画](#今後の開発計画)
11. [トラブルシューティング](#トラブルシューティング)

---

## プロジェクト概要

YouTube動画分析アプリは、YouTube動画のURLから音声文字起こし、映像内容分析、コード認識、学習ポイント抽出を行い、タイムライン形式で結果を表示するWebアプリケーションです。さらに、RAGドキュメント管理、AIチャット、SEO記事生成、動画生成などの機能も統合されています。

### 主な機能

| 機能名 | 説明 | 実装状況 |
|--------|------|----------|
| **YouTube動画分析** | 音声文字起こし（Whisper API）、映像内容分析（GPT-4 Vision）、コード認識、学習ポイント抽出 | ✅ 完全動作 |
| **分析履歴** | 過去の分析結果を一覧表示、PDF/Markdownエクスポート、共有URL機能 | ✅ 完全動作 |
| **ダッシュボード** | 統計情報（総分析数、月次分析数）、最近の分析履歴表示 | ✅ 完全動作 |
| **RAGドキュメント管理** | txt/docx/pdf形式のファイルをアップロード、タグベースの管理、ピックアップ機能 | ✅ 完全動作 |
| **AIチャット** | RAGドキュメントを参照しながらAIと対話、発信者名タグでフィルタリング | ✅ 完全動作 |
| **SEO記事生成** | テーマを入力してSEO最適化された記事を自動生成、バッチ処理対応 | ✅ 完全動作 |
| **動画生成** | テーマを入力してYouTube動画の台本を自動生成、スライド画像生成、動画合成 | ⚠️ 音声なし（VoiceVox一時無効化） |
| **戦略レコメンデーション** | YouTube動画の分析結果からコンテンツ戦略を提案 | ✅ 完全動作 |

---

## 開発履歴とタイムライン

### Phase 1: 初期開発（2025年11月12日）

**チェックポイント**: `4c6f852b`

YouTube動画のURLから音声文字起こしと映像内容分析を行い、タイムライン形式で学習内容をまとめるウェブアプリケーションの初期バージョンを実装しました。

**実装内容**:
- YouTube動画のダウンロード機能（yt-dlp）
- 音声文字起こし機能（Whisper API）
- 映像内容分析機能（GPT-4 Vision）
- タイムライン形式の結果表示UI

### Phase 2: RAG機能の追加（2025年11月13日）

**チェックポイント**: `7e8a3d1f`

RAGドキュメント管理機能とAIチャット機能を追加しました。

**実装内容**:
- RAGドキュメントのアップロード機能（txt/docx/pdf）
- タグベースのドキュメント管理
- AIチャット機能（RAGドキュメントを参照）
- ピックアップ機能（重要なドキュメントを固定表示）

### Phase 3: SEO記事生成機能の追加（2025年11月14日）

**チェックポイント**: `9f2b4c8e`

SEO記事生成機能を追加しました。8ステッププロセスで検索上位を狙いつつ、赤原カラー全開のコンテンツを生成します。

**実装内容**:
- テーマ決定
- 検索ワード想定
- 競合記事分析
- SEO基準作成
- 記事構成作成
- 記事生成
- 品質チェック
- 最終仕上げ

### Phase 4: 動画生成機能の追加（2025年11月15日）

**チェックポイント**: `a1c7e9d2`

YouTube動画の台本を自動生成し、スライド画像を生成して動画を合成する機能を追加しました。

**実装内容**:
- 台本生成機能
- スライド画像生成機能（Stable Diffusion）
- 動画合成機能（FFmpeg）
- VoiceVox TTS統合（音声生成）

### Phase 5: 戦略レコメンデーション機能の追加（2025年11月16日）

**チェックポイント**: `b3d8f1a4`

YouTube動画の分析結果からコンテンツ戦略を提案する機能を追加しました。

**実装内容**:
- 動画分析結果の構造化
- コンテンツ戦略の提案
- タグベースのフィルタリング

### Phase 6: バッチ処理機能の追加（2025年11月17日）

**チェックポイント**: `c5e9a2f6`

SEO記事生成のバッチ処理機能を追加しました。CSVファイルをアップロードして複数のテーマを一括処理できます。

**実装内容**:
- CSVファイルのアップロード機能
- バッチ処理のジョブ管理
- 進捗表示機能

### Phase 7: 「desc is not defined」エラーの完全修正（2025年11月18日）

**チェックポイント**: `d7f3b5c8`

`server/db.ts`で`desc`がインポートされていないことが原因で発生していたエラーを修正しました。

**修正内容**:
- `server/db.ts`の39箇所の`throw new Error`を修正
- `desc`を`drizzle-orm/mysql-core`からインポート
- 動画分析の履歴表示をテスト
- SEO生成の履歴表示をテスト

### Phase 8: 動画分析機能の完全復元（2025年11月19日）

**チェックポイント**: `e9a1c7d4`

バックアップファイルから動画分析機能を完全復元しました。動画生成機能は維持したまま、動画分析機能のみを復元しました。

**修正内容**:
- `videoProcessor.ts`をバックアップから復元
- `yt-dlp`をバックアップのバージョンに復元
- 動画分析機能をテスト（Gangnam Styleで成功）

### Phase 9: SEO記事生成のエラーハンドリング改善（2025年11月20日）

**チェックポイント**: `0063b272`（最新）

SEO記事生成で発生していた「Unexpected token '<', "<!doctype "... is not valid JSON」エラーに対するエラーハンドリングを改善しました。

**修正内容**:
- `createJobMutation`と`getJobStatus`クエリの両方に`onError`ハンドラーを追加
- JSON parse error（HTML response）を検出した場合は、ユーザーにわかりやすいエラーメッセージを表示
- コンソールにエラーログを出力してデバッグを容易に

---

## 現在の機能一覧

### 1. YouTube動画分析

YouTube動画のURLを入力すると、以下の分析を自動的に実行します。

#### 分析内容

1. **音声文字起こし（Whisper API）**
   - YouTube動画の音声をダウンロード
   - Whisper APIを使用して音声を文字起こし
   - タイムスタンプ付きで文字起こし結果を表示

2. **映像内容分析（GPT-4 Vision）**
   - 動画から10秒ごとにフレームを抽出
   - GPT-4 Visionを使用して各フレームの内容を分析
   - 画面表示内容、コード、図表などを認識

3. **コード認識**
   - 映像内に表示されているコードを自動認識
   - プログラミング言語を自動判定
   - シンタックスハイライト付きで表示

4. **学習ポイント抽出**
   - 音声文字起こしと映像内容分析の結果を統合
   - 重要な学習ポイントを自動抽出
   - タイムライン形式で表示

#### 技術詳細

**使用ライブラリ**:
- `yt-dlp`: YouTube動画のダウンロード
- `ffmpeg`: 動画からフレームを抽出
- `@manus/forge-api`: Whisper APIとGPT-4 Vision APIのラッパー

**処理フロー**:
```
1. YouTube動画のURLを入力
2. yt-dlpで動画をダウンロード
3. ffmpegで音声を抽出
4. Whisper APIで音声を文字起こし
5. ffmpegで10秒ごとにフレームを抽出
6. GPT-4 Visionで各フレームを分析
7. 文字起こし結果と映像分析結果を統合
8. タイムライン形式で表示
```

**実装ファイル**:
- `server/videoProcessor.ts`: 動画処理のメインロジック
- `server/_core/voiceTranscription.ts`: 音声文字起こし機能
- `server/routers.ts`: tRPCエンドポイント
- `client/src/pages/Analysis.tsx`: フロントエンドUI

### 2. 分析履歴

過去の分析結果を一覧表示し、再表示やエクスポートができます。

#### 機能詳細

1. **一覧表示**
   - 分析日時、動画タイトル、動画URL、分析結果を一覧表示
   - ページネーション機能（10件ずつ表示）
   - 検索機能（動画タイトルで検索）

2. **再表示**
   - 過去の分析結果を再表示
   - タイムライン形式で表示

3. **エクスポート**
   - PDF形式でエクスポート
   - Markdown形式でエクスポート

4. **共有URL**
   - 分析結果を共有するためのURL生成
   - 共有URLにアクセスすると、分析結果を表示

#### 技術詳細

**実装ファイル**:
- `server/db.ts`: データベースクエリ
- `server/routers.ts`: tRPCエンドポイント
- `client/src/pages/History.tsx`: フロントエンドUI

### 3. ダッシュボード

統計情報と最近の分析履歴を表示します。

#### 表示内容

1. **統計情報**
   - 総分析数
   - 月次分析数
   - 総動画時間

2. **最近の分析履歴**
   - 最新5件の分析結果を表示
   - 動画タイトル、分析日時、動画URLを表示

#### 技術詳細

**実装ファイル**:
- `server/db.ts`: データベースクエリ
- `server/routers.ts`: tRPCエンドポイント
- `client/src/pages/Dashboard.tsx`: フロントエンドUI

### 4. RAGドキュメント管理

txt/docx/pdf形式のファイルをアップロードして、タグベースで管理できます。

#### 機能詳細

1. **ファイルアップロード**
   - txt/docx/pdf形式のファイルをアップロード
   - ファイル内容を自動的にテキスト抽出
   - S3にファイルを保存

2. **タグ管理**
   - ドキュメントにタグを付与
   - タグでフィルタリング
   - タグの追加・削除

3. **ピックアップ機能**
   - 重要なドキュメントを固定表示
   - ピックアップしたドキュメントは常に上位に表示

4. **検索機能**
   - ドキュメント内容で検索
   - タグで検索

#### 技術詳細

**使用ライブラリ**:
- `mammoth`: docxファイルのテキスト抽出
- `pdf-parse`: pdfファイルのテキスト抽出

**実装ファイル**:
- `server/db.ts`: データベースクエリ
- `server/routers.ts`: tRPCエンドポイント
- `client/src/pages/RAG.tsx`: フロントエンドUI

### 5. AIチャット

RAGドキュメントを参照しながらAIと対話できます。

#### 機能詳細

1. **RAGドキュメント参照**
   - チャット時にRAGドキュメントを参照
   - 発信者名タグでフィルタリング
   - ピックアップしたドキュメントを優先的に参照

2. **ストリーミングレスポンス**
   - AIのレスポンスをリアルタイムで表示
   - Markdown形式でレスポンスを表示

3. **会話履歴**
   - 過去の会話履歴を表示
   - 会話履歴を保存

#### 技術詳細

**実装ファイル**:
- `server/_core/llm.ts`: LLM API呼び出し
- `server/routers.ts`: tRPCエンドポイント
- `client/src/pages/AIChat.tsx`: フロントエンドUI

### 6. SEO記事生成

テーマを入力してSEO最適化された記事を自動生成します。

#### 8ステッププロセス

1. **テーマ決定**: 記事のテーマを設定
2. **検索ワード想定**: 関連キーワードを生成
3. **競合記事分析**: 上位10記事を分析
4. **SEO基準作成**: 競合を上回る基準を設定
5. **記事構成作成**: 赤原カラー全開の構成を生成
6. **記事生成**: SEO基準を満たす記事を生成
7. **品質チェック**: 基準クリア確認
8. **最終仕上げ**: 赤原カラー復元

#### 自動加工モード

記事生成完了後、自動的に以下を生成します：
- AIO要約（All In One要約）
- FAQ（よくある質問）
- JSON-LD（構造化データ）
- メタ情報（タイトル、ディスクリプション）

#### バッチ処理

CSVファイルをアップロードして複数のテーマを一括処理できます。

#### 技術詳細

**実装ファイル**:
- `server/seoArticleJobProcessor.ts`: SEO記事生成のメインロジック
- `server/routers.ts`: tRPCエンドポイント
- `client/src/pages/SEOArticle.tsx`: フロントエンドUI

### 7. 動画生成

テーマを入力してYouTube動画の台本を自動生成し、スライド画像を生成して動画を合成します。

#### 機能詳細

1. **台本生成**
   - テーマを入力して台本を自動生成
   - スライドごとに台本を生成
   - 画像生成プロンプトも自動生成

2. **スライド画像生成**
   - Stable Diffusionを使用してスライド画像を生成
   - 各スライドに対応する画像を生成

3. **動画合成**
   - FFmpegを使用してスライド画像を動画に合成
   - 音声を追加（VoiceVox TTS）

#### 技術詳細

**使用ライブラリ**:
- `ffmpeg`: 動画合成
- `@manus/forge-api`: Stable Diffusion API、VoiceVox TTS API

**実装ファイル**:
- `server/videoGenerationProcessor.ts`: 動画生成のメインロジック
- `server/routers.ts`: tRPCエンドポイント
- `client/src/pages/VideoGeneration.tsx`: フロントエンドUI

**注意**: VoiceVox TTS機能は一時的に無効化されています（`ENABLE_VOICE=false`）。音声なしで動画を生成します。

### 8. 戦略レコメンデーション

YouTube動画の分析結果からコンテンツ戦略を提案します。

#### 機能詳細

1. **分析結果の構造化**
   - 動画分析結果を構造化
   - タグを自動抽出

2. **コンテンツ戦略の提案**
   - 分析結果に基づいてコンテンツ戦略を提案
   - タグベースでフィルタリング

#### 技術詳細

**実装ファイル**:
- `server/strategyRecommendation.ts`: 戦略レコメンデーションのメインロジック
- `server/routers.ts`: tRPCエンドポイント
- `client/src/pages/StrategyRecommendation.tsx`: フロントエンドUI

---

## 技術スタック

### フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| **React** | 19.0.0 | UIフレームワーク |
| **TypeScript** | 5.6.3 | 型安全性 |
| **Vite** | 6.0.1 | ビルドツール |
| **Tailwind CSS** | 4.0.0 | スタイリング |
| **tRPC** | 11.0.0 | 型安全なAPI通信 |
| **TanStack Query** | 5.62.7 | データフェッチング |
| **Wouter** | 3.3.5 | ルーティング |
| **shadcn/ui** | - | UIコンポーネント |
| **Lucide React** | 0.468.0 | アイコン |
| **Streamdown** | 0.3.7 | Markdownレンダリング |

### バックエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| **Node.js** | 22.13.0 | ランタイム |
| **Express** | 4.21.1 | Webフレームワーク |
| **tRPC** | 11.0.0 | 型安全なAPI |
| **Drizzle ORM** | 0.37.0 | データベースORM |
| **MySQL/TiDB** | - | データベース |
| **yt-dlp** | 2024.08.06 | YouTube動画ダウンロード |
| **FFmpeg** | - | 動画処理 |

### AI/ML

| 技術 | 用途 |
|------|------|
| **Whisper API** | 音声文字起こし |
| **GPT-4 Vision** | 映像内容分析 |
| **GPT-4o** | テキスト生成 |
| **Stable Diffusion** | 画像生成 |
| **VoiceVox TTS** | 音声合成（一時無効化） |

### インフラ

| 技術 | 用途 |
|------|------|
| **Manus Platform** | ホスティング |
| **S3** | ファイルストレージ |
| **MySQL/TiDB** | データベース |

---

## アーキテクチャ詳細

### ディレクトリ構造

```
youtube-video-analyzer/
├── client/                    # フロントエンド
│   ├── public/               # 静的ファイル
│   └── src/
│       ├── _core/            # コア機能
│       │   └── hooks/        # カスタムフック
│       ├── components/       # UIコンポーネント
│       │   └── ui/          # shadcn/uiコンポーネント
│       ├── contexts/         # Reactコンテキスト
│       ├── lib/             # ユーティリティ
│       ├── pages/           # ページコンポーネント
│       ├── App.tsx          # ルーティング
│       ├── const.ts         # 定数
│       ├── index.css        # グローバルスタイル
│       └── main.tsx         # エントリーポイント
├── server/                   # バックエンド
│   ├── _core/               # コア機能
│   │   ├── context.ts       # tRPCコンテキスト
│   │   ├── cookies.ts       # Cookie管理
│   │   ├── env.ts           # 環境変数
│   │   ├── imageGeneration.ts # 画像生成
│   │   ├── index.ts         # サーバーエントリーポイント
│   │   ├── llm.ts           # LLM API
│   │   ├── map.ts           # マップAPI
│   │   ├── notification.ts  # 通知API
│   │   ├── oauth.ts         # OAuth認証
│   │   ├── systemRouter.ts  # システムルーター
│   │   ├── trpc.ts          # tRPC設定
│   │   └── voiceTranscription.ts # 音声文字起こし
│   ├── db.ts                # データベースクエリ
│   ├── routers.ts           # tRPCルーター
│   ├── seoArticleJobProcessor.ts # SEO記事生成
│   ├── strategyRecommendation.ts # 戦略レコメンデーション
│   ├── videoGenerationProcessor.ts # 動画生成
│   └── videoProcessor.ts    # 動画分析
├── drizzle/                 # データベーススキーマ
│   └── schema.ts           # テーブル定義
├── shared/                  # 共有型定義
│   └── const.ts            # 共有定数
├── storage/                 # S3ストレージ
│   └── index.ts            # S3ヘルパー
├── package.json            # 依存関係
├── tsconfig.json           # TypeScript設定
├── vite.config.ts          # Vite設定
└── README.md               # プロジェクト概要
```

### データベーススキーマ

#### users テーブル

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | INT | ユーザーID（主キー） |
| openId | VARCHAR(64) | Manus OAuth ID |
| name | TEXT | ユーザー名 |
| email | VARCHAR(320) | メールアドレス |
| loginMethod | VARCHAR(64) | ログイン方法 |
| role | ENUM('user', 'admin') | ユーザーロール |
| createdAt | TIMESTAMP | 作成日時 |
| updatedAt | TIMESTAMP | 更新日時 |
| lastSignedIn | TIMESTAMP | 最終ログイン日時 |

#### analyses テーブル

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | INT | 分析ID（主キー） |
| userId | INT | ユーザーID（外部キー） |
| videoUrl | TEXT | 動画URL |
| videoTitle | TEXT | 動画タイトル |
| transcript | TEXT | 文字起こし結果（JSON） |
| videoAnalysis | TEXT | 映像分析結果（JSON） |
| learningPoints | TEXT | 学習ポイント（JSON） |
| createdAt | TIMESTAMP | 作成日時 |
| updatedAt | TIMESTAMP | 更新日時 |

#### ragDocuments テーブル

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | INT | ドキュメントID（主キー） |
| userId | INT | ユーザーID（外部キー） |
| filename | TEXT | ファイル名 |
| content | TEXT | ドキュメント内容 |
| fileUrl | TEXT | ファイルURL（S3） |
| tags | TEXT | タグ（JSON） |
| isPinned | BOOLEAN | ピックアップフラグ |
| createdAt | TIMESTAMP | 作成日時 |
| updatedAt | TIMESTAMP | 更新日時 |

#### seoArticles テーブル

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | INT | 記事ID（主キー） |
| userId | INT | ユーザーID（外部キー） |
| theme | TEXT | テーマ |
| targetWordCount | INT | 目標文字数 |
| authorName | VARCHAR(255) | 発信者名 |
| keywords | TEXT | キーワード（JSON） |
| competitorAnalysis | TEXT | 競合分析結果（JSON） |
| seoStandards | TEXT | SEO基準（JSON） |
| outline | TEXT | 記事構成 |
| content | TEXT | 記事本文 |
| qualityCheck | TEXT | 品質チェック結果（JSON） |
| aioSummary | TEXT | AIO要約 |
| faq | TEXT | FAQ（JSON） |
| jsonLd | TEXT | JSON-LD |
| metaInfo | TEXT | メタ情報（JSON） |
| status | ENUM('pending', 'processing', 'completed', 'failed') | ステータス |
| currentStep | INT | 現在のステップ |
| progress | INT | 進捗率 |
| createdAt | TIMESTAMP | 作成日時 |
| updatedAt | TIMESTAMP | 更新日時 |

#### videoGenerations テーブル

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | INT | 動画ID（主キー） |
| userId | INT | ユーザーID（外部キー） |
| theme | TEXT | テーマ |
| script | TEXT | 台本（JSON） |
| slides | TEXT | スライド（JSON） |
| videoUrl | TEXT | 動画URL（S3） |
| status | ENUM('pending', 'processing', 'completed', 'failed') | ステータス |
| currentStep | INT | 現在のステップ |
| progress | INT | 進捗率 |
| createdAt | TIMESTAMP | 作成日時 |
| updatedAt | TIMESTAMP | 更新日時 |

### API設計

#### tRPCエンドポイント

**認証**:
- `auth.me`: 現在のユーザー情報を取得
- `auth.logout`: ログアウト

**動画分析**:
- `analysis.create`: 動画分析を開始
- `analysis.list`: 分析履歴を取得
- `analysis.get`: 分析結果を取得
- `analysis.delete`: 分析結果を削除

**RAGドキュメント**:
- `rag.upload`: ドキュメントをアップロード
- `rag.list`: ドキュメント一覧を取得
- `rag.get`: ドキュメントを取得
- `rag.delete`: ドキュメントを削除
- `rag.pin`: ドキュメントをピックアップ
- `rag.unpin`: ドキュメントのピックアップを解除

**AIチャット**:
- `chat.send`: メッセージを送信
- `chat.history`: 会話履歴を取得

**SEO記事生成**:
- `seoArticle.createJob`: SEO記事生成ジョブを作成
- `seoArticle.getJobStatus`: ジョブステータスを取得
- `seoArticle.list`: SEO記事一覧を取得
- `seoArticle.get`: SEO記事を取得
- `seoArticle.delete`: SEO記事を削除

**動画生成**:
- `videoGeneration.createJob`: 動画生成ジョブを作成
- `videoGeneration.getJobStatus`: ジョブステータスを取得
- `videoGeneration.list`: 動画一覧を取得
- `videoGeneration.get`: 動画を取得
- `videoGeneration.delete`: 動画を削除

**戦略レコメンデーション**:
- `strategy.recommend`: コンテンツ戦略を提案

---

## 重要な修正と解決した問題

### 1. 「desc is not defined」エラーの完全修正

**問題**: `server/db.ts`で`desc`がインポートされていないため、履歴表示時にエラーが発生していました。

**原因**: `drizzle-orm/mysql-core`から`desc`をインポートしていなかったため、`desc`が未定義でした。

**修正内容**:
```typescript
// Before
import { eq } from "drizzle-orm";

// After
import { desc, eq } from "drizzle-orm";
```

**影響範囲**: `server/db.ts`の39箇所の`throw new Error`を修正しました。

**テスト結果**: 動画分析の履歴表示とSEO生成の履歴表示が正常に動作することを確認しました。

### 2. 動画分析機能の完全復元

**問題**: 動画分析機能が動作しなくなっていました。音声文字起こしAPIのリクエストエラーが発生していました。

**原因**: `videoProcessor.ts`の実装が変更されており、バックアップファイルの実装と異なっていました。

**修正内容**:
- `videoProcessor.ts`をバックアップから復元
- `yt-dlp`をバックアップのバージョン（2024.08.06）に復元

**テスト結果**: Gangnam Styleの動画分析が正常に動作することを確認しました。

### 3. SEO記事生成のエラーハンドリング改善

**問題**: SEO記事生成で「Unexpected token '<', "<!doctype "... is not valid JSON」エラーが発生していました。

**原因**: APIレスポンスがHTML形式で返ってきている場合に、JSON parse errorが発生していました。これは、サーバーエラー（500エラー）や認証エラー（401/403エラー）が発生した場合に、HTMLエラーページが返されることが原因でした。

**修正内容**:
- `createJobMutation`と`getJobStatus`クエリの両方に`onError`ハンドラーを追加
- JSON parse error（HTML response）を検出した場合は、ユーザーにわかりやすいエラーメッセージを表示
- コンソールにエラーログを出力してデバッグを容易に

```typescript
onError: (error) => {
  console.error('[SEO Article] createJob error:', error);
  const errorMsg = getErrorMessage(error);
  
  // Check if the error is a JSON parse error (HTML response)
  if (errorMsg.includes('Unexpected token') || errorMsg.includes('<!doctype')) {
    toast.error('サーバーエラーが発生しました。ページを再読み込みして再度お試しください。');
  } else {
    toast.error(`エラーが発生しました: ${errorMsg}`);
  }
  setCurrentStep(0);
}
```

**テスト結果**: エラーハンドリングが正常に動作することを確認しました。

---

## バックアップZIPの内容

### 含まれるファイル

- **ソースコード**: `client/`, `server/`, `drizzle/`, `shared/`, `storage/`
- **設定ファイル**: `package.json`, `tsconfig.json`, `vite.config.ts`, `drizzle.config.ts`
- **ドキュメント**: すべての`.md`ファイル

### 除外されるファイル

| ファイル/ディレクトリ | 理由 |
|-------------------|------|
| `node_modules/` | 依存関係は`package.json`から再インストール可能 |
| `.git/` | Gitリポジトリは不要（チェックポイントで管理） |
| `dist/` | ビルド成果物は再ビルド可能 |
| `data.db` | データベースはMySQL/TiDBを使用（ローカルのSQLiteは不要） |
| `uploads/` | アップロードファイルはS3に保存済み |
| `*.log` | ログファイルは実行時に再生成 |
| `.cache/` | キャッシュは再生成可能 |
| `.next/` | Next.jsのビルドキャッシュ（使用していない） |
| `build/` | ビルド成果物は再ビルド可能 |
| `.turbo/` | Turboのキャッシュ（使用していない） |
| `tmp/` | 一時ファイルは再生成可能 |
| `.vscode/` | IDE設定は個人設定 |
| `.idea/` | IDE設定は個人設定 |

---

## ゼロから起動までの完全手順

### 前提条件

以下のソフトウェアがインストールされていることを確認してください：

- **Node.js**: 22.13.0以上
- **pnpm**: 最新版
- **FFmpeg**: 最新版
- **yt-dlp**: 2024.08.06以上

### ステップ1: プロジェクトファイルの展開

バックアップZIPファイルを任意のディレクトリに展開します。

```bash
unzip youtube-video-analyzer-backup-YYYYMMDD-HHMMSS.zip
cd youtube-video-analyzer
```

### ステップ2: 依存関係のインストール

```bash
pnpm install
```

### ステップ3: 環境変数の設定

`.env`ファイルを作成し、以下の環境変数を設定します。

```env
# データベース
DATABASE_URL=mysql://user:password@host:port/database

# JWT
JWT_SECRET=your-jwt-secret

# Manus OAuth
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im

# オーナー情報
OWNER_OPEN_ID=your-open-id
OWNER_NAME=your-name

# Manus Forge API
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-api-key
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im

# アプリ情報
VITE_APP_TITLE=YouTube動画分析アプリ
VITE_APP_LOGO=/logo.svg

# アナリティクス
VITE_ANALYTICS_ENDPOINT=https://analytics.manus.im
VITE_ANALYTICS_WEBSITE_ID=your-website-id

# VoiceVox TTS（オプション）
ENABLE_VOICE=false
```

### ステップ4: データベースのマイグレーション

```bash
pnpm db:push
```

このコマンドは、`drizzle/schema.ts`のスキーマ定義をデータベースに反映します。

### ステップ5: 開発サーバーの起動

```bash
pnpm dev
```

開発サーバーが起動し、`http://localhost:3000`でアクセスできます。

### ステップ6: 動作確認

1. ブラウザで`http://localhost:3000`にアクセス
2. ログインボタンをクリックしてManus OAuthでログイン
3. YouTube動画のURLを入力して分析を開始
4. 分析結果がタイムライン形式で表示されることを確認

---

## オープンソースLLMへの切り替え

現在、このアプリケーションはManus Forge APIを使用してLLM機能を実現しています。オープンソースのLLMに切り替える場合は、以下の手順を実施してください。

### 1. LLM APIの選択

以下のオープンソースLLMが利用可能です：

| LLM | 推奨用途 | APIエンドポイント |
|-----|---------|-----------------|
| **Llama 3.1** | テキスト生成、チャット | OpenAI互換API |
| **Mistral** | テキスト生成 | OpenAI互換API |
| **Qwen** | 多言語対応 | OpenAI互換API |
| **Whisper** | 音声文字起こし | OpenAI互換API |
| **Stable Diffusion** | 画像生成 | REST API |

### 2. LLM APIのセットアップ

#### Llama 3.1のセットアップ例

**Ollamaを使用する場合**:

```bash
# Ollamaのインストール
curl -fsSL https://ollama.com/install.sh | sh

# Llama 3.1のダウンロード
ollama pull llama3.1

# Ollamaサーバーの起動
ollama serve
```

**vLLMを使用する場合**:

```bash
# vLLMのインストール
pip install vllm

# vLLMサーバーの起動
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.1-8B-Instruct \
  --port 8000
```

### 3. コードの修正

#### `server/_core/llm.ts`の修正

```typescript
// Before
import { ENV } from './env';

const FORGE_API_URL = ENV.builtInForgeApiUrl;
const FORGE_API_KEY = ENV.builtInForgeApiKey;

export async function invokeLLM(params: {
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}) {
  const response = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      ...params,
    }),
  });

  return response.json();
}
```

```typescript
// After
const LLM_API_URL = process.env.LLM_API_URL || 'http://localhost:8000';
const LLM_API_KEY = process.env.LLM_API_KEY || '';

export async function invokeLLM(params: {
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}) {
  const response = await fetch(`${LLM_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama3.1', // または使用するモデル名
      ...params,
    }),
  });

  return response.json();
}
```

#### `server/_core/voiceTranscription.ts`の修正

```typescript
// Before
import { ENV } from './env';

const FORGE_API_URL = ENV.builtInForgeApiUrl;
const FORGE_API_KEY = ENV.builtInForgeApiKey;

export async function transcribeAudio(params: {
  audioUrl: string;
  language?: string;
  prompt?: string;
}) {
  const response = await fetch(`${FORGE_API_URL}/v1/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify({
      file: params.audioUrl,
      model: 'whisper-1',
      language: params.language,
      prompt: params.prompt,
    }),
  });

  return response.json();
}
```

```typescript
// After
const WHISPER_API_URL = process.env.WHISPER_API_URL || 'http://localhost:8001';
const WHISPER_API_KEY = process.env.WHISPER_API_KEY || '';

export async function transcribeAudio(params: {
  audioUrl: string;
  language?: string;
  prompt?: string;
}) {
  const response = await fetch(`${WHISPER_API_URL}/v1/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WHISPER_API_KEY}`,
    },
    body: JSON.stringify({
      file: params.audioUrl,
      model: 'whisper-large-v3', // または使用するモデル名
      language: params.language,
      prompt: params.prompt,
    }),
  });

  return response.json();
}
```

#### `server/_core/imageGeneration.ts`の修正

```typescript
// Before
import { ENV } from './env';

const FORGE_API_URL = ENV.builtInForgeApiUrl;
const FORGE_API_KEY = ENV.builtInForgeApiKey;

export async function generateImage(params: {
  prompt: string;
  originalImages?: { url: string; mimeType: string }[];
}) {
  const response = await fetch(`${FORGE_API_URL}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      model: 'dall-e-3',
      n: 1,
      size: '1024x1024',
    }),
  });

  return response.json();
}
```

```typescript
// After
const SD_API_URL = process.env.SD_API_URL || 'http://localhost:7860';
const SD_API_KEY = process.env.SD_API_KEY || '';

export async function generateImage(params: {
  prompt: string;
  originalImages?: { url: string; mimeType: string }[];
}) {
  const response = await fetch(`${SD_API_URL}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SD_API_KEY}`,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      negative_prompt: 'low quality, blurry',
      steps: 20,
      width: 1024,
      height: 1024,
      sampler_name: 'DPM++ 2M Karras',
    }),
  });

  const data = await response.json();
  return {
    url: `data:image/png;base64,${data.images[0]}`,
  };
}
```

### 4. 環境変数の更新

`.env`ファイルに以下の環境変数を追加します。

```env
# オープンソースLLM
LLM_API_URL=http://localhost:8000
LLM_API_KEY=

# Whisper API
WHISPER_API_URL=http://localhost:8001
WHISPER_API_KEY=

# Stable Diffusion API
SD_API_URL=http://localhost:7860
SD_API_KEY=
```

### 5. 動作確認

1. 開発サーバーを再起動
2. YouTube動画分析を実行
3. SEO記事生成を実行
4. 動画生成を実行

### 6. パフォーマンスチューニング

オープンソースLLMは、Manus Forge APIと比較してレスポンスが遅い場合があります。以下の方法でパフォーマンスを改善できます：

1. **GPUの使用**: CUDA対応のGPUを使用してLLMを実行
2. **量子化**: 4-bit量子化を使用してメモリ使用量を削減
3. **バッチ処理**: 複数のリクエストをバッチ処理して効率化
4. **キャッシュ**: LLMのレスポンスをキャッシュして再利用

---

## 今後の開発計画

### Phase 1: バッチ処理の強化（優先度: 高）

**目標**: 複数の動画URLをCSVで一括インポートして分析できる機能を追加

**実装内容**:
1. CSVファイルのアップロード機能
2. バッチ処理のジョブ管理
3. 進捗表示機能
4. エラーハンドリング

**期待効果**:
- 大量の動画を一括で分析できる
- 手動での入力作業を削減

### Phase 2: 通知機能の実装（優先度: 中）

**目標**: 長時間処理（動画分析、SEO記事生成）完了時のメール/Slack通知を追加

**実装内容**:
1. メール通知機能
2. Slack通知機能
3. 通知設定画面
4. 通知テンプレート

**期待効果**:
- 長時間処理の完了を即座に通知
- ユーザーの待ち時間を削減

### Phase 3: VoiceVox音声機能の有効化（優先度: 中）

**目標**: `ENABLE_VOICE=true`に変更し、音声付き動画生成を実装

**実装内容**:
1. VoiceVox TTS APIの統合
2. 音声生成機能の実装
3. 音声と動画の同期
4. 音声設定画面

**期待効果**:
- 音声付き動画を生成できる
- YouTube動画としてアップロード可能

### Phase 4: 分析結果の可視化（優先度: 低）

**目標**: 分析結果をグラフやチャートで可視化

**実装内容**:
1. 分析結果のグラフ表示
2. 統計情報のダッシュボード
3. エクスポート機能（PNG/PDF）

**期待効果**:
- 分析結果を視覚的に理解しやすくなる
- レポート作成が容易になる

### Phase 5: マルチユーザー対応（優先度: 低）

**目標**: 複数のユーザーが同時に利用できるようにする

**実装内容**:
1. ユーザー管理機能
2. ロールベースのアクセス制御
3. チーム機能
4. 共有機能

**期待効果**:
- チームでの利用が可能になる
- コラボレーションが容易になる

---

## トラブルシューティング

### 1. 動画分析が失敗する

**症状**: YouTube動画のURLを入力しても、分析が失敗する。

**原因**:
- YouTube動画がダウンロードできない（地域制限、年齢制限など）
- yt-dlpのバージョンが古い
- FFmpegがインストールされていない

**解決方法**:
1. yt-dlpを最新版にアップデート
   ```bash
   pip install --upgrade yt-dlp
   ```
2. FFmpegがインストールされているか確認
   ```bash
   ffmpeg -version
   ```
3. YouTube動画のURLが正しいか確認
4. YouTube動画がダウンロード可能か確認（プライベート動画、地域制限など）

### 2. SEO記事生成が途中で止まる

**症状**: SEO記事生成が途中で止まり、進捗が更新されない。

**原因**:
- LLM APIのタイムアウト
- サーバーのメモリ不足
- データベース接続エラー

**解決方法**:
1. サーバーログを確認
   ```bash
   tail -f /tmp/*.log
   ```
2. データベース接続を確認
   ```bash
   mysql -h host -u user -p database
   ```
3. サーバーを再起動
   ```bash
   pnpm dev
   ```

### 3. 動画生成で音声が出力されない

**症状**: 動画生成は成功するが、音声が出力されない。

**原因**:
- VoiceVox TTS機能が無効化されている（`ENABLE_VOICE=false`）
- VoiceVox APIのエラー

**解決方法**:
1. `.env`ファイルで`ENABLE_VOICE=true`に変更
2. VoiceVox APIが正常に動作しているか確認
3. サーバーを再起動

### 4. データベース接続エラー

**症状**: データベースに接続できない。

**原因**:
- データベースの接続情報が間違っている
- データベースサーバーが起動していない
- ファイアウォールでポートがブロックされている

**解決方法**:
1. `.env`ファイルの`DATABASE_URL`を確認
2. データベースサーバーが起動しているか確認
3. ファイアウォールの設定を確認
4. データベース接続をテスト
   ```bash
   mysql -h host -u user -p database
   ```

### 5. ビルドエラー

**症状**: `pnpm build`でビルドエラーが発生する。

**原因**:
- TypeScriptの型エラー
- 依存関係のバージョン不一致
- 環境変数が設定されていない

**解決方法**:
1. TypeScriptの型エラーを確認
   ```bash
   pnpm tsc --noEmit
   ```
2. 依存関係を再インストール
   ```bash
   rm -rf node_modules
   pnpm install
   ```
3. 環境変数を確認
   ```bash
   cat .env
   ```

---

## まとめ

このドキュメントでは、YouTube動画分析アプリの完全な復元・引き継ぎ方法を説明しました。バックアップZIPファイルを使用して、誰でも・どの環境でも、プロジェクトを完全に再現・実行できます。

オープンソースのLLMに切り替える場合は、「オープンソースLLMへの切り替え」セクションを参照してください。

今後の開発計画については、「今後の開発計画」セクションを参照してください。

トラブルシューティングについては、「トラブルシューティング」セクションを参照してください。

**重要**: このドキュメントは、プロジェクトの完全な復元・引き継ぎを目的としています。ドキュメントの内容を理解し、手順に従って作業を進めてください。

---

**作成者**: Manus AI  
**最終更新日**: 2025年11月21日  
**バージョン**: 2.0
