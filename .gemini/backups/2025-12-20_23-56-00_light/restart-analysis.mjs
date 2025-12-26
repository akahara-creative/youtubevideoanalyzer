/**
 * 分析を直接再実行するスクリプト
 */

import "dotenv/config";
import { processYouTubeVideo } from "./server/videoProcessor.ts";
import { updateVideoAnalysis, getVideoAnalysisByIdAndUser } from "./server/db.ts";
import { generateVideoSummary } from "./server/videoProcessor.ts";
import { createTimelineSegment } from "./server/db.ts";
import { addToRAG } from "./server/rag.ts";

const ANALYSIS_ID = 2;
const USER_ID = 1; // マスターユーザー

async function restartAnalysis() {
  console.log(`=== 分析ID ${ANALYSIS_ID} を直接再実行します ===\n`);
  
  try {
    // 分析情報を取得
    const analysis = await getVideoAnalysisByIdAndUser(ANALYSIS_ID, USER_ID);
    if (!analysis) {
      throw new Error("分析が見つかりませんでした");
    }
    
    console.log(`URL: ${analysis.youtubeUrl}`);
    console.log(`現在の状態: ${analysis.status}\n`);
    
    // 状態をprocessingにリセット
    await updateVideoAnalysis(ANALYSIS_ID, {
      status: "processing",
      errorMessage: null,
      errorDetails: null,
      currentStep: null,
      progress: 0,
    });
    console.log("✅ 分析の状態を 'processing' にリセットしました\n");
    
    // 動画処理を開始
    console.log("動画処理を開始します...");
    console.log("（この処理には数分かかる可能性があります）\n");
    
    const result = await processYouTubeVideo(analysis.youtubeUrl, {
      analysisId: ANALYSIS_ID,
      onProgress: async (step, progress, message) => {
        // 進捗をデータベースに保存
        await updateVideoAnalysis(ANALYSIS_ID, {
          currentStep: step,
          progress: Math.floor(progress),
          stepProgress: JSON.stringify({
            download: step === "download" ? progress : step === "transcription" ? 20 : 20,
            transcription: step === "transcription" ? progress : step === "frameExtraction" ? 50 : 50,
            frameExtraction: step === "frameExtraction" ? progress : step === "frameAnalysis" ? 55 : 55,
            frameAnalysis: step === "frameAnalysis" ? progress : step === "summary" ? 90 : 90,
            summary: step === "summary" ? progress : 100,
          }),
        });
        console.log(`[進捗] ${step}: ${progress}% - ${message || ""}`);
      },
    });
    
    console.log("\n✅ 動画処理が完了しました！");
    console.log(`タイトル: ${result.title}`);
    console.log(`文字起こしセグメント数: ${result.transcriptionSegments.length}`);
    console.log(`フレーム分析数: ${result.frameAnalyses.length}\n`);
    
    // 要約を生成 (90-95%)
    await updateVideoAnalysis(ANALYSIS_ID, {
      currentStep: "summary",
      progress: 90,
    });
    console.log("要約を生成中...");
    const { summary, learningPoints } = await generateVideoSummary(
      result.transcriptionSegments,
      result.frameAnalyses
    );
    console.log("✅ 要約が生成されました\n");
    
    // データベースを更新 (95-100%)
    console.log("データベースを更新中...");
    await updateVideoAnalysis(ANALYSIS_ID, {
      title: result.title,
      status: "completed",
      summary,
      learningPoints,
      currentStep: "completed",
      progress: 100,
    });
    console.log("✅ データベースを更新しました\n");
    
    // RAGに追加
    try {
      const ragText = `
タイトル: ${result.title}
URL: ${analysis.youtubeUrl}

要約:
${summary}

学習ポイント:
${learningPoints}

文字起こし:
${result.transcriptionSegments.map(seg => seg.text).join(" ")}
      `.trim();

      await addToRAG({
        id: `video_${ANALYSIS_ID}`,
        text: ragText,
        metadata: {
          type: "video_analysis",
          title: result.title,
          url: analysis.youtubeUrl,
          createdAt: new Date().toISOString(),
          analysisId: ANALYSIS_ID,
        },
      });
      console.log("✅ RAGに追加しました\n");
    } catch (ragError) {
      console.error("⚠️ RAGへの追加に失敗しました:", ragError);
    }
    
    // タイムラインセグメントを作成
    console.log("タイムラインセグメントを作成中...");
    for (const frameAnalysis of result.frameAnalyses) {
      const relevantTranscriptions = result.transcriptionSegments.filter(
        (seg) =>
          seg.start <= frameAnalysis.timestamp + 30 &&
          seg.end >= frameAnalysis.timestamp
      );

      await createTimelineSegment({
        analysisId: ANALYSIS_ID,
        startTime: frameAnalysis.timestamp,
        endTime: frameAnalysis.timestamp + 30,
        transcription: relevantTranscriptions.map((t) => t.text).join(" "),
        visualDescription: frameAnalysis.visualDescription,
        codeContent: frameAnalysis.codeContent,
        codeExplanation: frameAnalysis.codeExplanation,
        frameUrl: frameAnalysis.frameUrl,
      });
    }
    console.log(`✅ ${result.frameAnalyses.length}個のタイムラインセグメントを作成しました\n`);
    
    console.log("🎉 分析が正常に完了しました！");
    console.log(`\n📊 結果を確認:`);
    console.log(`  - URL: http://localhost:3000/analysis/${ANALYSIS_ID}`);
    
  } catch (error) {
    console.error("\n❌ エラーが発生しました:", error);
    
    // エラーをデータベースに記録
    try {
      await updateVideoAnalysis(ANALYSIS_ID, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        errorDetails: JSON.stringify({
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        }),
      });
      console.log("✅ エラーをデータベースに記録しました");
    } catch (dbError) {
      console.error("データベースへの記録に失敗しました:", dbError);
    }
    
    process.exit(1);
  }
}

restartAnalysis().catch(console.error);

