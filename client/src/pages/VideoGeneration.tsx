import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, Clock, CheckCircle2, XCircle, AlertCircle, User, Home, RefreshCw, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function VideoGeneration() {
  const [theme, setTheme] = useState("");
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<number>(3); // デフォルト: ずんだもん（ノーマル）

  // 話者一覧を取得
  const { data: speakers } = trpc.videoGeneration.getSpeakers.useQuery();

  const createJobMutation = trpc.videoGeneration.createJob.useMutation({
    onSuccess: (data) => {
      toast.success("動画生成ジョブを開始しました");
      setActiveJobId(data.jobId);
      setTheme("");
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  const { data: jobs, refetch: refetchJobs } = trpc.videoGeneration.listJobs.useQuery(undefined, {
    refetchInterval: 2000, // Poll every 2 seconds
  });
  const deleteJobMutation = trpc.videoGeneration.deleteJob.useMutation({
    onSuccess: () => {
      toast.success("ジョブを削除しました");
      refetchJobs();
    },
    onError: (error) => {
      toast.error(`削除エラー: ${getErrorMessage(error)}`);
    },
  });

  const retryJobMutation = trpc.videoGeneration.retryJob.useMutation({
    onSuccess: () => {
      toast.success("ジョブを再試行します");
      refetchJobs();
    },
    onError: (error) => {
      toast.error(`再試行エラー: ${getErrorMessage(error)}`);
    },
  });

  const handleDeleteJob = (jobId: number) => {
    if (confirm("このジョブを削除してもよろしいですか？")) {
      deleteJobMutation.mutate({ jobId });
    }
  };

  const handleRetryJob = (jobId: number) => {
    retryJobMutation.mutate({ jobId });
  };


  const { data: activeJob } = trpc.videoGeneration.getJobStatus.useQuery(
    { jobId: activeJobId! },
    {
      enabled: activeJobId !== null,
      refetchInterval: 2000, // Poll every 2 seconds
    }
  );

  const handleCreateJob = () => {
    if (!theme.trim()) {
      toast.error("テーマを入力してください");
      return;
    }

    createJobMutation.mutate({ 
      theme: theme.trim(),
      speakerId: selectedSpeakerId,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />待機中</Badge>;
      case "processing":
        return <Badge variant="default"><Loader2 className="w-3 h-3 mr-1 animate-spin" />処理中</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />完了</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />失敗</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStepName = (step: number) => {
    const steps = [
      "ベンチマーク動画を検索",
      "ベンチマーク動画を分析",
      "分析結果をRAGに保存",
      "戦略を設計",
      "シナリオを生成",
      "スライドを生成",
      "音声を生成",
      "動画を合成",
      "エクスポート",
    ];
    return steps[step - 1] || `ステップ ${step}`;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">動画生成</h1>
            <p className="text-muted-foreground">
              テーマを入力するだけで、ベンチマーク分析から動画生成まで自動で行います
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="/">
              <Home className="w-4 h-4 mr-2" />
              ホーム
            </a>
          </Button>
        </div>

        {/* Create Job Form */}
        <Card>
          <CardHeader>
            <CardTitle>新しい動画を生成</CardTitle>
            <CardDescription>
              動画のテーマを入力してください。ベンチマーク分析、戦略設計、シナリオ生成、スライド生成、動画合成まで自動で行われます。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  <User className="w-4 h-4 inline mr-1" />
                  ナレーション音声
                </label>
                <Select
                  value={selectedSpeakerId.toString()}
                  onValueChange={(value) => setSelectedSpeakerId(Number(value))}
                  disabled={createJobMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="話者を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {speakers?.map((speaker) => (
                      speaker.styles.map((style) => (
                        <SelectItem key={style.id} value={style.id.toString()}>
                          {speaker.name} - {style.name}
                        </SelectItem>
                      ))
                    )).flat()}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="例: SEOとかバズ、プレゼント企画、SNSマーケという人は全員ステップメールを書くべき理由"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateJob();
                    }
                  }}
                  disabled={createJobMutation.isPending}
                  className="flex-1"
                />
                <Button
                  onClick={handleCreateJob}
                  disabled={createJobMutation.isPending || !theme.trim()}
                >
                  {createJobMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      作成中...
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4 mr-2" />
                      動画生成
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Job Progress */}
        {activeJob && activeJob.status === "processing" && (
          <Card>
            <CardHeader>
              <CardTitle>生成中の動画</CardTitle>
              <CardDescription>{activeJob.theme}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{getStepName(activeJob.currentStep)}</span>
                  <span className="text-muted-foreground">{activeJob.progress}%</span>
                </div>
                <Progress value={activeJob.progress} className="h-2" />
              </div>

              {activeJob.estimatedTimeRemaining !== null && activeJob.estimatedTimeRemaining > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>残り時間: 約{formatTime(activeJob.estimatedTimeRemaining)}</span>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                開始: {new Date(activeJob.createdAt).toLocaleString("ja-JP")}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Jobs History */}
        <Card>
          <CardHeader>
            <CardTitle>動画生成履歴</CardTitle>
            <CardDescription>
              過去に生成した動画の一覧です
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!jobs || jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>まだ動画を生成していません</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <Card key={job.id} className="border">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(job.status)}
                            <span className="text-sm text-muted-foreground">
                              {new Date(job.createdAt).toLocaleString("ja-JP")}
                            </span>
                          </div>
                          <h3 className="font-medium">{job.theme}</h3>

                          {job.status === "processing" && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{getStepName(job.currentStep)}</span>
                                <span className="text-muted-foreground">{job.progress}%</span>
                              </div>
                              <Progress value={job.progress} className="h-1" />
                            </div>
                          )}

                          {job.status === "completed" && job.videoUrl && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => window.open(job.videoUrl!, "_blank")}
                              >
                                <Video className="w-4 h-4 mr-2" />
                                動画を見る
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    toast.info("ダウンロードを開始しています...");
                                    const response = await fetch(job.videoUrl!);
                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = `video-${job.id}.mp4`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    window.URL.revokeObjectURL(url);
                                    toast.success("ダウンロードが完了しました");
                                  } catch (error) {
                                    console.error("Download error:", error);
                                    toast.error("ダウンロードに失敗しました");
                                  }
                                }}
                              >
                                ダウンロード
                              </Button>
                            </div>
                          )}

                          {job.status === "failed" && job.errorMessage && (
                            <div className="space-y-2">
                              <div className="flex items-start gap-2 text-sm text-destructive">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{job.errorMessage}</span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetryJob(job.id)}
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                再試行
                              </Button>
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteJob(job.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
