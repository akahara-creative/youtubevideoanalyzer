import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, CheckCircle2, XCircle, Clock, Ban } from "lucide-react";
import { toast } from "sonner";

interface JobListProps {
  batchId?: string;
}

export default function JobList({ batchId }: JobListProps) {
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  
  const { data: jobs = [], refetch } = trpc.seoArticle.getBatchJobs.useQuery(
    { batchId },
    { refetchInterval: 3000 } // 3秒ごとにポーリング
  );

  const cancelJobMutation = trpc.seoArticle.cancelJob.useMutation({
    onSuccess: () => {
      toast.success("ジョブをキャンセルしました");
      refetch();
    },
    onError: (error) => {
      toast.error(`キャンセルエラー: ${error.message}`);
    }
  });

  const downloadBatchMutation = trpc.seoArticle.downloadBatch.useMutation({
    onSuccess: (data) => {
      // Base64をBlobに変換してダウンロード
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("ダウンロードを開始しました");
      setSelectedJobIds([]); // 選択をクリア
    },
    onError: (error) => {
      toast.error(`ダウンロードエラー: ${error.message}`);
    }
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const completedJobIds = jobs
        .filter(job => job.status === "completed")
        .map(job => job.id);
      setSelectedJobIds(completedJobIds);
    } else {
      setSelectedJobIds([]);
    }
  };

  const handleSelectJob = (jobId: number, checked: boolean) => {
    if (checked) {
      setSelectedJobIds([...selectedJobIds, jobId]);
    } else {
      setSelectedJobIds(selectedJobIds.filter(id => id !== jobId));
    }
  };

  const handleDownloadSelected = () => {
    if (selectedJobIds.length === 0) {
      toast.error("ダウンロードするジョブを選択してください");
      return;
    }
    downloadBatchMutation.mutate({ jobIds: selectedJobIds });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            完了
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="default" className="bg-blue-500">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            処理中
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            待機中
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            失敗
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800">
            <Ban className="w-3 h-3 mr-1" />
            キャンセル済
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // 統計情報を計算
  const stats = {
    total: jobs.length,
    completed: jobs.filter(j => j.status === "completed").length,
    processing: jobs.filter(j => j.status === "processing").length,
    pending: jobs.filter(j => j.status === "pending").length,
    failed: jobs.filter(j => j.status === "failed").length,
  };

  const completedJobs = jobs.filter(j => j.status === "completed");
  const allCompletedSelected = completedJobs.length > 0 && 
    completedJobs.every(job => selectedJobIds.includes(job.id));

  return (
    <div className="space-y-4">
      {/* 統計情報 */}
      {jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>ジョブ統計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">総数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-sm text-muted-foreground">完了</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
                <div className="text-sm text-muted-foreground">処理中</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
                <div className="text-sm text-muted-foreground">待機中</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-sm text-muted-foreground">失敗</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ジョブ一覧 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>ジョブ一覧</CardTitle>
          {completedJobs.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allCompletedSelected}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm">完了済みを全選択</span>
              </div>
              <Button
                size="sm"
                onClick={handleDownloadSelected}
                disabled={selectedJobIds.length === 0 || downloadBatchMutation.isPending}
              >
                <Download className="w-4 h-4 mr-2" />
                選択したジョブをダウンロード ({selectedJobIds.length})
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {jobs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">ジョブがありません</p>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {job.status === "completed" && (
                    <Checkbox
                      checked={selectedJobIds.includes(job.id)}
                      onCheckedChange={(checked) => handleSelectJob(job.id, checked as boolean)}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium truncate">{job.theme}</h4>
                      {getStatusBadge(job.status)}
                      {job.autoEnhance === 1 && (
                        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950">
                          自動加工
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                      <span>{job.targetWordCount}文字</span>
                      <span>{job.authorName}</span>
                      <span>ステップ {job.currentStep}/8</span>
                      {job.status === "processing" && (
                        <span className="text-blue-600">進捗: {job.progress}%</span>
                      )}
                      {job.estimatedTimeRemaining && job.status === "processing" && (
                        <span className="text-muted-foreground">
                          残り約{Math.ceil(job.estimatedTimeRemaining / 60)}分
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(job.status === "pending" || job.status === "processing") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm("このジョブをキャンセルしますか？")) {
                            cancelJobMutation.mutate({ jobId: job.id });
                          }
                        }}
                        disabled={cancelJobMutation.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        キャンセル
                      </Button>
                    )}
                    {job.status === "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadBatchMutation.mutate({ jobIds: [job.id] })}
                        disabled={downloadBatchMutation.isPending}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        ダウンロード
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
