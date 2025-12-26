import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle, Clock, Code2, FileText, Home, Loader2, Video } from "lucide-react";
import { Link, useParams } from "wouter";
import { Streamdown } from "streamdown";

export default function SharedAnalysis() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = trpc.video.getSharedAnalysis.useQuery(
    { shareToken: token || "" },
    { enabled: !!token }
  );

  if (isLoading) {
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
              {error?.message || "共有された分析結果が見つかりませんでした"}
            </p>
            <Button asChild>
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
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
            <Button asChild variant="outline">
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                ホーム
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Info Banner */}
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="pt-6">
              <p className="text-sm text-foreground">
                これは共有された分析結果です。元の分析者によって公開されています。
              </p>
            </CardContent>
          </Card>

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
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-green-500">完了</span>
                </div>
              </div>
            </CardHeader>
          </Card>

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

          {/* CTA Section */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                あなたもYouTube動画を分析してみませんか?
              </p>
              <Button asChild>
                <Link href="/">今すぐ始める</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
