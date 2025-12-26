#!/usr/bin/env node
/**
 * YouTube動画分析のテストスクリプト
 * ローカル環境で動画分析機能を直接テストします
 * 
 * 実行方法: tsx test-video-analysis.mjs
 */

// TypeScriptファイルを動的にインポート
const { processYouTubeVideo } = await import("./server/videoProcessor.ts");

const videoUrl = "https://youtu.be/Z1uNCAu0y_8?si=B8NbrOLrAYnMFqI3";

console.log("=== YouTube動画分析テスト ===");
console.log(`動画URL: ${videoUrl}`);
console.log("");

try {
  console.log("[1/4] 動画のダウンロードと音声抽出を開始...");
  const result = await processYouTubeVideo(videoUrl);
  
  console.log("");
  console.log("=== 分析結果 ===");
  console.log(`動画ID: ${result.videoId}`);
  console.log(`タイトル: ${result.title}`);
  console.log("");
  
  console.log(`[2/4] 音声文字起こし: ${result.transcriptionSegments.length}セグメント`);
  if (result.transcriptionSegments.length > 0) {
    console.log("最初の3セグメント:");
    result.transcriptionSegments.slice(0, 3).forEach((seg, i) => {
      console.log(`  [${i + 1}] ${seg.start}s-${seg.end}s: ${seg.text.substring(0, 100)}...`);
    });
  }
  console.log("");
  
  console.log(`[3/4] 映像分析: ${result.frameAnalyses.length}フレーム`);
  if (result.frameAnalyses.length > 0) {
    console.log("最初の3フレーム:");
    result.frameAnalyses.slice(0, 3).forEach((frame, i) => {
      console.log(`  [${i + 1}] ${frame.timestamp}s: ${frame.visualDescription.substring(0, 150)}...`);
    });
  }
  console.log("");
  
  console.log("[4/4] 分析完了！");
  console.log("");
  console.log("=== サマリー ===");
  console.log(`- 総文字起こしセグメント数: ${result.transcriptionSegments.length}`);
  console.log(`- 総フレーム分析数: ${result.frameAnalyses.length}`);
  console.log(`- 動画タイトル: ${result.title}`);
  
} catch (error) {
  console.error("エラーが発生しました:");
  console.error(error);
  process.exit(1);
}

