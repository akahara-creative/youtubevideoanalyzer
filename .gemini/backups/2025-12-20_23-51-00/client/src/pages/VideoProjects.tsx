import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { ArrowLeft, Film, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function VideoProjects() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    theme: "",
    targetAudience: "",
  });

  const projectsQuery = trpc.videoProject.list.useQuery(undefined, {
    enabled: !!user,
  });

  const createMutation = trpc.videoProject.create.useMutation({
    onSuccess: (data) => {
      toast.success("プロジェクトを作成しました");
      setIsCreateDialogOpen(false);
      setNewProject({ title: "", description: "", theme: "", targetAudience: "" });
      projectsQuery.refetch();
      setLocation(`/video-projects/${data.projectId}`);
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  const deleteMutation = trpc.videoProject.delete.useMutation({
    onSuccess: () => {
      toast.success("プロジェクトを削除しました");
      projectsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  const handleCreate = () => {
    if (!newProject.title || !newProject.theme) {
      toast.error("タイトルとテーマは必須です");
      return;
    }
    createMutation.mutate(newProject);
  };

  const handleDelete = (projectId: number) => {
    if (confirm("本当に削除しますか？")) {
      deleteMutation.mutate({ projectId });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-card-foreground">{APP_TITLE}</h1>
            <Link href="/">
              <Button variant="ghost">
                <ArrowLeft className="w-4 h-4 mr-2" />
                ホーム
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
                <Film className="w-8 h-8" />
                動画生成プロジェクト
              </h2>
              <p className="text-muted-foreground">
                RAGに蓄積された戦略を活用して、動画を自動生成します
              </p>
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  新規プロジェクト
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card text-card-foreground">
                <DialogHeader>
                  <DialogTitle>新規プロジェクト作成</DialogTitle>
                  <DialogDescription>
                    動画のテーマとターゲット視聴者を入力してください
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">タイトル *</Label>
                    <Input
                      id="title"
                      value={newProject.title}
                      onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                      placeholder="例: プログラミング入門"
                      className="bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <Label htmlFor="theme">テーマ *</Label>
                    <Input
                      id="theme"
                      value={newProject.theme}
                      onChange={(e) => setNewProject({ ...newProject, theme: e.target.value })}
                      placeholder="例: Python基礎"
                      className="bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <Label htmlFor="targetAudience">ターゲット視聴者</Label>
                    <Input
                      id="targetAudience"
                      value={newProject.targetAudience}
                      onChange={(e) => setNewProject({ ...newProject, targetAudience: e.target.value })}
                      placeholder="例: プログラミング初心者"
                      className="bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">説明</Label>
                    <Textarea
                      id="description"
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      placeholder="プロジェクトの説明を入力してください"
                      className="bg-background text-foreground"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    キャンセル
                  </Button>
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        作成中...
                      </>
                    ) : (
                      "作成"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {projectsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : projectsQuery.data && projectsQuery.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectsQuery.data.map((project) => (
                <Card key={project.id} className="bg-card text-card-foreground hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{project.title}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(project.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      {project.description || "説明なし"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-semibold">テーマ:</span> {project.theme}
                      </div>
                      {project.targetAudience && (
                        <div>
                          <span className="font-semibold">ターゲット:</span> {project.targetAudience}
                        </div>
                      )}
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
                    </div>
                    <Link href={`/video-projects/${project.id}`}>
                      <Button className="w-full mt-4" variant="outline">
                        プロジェクトを開く
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-muted">
              <CardContent className="py-12 text-center">
                <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  まだプロジェクトがありません
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  最初のプロジェクトを作成
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
