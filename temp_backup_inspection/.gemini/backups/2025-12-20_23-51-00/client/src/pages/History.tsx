import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { AlertCircle, ArrowLeft, CheckCircle, Clock, Loader2, Video } from "lucide-react";
import { Link } from "wouter";

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const { data: analyses, isLoading, error } = trpc.video.listAnalyses.useQuery(undefined, {
    enabled: !!user,
  });

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

  if (error) {
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
            <p className="text-muted-foreground mb-4">{getErrorMessage(error)}</p>
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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processing":
        return (
          <div className="flex items-center gap-1 text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">処理中</span>
          </div>
        );
      case "completed":
        return (
          <div className="flex items-center gap-1 text-green-500">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">完了</span>
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center gap-1 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">失敗</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-card-foreground">{APP_TITLE}</h1>
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  ホーム
                </Button>
              </Link>
              <span className="text-sm text-muted-foreground">{user?.name}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-foreground">分析履歴</h2>
            <p className="text-muted-foreground">
              これまでに分析したYouTube動画の一覧です
            </p>
          </div>

          {!analyses || analyses.length === 0 ? (
            <Card className="bg-card text-card-foreground">
              <CardContent className="pt-6 text-center">
                <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  まだ分析した動画がありません
                </p>
                <Button asChild>
                  <Link href="/">動画を分析する</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {analyses.map((analysis) => (
                <Card key={analysis.id} className="bg-card text-card-foreground hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <CardTitle className="text-lg">
                          {analysis.title || "動画分析"}
                        </CardTitle>
                        <CardDescription className="break-all text-xs">
                          {analysis.youtubeUrl}
                        </CardDescription>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {formatDate(analysis.createdAt)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(analysis.status)}
                        {analysis.status === "completed" && (
                          <Button asChild size="sm">
                            <Link href={`/analysis/${analysis.id}`}>詳細を見る</Link>
                          </Button>
                        )}
                        {analysis.status === "processing" && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/analysis/${analysis.id}`}>進行状況</Link>
                          </Button>
                        )}
                        {analysis.status === "failed" && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/analysis/${analysis.id}`}>エラー詳細</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {analysis.summary && analysis.status === "completed" && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {analysis.summary}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
