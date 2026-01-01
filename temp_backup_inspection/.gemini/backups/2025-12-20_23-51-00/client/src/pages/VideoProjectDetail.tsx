import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { ArrowLeft, Film, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

export default function VideoProjectDetail() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const [selectedSlide, setSelectedSlide] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);

  const projectQuery = trpc.videoProject.getById.useQuery(
    { projectId },
    { enabled: !!user && projectId > 0 }
  );

  const slidesQuery = trpc.videoProject.getSlidesByScene.useQuery(
    { sceneId: selectedSceneId! },
    { enabled: selectedSceneId !== null }
  );

  const generateStructureMutation = trpc.videoProject.generateStructure.useMutation({
    onSuccess: () => {
      toast.success("動画構成を生成しました");
      projectQuery.refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  const generateVideoMutation = trpc.videoProject.generateVideo.useMutation({
    onSuccess: (data) => {
      toast.success("動画を生成しました");
      projectQuery.refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  const handleGenerateStructure = () => {
    if (confirm("RAGから戦略を取得して動画構成を生成します。よろしいですか？")) {
      generateStructureMutation.mutate({ projectId });
    }
  };

  const handleGenerateVideo = () => {
    if (confirm("スライドと音声を結合して動画を生成します。よろしいですか？")) {
      generateVideoMutation.mutate({ projectId });
    }
  };

  if (authLoading || projectQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!projectQuery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">プロジェクトが見つかりません</p>
          <Link href="/video-projects">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              プロジェクト一覧に戻る
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { project, scenes } = projectQuery.data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-card-foreground">{APP_TITLE}</h1>
            <Link href="/video-projects">
              <Button variant="ghost">
                <ArrowLeft className="w-4 h-4 mr-2" />
                プロジェクト一覧
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-6xl mx-auto">
          {/* Project Info */}
          <Card className="mb-6 bg-card text-card-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="w-6 h-6" />
                {project.title}
              </CardTitle>
              <CardDescription>{project.description || "説明なし"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">テーマ:</span> {project.theme}
                </div>
                <div>
                  <span className="font-semibold">ターゲット:</span>{" "}
                  {project.targetAudience || "未設定"}
                </div>
                <div>
                  <span className="font-semibold">ステータス:</span>{" "}
                  <span
                    className={
                      project.status === "completed"
                        ? "text-green-500"
                        : project.status === "generating"
                        ? "text-yellow-500"
                        : project.status === "failed"
                        ? "text-red-500"
                        : "text-muted-foreground"
                    }
                  >
                    {project.status === "draft"
                      ? "下書き"
                      : project.status === "generating"
                      ? "生成中"
                      : project.status === "completed"
                      ? "完了"
                      : "失敗"}
                  </span>
                </div>
                {project.duration && (
                  <div>
                    <span className="font-semibold">動画時間:</span> {project.duration}秒
                  </div>
                )}
              </div>

              {scenes.length === 0 && (
                <div className="mt-6">
                  <Button
                    onClick={handleGenerateStructure}
                    disabled={generateStructureMutation.isPending}
                    className="w-full"
                  >
                    {generateStructureMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        構成生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        RAGから動画構成を生成
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    蓄積された戦略を活用して、シナリオとスライドを自動生成します
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scenes */}
          {scenes.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-foreground">シーン一覧</h3>
              {scenes.map((scene) => (
                <Card key={scene.id} className="bg-card text-card-foreground">
                  <CardHeader>
                    <CardTitle>
                      シーン {scene.sceneNumber}: {scene.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">ナレーション原稿:</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {scene.script}
                        </p>
                      </div>
                      {scene.duration && (
                        <div className="text-sm">
                          <span className="font-semibold">推定時間:</span> {scene.duration}秒
                        </div>
                      )}
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSceneId(scene.id)}
                        >
                          <ImageIcon className="w-4 h-4 mr-2" />
                          スライドを表示
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Video Generation */}
          {scenes.length > 0 && project.status === "draft" && (
            <Card className="mt-6 bg-card text-card-foreground">
              <CardHeader>
                <CardTitle>動画生成</CardTitle>
                <CardDescription>
                  スライドと音声を結合して動画を生成します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleGenerateVideo}
                  disabled={generateVideoMutation.isPending}
                  className="w-full"
                >
                  {generateVideoMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      動画生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      動画を生成
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  生成には数分かかる場合があります
                </p>
              </CardContent>
            </Card>
          )}

          {/* Video Player */}
          {project.videoUrl && (
            <Card className="mt-6 bg-card text-card-foreground">
              <CardHeader>
                <CardTitle>生成された動画</CardTitle>
              </CardHeader>
              <CardContent>
                <video
                  src={project.videoUrl}
                  controls
                  className="w-full rounded-lg"
                >
                  お使いのブラウザは動画再生に対応していません。
                </video>
                <div className="mt-4 flex gap-2">
                  <Button asChild variant="outline">
                    <a href={project.videoUrl} download>
                      ダウンロード
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Slides Dialog */}
          <Dialog open={selectedSceneId !== null} onOpenChange={(open) => !open && setSelectedSceneId(null)}>
            <DialogContent className="max-w-4xl bg-card text-card-foreground">
              {slidesQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : slidesQuery.data && slidesQuery.data.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">スライド一覧</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {slidesQuery.data.map((slide) => (
                      <div
                        key={slide.id}
                        className="border border-border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => setSelectedSlide(slide.imageUrl || null)}
                      >
                        {slide.imageUrl ? (
                          <img
                            src={slide.imageUrl}
                            alt={`Slide ${slide.slideNumber}`}
                            className="w-full h-auto"
                          />
                        ) : (
                          <div className="w-full h-48 bg-muted flex items-center justify-center">
                            <p className="text-muted-foreground">画像なし</p>
                          </div>
                        )}
                        <div className="p-2 bg-muted">
                          <p className="text-sm font-semibold">スライド {slide.slideNumber}</p>
                          <p className="text-xs text-muted-foreground truncate">{slide.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">スライドがありません</p>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Slide Preview Dialog */}
          <Dialog open={selectedSlide !== null} onOpenChange={(open) => !open && setSelectedSlide(null)}>
            <DialogContent className="max-w-6xl bg-card text-card-foreground">
              {selectedSlide && (
                <img
                  src={selectedSlide}
                  alt="Slide preview"
                  className="w-full h-auto"
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
