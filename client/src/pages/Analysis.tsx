import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { AlertCircle, ArrowLeft, CheckCircle, Clock, Code2, FileText, Loader2, Video, Sparkles, X, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { Streamdown } from "streamdown";
import { ExportButtons } from "@/components/ExportButtons";
import { ShareButton } from "@/components/ShareButton";
import { StrategyPreviewDialog } from "@/components/StrategyPreviewDialog";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

// Extract Strategy Button Component
function ExtractStrategyButton({ analysisId }: { analysisId: number }) {
  const [showPreview, setShowPreview] = useState(false);
  const [strategies, setStrategies] = useState<any>(null);
  
  const extractMutation = trpc.pdfStrategy.extractFromAnalysis.useMutation({
    onSuccess: (data) => {
      setStrategies(data.strategies);
      setShowPreview(true);
      toast.success(`${data.savedCount}件の戦略を抽出しました`);
    },
    onError: (error) => {
      toast.error(`戦略抽出に失敗しました: ${getErrorMessage(error)}`);
    },
  });

  const handleExtract = () => {
    extractMutation.mutate({ analysisId, successLevel: '高' });
  };

  return (
    <>
      <Button
        onClick={handleExtract}
        disabled={extractMutation.isPending}
        variant="outline"
        size="sm"
      >
        {extractMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            抽出中...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            戦略抽出
          </>
        )}
      </Button>

      {showPreview && strategies && (
        <StrategyPreviewDialog
          strategies={strategies}
          open={showPreview}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}

// Cancel Button Component
function CancelButton({ analysisId, onCancel }: { analysisId: number; onCancel: () => void }) {
  const cancelMutation = trpc.video.cancel.useMutation({
    onSuccess: () => {
      toast.success("分析を中断しました");
      onCancel();
    },
    onError: (error) => {
      toast.error(`中断に失敗しました: ${getErrorMessage(error)}`);
    },
  });

  return (
    <Button
      onClick={() => cancelMutation.mutate({ analysisId })}
      disabled={cancelMutation.isPending}
      variant="destructive"
      size="sm"
    >
      {cancelMutation.isPending ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          中断中...
        </>
      ) : (
        <>
          <X className="w-4 h-4 mr-2" />
          中断
        </>
      )}
    </Button>
  );
}

// Retry Button Component
/**
 * ステップ名を取得
 */
function getStepName(step: string): string {
  const stepNames: Record<string, string> = {
    download: "動画ダウンロード",
    transcription: "音声文字起こし",
    frameExtraction: "フレーム抽出",
    frameAnalysis: "フレーム分析",
    summary: "要約生成",
    completed: "完了",
  };
  return stepNames[step] || step || "処理中";
}

/**
 * ステップのメッセージを取得
 */
function getStepMessage(step: string): string {
  const messages: Record<string, string> = {
    download: "動画をダウンロードして音声を抽出しています...",
    transcription: "音声を文字起こししています。しばらくお待ちください...",
    frameExtraction: "動画からフレームを抽出しています...",
    frameAnalysis: "各フレームを分析しています。時間がかかる場合があります...",
    summary: "分析結果から要約を生成しています...",
    completed: "分析が完了しました",
  };
  return messages[step] || "動画を分析中です。しばらくお待ちください...";
}

/**
 * 処理ステップの詳細情報を取得
 */
function getProcessingSteps(currentStep: string, overallProgress: number) {
  const steps = [
    {
      name: "動画ダウンロード",
      stepKey: "download",
      progressRange: "0-20%",
      minProgress: 0,
      maxProgress: 20,
      description: "YouTubeから動画をダウンロードし、音声を抽出しています",
    },
    {
      name: "音声文字起こし",
      stepKey: "transcription",
      progressRange: "20-50%",
      minProgress: 20,
      maxProgress: 50,
      description: "抽出した音声をテキストに変換しています",
    },
    {
      name: "フレーム抽出",
      stepKey: "frameExtraction",
      progressRange: "50-55%",
      minProgress: 50,
      maxProgress: 55,
      description: "動画から分析用のフレームを抽出しています",
    },
    {
      name: "フレーム分析",
      stepKey: "frameAnalysis",
      progressRange: "55-90%",
      minProgress: 55,
      maxProgress: 90,
      description: "各フレームの内容をAIで分析しています",
    },
    {
      name: "要約生成",
      stepKey: "summary",
      progressRange: "90-95%",
      minProgress: 90,
      maxProgress: 95,
      description: "分析結果から要約と学習ポイントを生成しています",
    },
    {
      name: "完了",
      stepKey: "completed",
      progressRange: "95-100%",
      minProgress: 95,
      maxProgress: 100,
      description: "分析が完了しました",
    },
  ];

  return steps.map((step) => {
    const isActive = currentStep === step.stepKey;
    const isCompleted = overallProgress >= step.maxProgress;
    
    // 現在のステップ内での進捗を計算
    let stepProgress: number | undefined;
    if (isActive && overallProgress >= step.minProgress && overallProgress < step.maxProgress) {
      // ステップ内での進捗を0-100%で計算
      const stepRange = step.maxProgress - step.minProgress;
      const progressInStep = overallProgress - step.minProgress;
      stepProgress = Math.min(100, Math.max(0, (progressInStep / stepRange) * 100));
    } else if (isCompleted) {
      stepProgress = 100;
    }

    // フレーム分析の場合は詳細情報を追加
    let detail: string | undefined = step.description;
    if (isActive && step.stepKey === "frameAnalysis") {
      // stepProgressからフレーム数の推定（簡易版）
      // 実際のフレーム数はサーバーから取得する必要があるが、ここでは進捗から推定
      detail = step.description;
    }

    return {
      ...step,
      isActive,
      isCompleted,
      progress: stepProgress,
      detail,
    };
  });
}

function RetryButton({ analysisId, onRetryStart }: { analysisId: number; onRetryStart: () => void }) {
  const retryMutation = trpc.video.retry.useMutation({
    onSuccess: () => {
      toast.success("再試行を開始しました");
      onRetryStart();
    },
    onError: (error) => {
      toast.error(`再試行に失敗しました: ${getErrorMessage(error)}`);
    },
  });

  return (
    <Button
      onClick={() => retryMutation.mutate({ analysisId })}
      disabled={retryMutation.isPending}
      variant="default"
    >
      {retryMutation.isPending ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          再試行中...
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4 mr-2" />
          再試行
        </>
      )}
    </Button>
  );
}

export default function Analysis() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const analysisId = parseInt(id || "0");

  const { data, isLoading, error, refetch } = trpc.video.getAnalysis.useQuery(
    { analysisId },
    { enabled: !!analysisId && !!user, refetchInterval: (query) => {
      // Poll every 3 seconds if status is processing
      if (query?.state?.data?.analysis?.status === "processing") {
        return 3000;
      }
      return false;
    }}
  );

  useEffect(() => {
    if (data?.analysis?.status === "processing") {
      const interval = setInterval(() => {
        refetch();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [data?.analysis?.status, refetch]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md bg-card text-card-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              エラー
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {error?.message || "分析結果が見つかりませんでした"}
            </p>
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                ホームに戻る
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { analysis, segments } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-card-foreground">{APP_TITLE}</h1>
            <div className="flex items-center gap-4">
              <Link href="/history">
                <Button variant="ghost">分析履歴</Button>
              </Link>
              <Link href="/">
                <Button variant="ghost">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  ホーム
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Status Card */}
          <Card className="bg-card text-card-foreground">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <CardTitle>{analysis.title || "動画分析"}</CardTitle>
                  <CardDescription className="break-all">
                    {analysis.youtubeUrl}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {analysis.status === "processing" && (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-sm font-medium text-primary">処理中</span>
                    </>
                  )}
                  {analysis.status === "completed" && (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-sm font-medium text-green-500">完了</span>
                    </>
                  )}
                  {analysis.status === "failed" && (
                    <>
                      <AlertCircle className="w-5 h-5 text-destructive" />
                      <span className="text-sm font-medium text-destructive">失敗</span>
                    </>
                  )}
                  {analysis.status === "cancelled" && (
                    <>
                      <X className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">中断</span>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {analysis.status === "processing" && (
            <Card className="bg-card text-card-foreground">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">動画を分析中です</p>
                      <p className="text-sm text-muted-foreground">
                        {getStepMessage(analysis.currentStep || "")}
                      </p>
                    </div>
                  </div>
                  <CancelButton
                    analysisId={analysisId}
                    onCancel={() => {
                      refetch();
                    }}
                  />
                </div>
                
                {/* 全体進捗バー */}
                {analysis.progress !== null && analysis.progress !== undefined && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">全体進捗</span>
                      <span className="font-medium">{analysis.progress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div 
                        className="bg-primary h-3 rounded-full transition-all duration-300"
                        style={{ width: `${analysis.progress}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {/* 詳細ステップ表示 */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-sm font-semibold">処理ステップ</h4>
                  <div className="space-y-2">
                    {getProcessingSteps(analysis.currentStep || "", analysis.progress || 0).map((step, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border transition-colors ${
                          step.isActive
                            ? "bg-primary/10 border-primary"
                            : step.isCompleted
                            ? "bg-green-500/10 border-green-500/50"
                            : "bg-muted/50 border-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {step.isCompleted ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : step.isActive ? (
                              <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />
                            )}
                            <span className={`text-sm font-medium ${
                              step.isActive ? "text-primary" : step.isCompleted ? "text-green-500" : "text-muted-foreground"
                            }`}>
                              {step.name}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {step.progressRange}
                          </span>
                        </div>
                        {step.isActive && step.detail && (
                          <p className="text-xs text-muted-foreground ml-6 mt-1">
                            {step.detail}
                          </p>
                        )}
                        {step.isActive && step.progress !== undefined && (
                          <div className="mt-2 ml-6">
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${step.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {analysis.status === "failed" && (
            <Card className="bg-card text-card-foreground border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">分析に失敗しました</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{analysis.errorMessage}</p>
                
                {analysis.errorDetails && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      エラー詳細を表示
                    </summary>
                    <div className="mt-2 p-4 bg-muted rounded-md">
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(JSON.parse(analysis.errorDetails), null, 2)}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          navigator.clipboard.writeText(analysis.errorDetails!);
                          toast.success("エラー情報をコピーしました");
                        }}
                      >
                        コピー
                      </Button>
                    </div>
                  </details>
                )}
                
                <RetryButton analysisId={analysisId} onRetryStart={() => refetch()} />
              </CardContent>
            </Card>
          )}

              {analysis.status === "completed" && (
            <>
              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <ExtractStrategyButton analysisId={analysisId} />
                <ShareButton 
                  analysisId={analysisId}
                  initialShareToken={analysis.shareToken}
                  initialIsPublic={analysis.isPublic}
                />
                <ExportButtons analysisId={analysisId} />
              </div>

              {/* Summary Section */}
              {analysis.summary && (
                <Card className="bg-card text-card-foreground">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      動画の要約
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Streamdown>{analysis.summary}</Streamdown>
                  </CardContent>
                </Card>
              )}

              {/* Learning Points Section */}
              {analysis.learningPoints && (
                <Card className="bg-card text-card-foreground">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-primary" />
                      学習ポイント
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Streamdown>{analysis.learningPoints}</Streamdown>
                  </CardContent>
                </Card>
              )}

              {/* Timeline Segments */}
              {segments && segments.length > 0 && (
                <Card className="bg-card text-card-foreground">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      タイムライン
                    </CardTitle>
                    <CardDescription>
                      動画の各セグメントの詳細な分析結果
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {segments.map((segment) => (
                      <div
                        key={segment.id}
                        className="border-l-4 border-primary pl-4 space-y-3"
                      >
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                          <Clock className="w-4 h-4" />
                          {Math.floor(segment.startTime / 60)}:
                          {String(segment.startTime % 60).padStart(2, "0")} -{" "}
                          {Math.floor(segment.endTime / 60)}:
                          {String(segment.endTime % 60).padStart(2, "0")}
                        </div>

                        {segment.frameUrl && (
                          <div className="rounded-lg overflow-hidden border border-border">
                            <img
                              src={segment.frameUrl}
                              alt={`Frame at ${segment.startTime}s`}
                              className="w-full h-auto"
                            />
                          </div>
                        )}

                        {segment.transcription && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <FileText className="w-4 h-4" />
                              音声文字起こし
                            </div>
                            <p className="text-sm text-muted-foreground pl-6">
                              {segment.transcription}
                            </p>
                          </div>
                        )}

                        {segment.visualDescription && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <Video className="w-4 h-4" />
                              映像内容
                            </div>
                            <div className="text-sm text-muted-foreground pl-6">
                              <Streamdown>{segment.visualDescription}</Streamdown>
                            </div>
                          </div>
                        )}

                        {segment.codeContent && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <Code2 className="w-4 h-4" />
                              コード
                            </div>
                            <div className="pl-6">
                              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                                <code>{segment.codeContent}</code>
                              </pre>
                              {segment.codeExplanation && (
                                <div className="mt-2 text-sm text-muted-foreground">
                                  <Streamdown>{segment.codeExplanation}</Streamdown>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
