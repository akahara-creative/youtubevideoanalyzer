# YouTube動画分析アプリ TODO

## 完了済み機能
- [x] プロジェクト初期化（tRPC + Manus Auth + Database）
- [x] 動画分析機能（YouTube動画のトランスクリプト取得と分析）
- [x] シナリオ生成機能（LLMによる動画シナリオ生成）
- [x] スライド生成機能（Puppeteerによるスライド画像生成）
- [x] 動画合成機能（ffmpegによる動画生成）
- [x] ジョブ管理システム（バックグラウンドワーカー）
- [x] 動画生成履歴表示
- [x] VoiceVox音声生成機能の一時的無効化（ENABLE_VOICEフラグで制御）
- [x] Puppeteer依存ライブラリのインストール確認
- [x] TypeScriptエラーの一部修正（154個→149個）
  - [x] textExtractor.ts: PDFParseの型エラー修正
  - [x] videoGenerator.ts: LLM content型の不一致修正
  - [x] strategyRecommendation.ts: LLM content型の不一致修正

## 未実装機能（Cursor移行後に実装予定）

### ⚠️ 最優先：VoiceVox音声生成機能
- [ ] **VoiceVox音声生成機能の実装**
  - 現在は一時的に無効化（ENABLE_VOICE=falseで制御）
  - VoiceVox APIの直接呼び出しで実装予定
  - レート制限を気にせず、複数チャンクを並列処理
  - 実装ファイル: `server/videoComposer.ts`, `server/voicevoxClient.ts`
  - **⚠️ 重要**: VoiceVox関連コードは削除せず、ENABLE_VOICEフラグで制御
  - **実装手順**:
    1. `server/videoComposer.ts`の`ENABLE_VOICE`を`true`に変更
    2. VoiceVox APIを直接呼び出す実装を完了（レート制限なし）
    3. 複数チャンクを並列処理できるように最適化
    4. 音声ダウンロード失敗時のリトライ処理を強化

## 修正が必要な問題（優先度低）

### TypeScriptエラー（149個）
これらのエラーは動画生成機能とは無関係の別機能のエラーです。動画生成機能の動作には影響しません。

- [ ] server/seoArticleJobProcessor.ts: overallScoreプロパティエラー
- [ ] server/strategyRecommendation.ts: strategiesプロパティエラー
- [ ] その他のTypeScriptエラー（約145個）

### その他の問題
- [ ] VoiceVox APIの音声ダウンロード失敗問題（"Downloaded audio buffer is empty"エラー）
  - Cursor環境で直接実装することで解決予定

## 将来的な機能拡張
- [ ] 音声品質の調整UI（VoiceVox話者ID、速度、ピッチ）
- [ ] 動画プレビュー機能（ブラウザ内プレビュー）
- [ ] SEO記事生成のCSVバッチ処理機能（複数テーマの一括生成）
  - 難易度: ★★☆☆☆（低～中）
  - 工数: 4日
  - 設計書: SEO_BATCH_AND_AUTO_PROCESSING_DESIGN.md
- [ ] SEO記事生成の自動加工モード（生成完了後に自動的にAIO要約・FAQ・JSON-LD・メタ情報を生成）
  - 難易度: ★☆☆☆☆（非常に低）
  - 工数: 0.5日（4時間）
  - 設計書: SEO_AUTO_PROCESSING_SIMPLIFIED.md
  - 既存の`enhanceArticle()`関数を活用

## Cursor移行時のチェックリスト
1. [ ] `server/videoComposer.ts`の`ENABLE_VOICE`を`true`に変更
2. [ ] VoiceVox APIを直接呼び出す実装を完了
3. [ ] 音声付き動画が正常に生成されることを確認
4. [ ] TypeScriptエラーの修正（必要に応じて）
5. [ ] 動画生成機能の完全なエンドツーエンドテスト


## Cursor移行時の重要ドキュメント

**必読**: `CURSOR_MIGRATION_GUIDE.md`を参照してください。

このガイドには以下の情報が含まれています：
1. TypeScriptエラー（149個）の詳細と修正方法
2. Manus組み込みAPIの置き換え方法（LLM、S3、Whisper）
3. データベース接続の継続利用方法
4. VoiceVox音声機能の実装手順
5. 環境変数の設定方法
6. 移行チェックリスト
7. トラブルシューティング


## ドキュメント

- [x] Cursor移行ガイド（CURSOR_MIGRATION_GUIDE.md）
- [x] 技術詳細ドキュメント（TECHNICAL_DOCUMENTATION.md）
- [x] 動画分析機能の超詳細ドキュメント（VIDEO_ANALYSIS_DEEP_DIVE.md）
- [x] 全機能の完全技術仕様書（COMPLETE_TECHNICAL_SPECIFICATION.md）
- [x] SEO記事生成のバッチ処理・自動加工機能の実装設計書（SEO_BATCH_AND_AUTO_PROCESSING_DESIGN.md）
- [x] SEO記事生成の自動加工機能の簡略化実装設計書（SEO_AUTO_PROCESSING_SIMPLIFIED.md）


## バックアップ

- [x] プロジェクトの完全バックアップZIP作成（youtube-video-analyzer-backup.zip）
  - サイズ: 5.5MB
  - 除外ファイル: node_modules, .git, dist, uploads, data.db, *.log, tmp, .cache, .next, build, .turbo, .vscode, .idea, coverage, .DS_Store
  - 含まれるドキュメント: README.md, PROJECT_HANDOVER_COMPLETE.md, SETUP_GUIDE.md, CURSOR_MIGRATION_GUIDE.md, COMPLETE_TECHNICAL_SPECIFICATION.md, VIDEO_ANALYSIS_DEEP_DIVE.md, TECHNICAL_DOCUMENTATION.md, その他全てのmdファイル


## 実装完了した機能（本セッション）

- [x] SEO記事生成のCSVバッチ処理機能
  - [x] データベーススキーマの拡張（autoEnhanceフラグ、batchIdフィールド、completedAt）
  - [x] CSVパーサーの作成（server/csvParser.ts）
  - [x] バックエンド実装（tRPCエンドポイント：createBatchJob、getBatchJobs、downloadBatch）
  - [x] CSVBatchUploadコンポーネントの作成（client/src/components/CSVBatchUpload.tsx）
  - [x] JobListコンポーネントの作成（client/src/components/JobList.tsx）
  - [x] SEOArticle.tsxへの統合（タブ切り替え、ジョブ一覧表示、チェックボックス選択、一括ダウンロード）
  - [x] 動作テスト完了（CSVアップロード、バッチ生成、ジョブ一覧表示）
- [x] SEO記事生成の自動加工モード
  - [x] ジョブプロセッサーに自動加工処理を追加（server/seoArticleJobProcessor.ts）
  - [x] seoArticle.createJobエンドポイントにautoEnhanceパラメータを追加
  - [x] フロントエンドに自動加工モードON/OFFスイッチを追加（SEOArticle.tsx）
  - [x] 動作テスト完了（自動加工モードON/OFF切り替え）
