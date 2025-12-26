import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { Loader2, Plus, FolderOpen, Trash2, Edit, Target, TrendingUp, Download, Lightbulb } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function KeywordProjects() {
  const { user, loading: authLoading } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectTargetUrl, setNewProjectTargetUrl] = useState("");
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDescription, setEditProjectDescription] = useState("");
  const [editProjectTargetUrl, setEditProjectTargetUrl] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [analyzingKeywordId, setAnalyzingKeywordId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'in_progress' | 'completed'>('all');
  const [strategyDialogOpen, setStrategyDialogOpen] = useState(false);
  const [strategy, setStrategy] = useState<any>(null);

  const utils = trpc.useUtils();

  // プロジェクト一覧取得
  const { data: allProjects, isLoading: projectsLoading } =
    trpc.keywordProject.list.useQuery(undefined, {
      enabled: !!user,
    });

  // ステータスフィルタリング
  const projects = allProjects?.filter(p => 
    statusFilter === 'all' || p.status === statusFilter
  );

  // 選択されたプロジェクトのキーワード一覧取得
  const { data: keywords, isLoading: keywordsLoading } =
    trpc.keywordProject.getItems.useQuery(
      { projectId: selectedProject! },
      {
        enabled: !!selectedProject,
      }
    );

  // 保存された戦略データを取得
  const { data: savedStrategy, isLoading: strategyLoading } =
    trpc.keywordProject.getStrategy.useQuery(
      { projectId: selectedProject! },
      {
        enabled: !!selectedProject,
      }
    );

  // プロジェクト作成
  const createProjectMutation = trpc.keywordProject.create.useMutation({
    onSuccess: () => {
      toast.success("プロジェクトを作成しました");
      utils.keywordProject.list.invalidate();
      setCreateDialogOpen(false);
      setNewProjectName("");
      setNewProjectDescription("");
      setNewProjectTargetUrl("");
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  // プロジェクト更新
  const updateProjectMutation = trpc.keywordProject.update.useMutation({
    onSuccess: () => {
      toast.success("プロジェクトを更新しました");
      utils.keywordProject.list.invalidate();
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  // プロジェクト削除
  const deleteProjectMutation = trpc.keywordProject.delete.useMutation({
    onSuccess: () => {
      toast.success("プロジェクトを削除しました");
      utils.keywordProject.list.invalidate();
      if (selectedProject) {
        setSelectedProject(null);
      }
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  // キーワード追加
  const addKeywordMutation = trpc.keywordProject.addItem.useMutation({
    onSuccess: () => {
      toast.success("キーワードを追加しました");
      utils.keywordProject.getItems.invalidate();
      setNewKeyword("");
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  // キーワード削除
  const deleteKeywordMutation = trpc.keywordProject.deleteItem.useMutation({
    onSuccess: () => {
      toast.success("キーワードを削除しました");
      utils.keywordProject.getItems.invalidate();
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });
  // 戦略提案生成
  const generateStrategyMutation = trpc.keywordProject.generateStrategy.useMutation({
    onSuccess: (data) => {
      console.log("[Strategy Mutation] Success! Data:", data);
      setStrategy(data);
      setStrategyDialogOpen(true);
      console.log("[Strategy Mutation] Dialog opened:", true);
      toast.success("成長戦略を生成しました");
    },
    onError: (error) => {
      console.error("[Strategy Mutation] Error:", error);
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  // SEO分析実行
  const analyzeSEOMutation = trpc.keywordProject.analyzeSEO.useMutation({    onSuccess: () => {
      toast.success("SEO分析が完了しました");
      utils.keywordProject.getItems.invalidate();
      setAnalyzingKeywordId(null);
    },
    onError: (error) => {
      toast.error(`分析エラー: ${getErrorMessage(error)}`);
      setAnalyzingKeywordId(null);
    },
  });

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      toast.error("プロジェクト名を入力してください");
      return;
    }
    createProjectMutation.mutate({
      name: newProjectName,
      description: newProjectDescription || undefined,
      targetUrl: newProjectTargetUrl || undefined,
    });
  };

  const handleUpdateProject = () => {
    if (!selectedProject) return;
    if (!editProjectName.trim()) {
      toast.error("プロジェクト名を入力してください");
      return;
    }
    updateProjectMutation.mutate({
      id: selectedProject,
      name: editProjectName,
      description: editProjectDescription || undefined,
      targetUrl: editProjectTargetUrl || undefined,
    });
  };

  const handleDeleteProject = (projectId: number) => {
    if (confirm("このプロジェクトを削除してもよろしいですか？")) {
      deleteProjectMutation.mutate({ id: projectId });
    }
  };

  const handleAddKeyword = () => {
    if (!selectedProject) return;
    if (!newKeyword.trim()) {
      toast.error("キーワードを入力してください");
      return;
    }
    addKeywordMutation.mutate({
      projectId: selectedProject,
      keyword: newKeyword,
    });
  };

  const handleDeleteKeyword = (keywordId: number) => {
    if (confirm("このキーワードを削除してもよろしいですか？")) {
      deleteKeywordMutation.mutate({ id: keywordId });
    }
  };

  const handleAnalyzeSEO = (keywordId: number) => {
    setAnalyzingKeywordId(keywordId);
    analyzeSEOMutation.mutate({ keywordId });
  };

  const handleExportCSV = () => {
    if (!keywords || keywords.length === 0) return;

    const projectName = projects?.find((p) => p.id === selectedProject)?.name || "プロジェクト";
    
    // CSVヘッダー
    const headers = ["キーワード", "検索ボリューム", "競合性", "推奨出現回数"];
    
    // CSVデータ
    const rows = keywords.map((keyword) => [
      keyword.keyword,
      keyword.searchVolume?.toString() || "-",
      keyword.competition || "-",
      keyword.targetCount?.toString() || "-",
    ]);
    
    // CSV文字列を生成
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");
    
    // BOM付きUTF-8でエンコード（Excelで文字化け防止）
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    
    // ダウンロード
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${projectName}_keywords.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("キーワードをCSVエクスポートしました");
  };

  const handleEditProject = (project: any) => {
    setSelectedProject(project.id);
    setEditProjectName(project.name);
    setEditProjectDescription(project.description || "");
    setEditProjectTargetUrl(project.targetUrl || "");
    setEditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      draft: { label: "下書き", variant: "secondary" as const },
      in_progress: { label: "進行中", variant: "default" as const },
      completed: { label: "完了", variant: "outline" as const },
    };
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.draft;
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>ログインしてください</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">キーワードプロジェクト管理</h1>
        <p className="text-muted-foreground">
          複数のキーワードをプロジェクト単位で管理し、SEO分析を効率化します
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* プロジェクト一覧 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>プロジェクト一覧</CardTitle>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    新規作成
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新規プロジェクト作成</DialogTitle>
                    <DialogDescription>
                      キーワード選定プロジェクトを作成します
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">プロジェクト名 *</Label>
                      <Input
                        id="name"
                        placeholder="例: 健康食品ブログ"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">説明</Label>
                      <Textarea
                        id="description"
                        placeholder="プロジェクトの説明を入力"
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetUrl">対象URL</Label>
                      <Input
                        id="targetUrl"
                        placeholder="https://example.com"
                        value={newProjectTargetUrl}
                        onChange={(e) => setNewProjectTargetUrl(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleCreateProject}
                      disabled={createProjectMutation.isPending}
                    >
                      {createProjectMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      作成
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Label className="text-sm">ステータス:</Label>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="draft">下書き</SelectItem>
                  <SelectItem value="in_progress">進行中</SelectItem>
                  <SelectItem value="completed">完了</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {projects?.length || 0}件
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : projects && projects.length > 0 ? (
              <div className="space-y-2">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedProject === project.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedProject(project.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
                          <h3 className="font-medium truncate">{project.name}</h3>
                        </div>
                        {project.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {project.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={project.status}
                            onValueChange={(value) => {
                              updateProjectMutation.mutate({
                                id: project.id,
                                status: value as 'draft' | 'in_progress' | 'completed',
                              });
                            }}
                          >
                            <SelectTrigger className="w-[110px] h-7 text-xs">
                              <SelectValue>
                                {getStatusBadge(project.status)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">
                                <Badge variant="secondary">下書き</Badge>
                              </SelectItem>
                              <SelectItem value="in_progress">
                                <Badge variant="default">進行中</Badge>
                              </SelectItem>
                              <SelectItem value="completed">
                                <Badge variant="outline">完了</Badge>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log("[Strategy Button] Clicked for project:", project.id, project.name);
                            console.log("[Strategy Button] Mutation state:", {
                              isPending: generateStrategyMutation.isPending,
                              isError: generateStrategyMutation.isError,
                              error: generateStrategyMutation.error
                            });
                            generateStrategyMutation.mutate({ projectId: project.id });
                            console.log("[Strategy Button] Mutation triggered");
                          }}
                          disabled={generateStrategyMutation.isPending}
                          title="成長戦略を提案"
                        >
                          {generateStrategyMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Lightbulb className="h-4 w-4 text-yellow-500" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProject(project);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>プロジェクトがありません</p>
                <p className="text-sm">新規作成ボタンから作成してください</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* キーワード一覧 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedProject
                ? projects?.find((p) => p.id === selectedProject)?.name
                : "キーワード一覧"}
            </CardTitle>
            <CardDescription>
              {selectedProject
                ? "プロジェクトに登録されているキーワード"
                : "プロジェクトを選択してください"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedProject ? (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>左側からプロジェクトを選択してください</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* エクスポートボタンと戦略アドバイザーボタン */}
                <div className="flex justify-end gap-2 mb-2">
                  {savedStrategy && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setStrategy(savedStrategy);
                        setStrategyDialogOpen(true);
                      }}
                    >
                      <Lightbulb className="h-4 w-4 mr-2 text-yellow-500" />
                      戦略を表示
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      console.log("[Strategy Button] Clicked for project:", selectedProject);
                      console.log("[Strategy Button] Mutation state:", {
                        isPending: generateStrategyMutation.isPending,
                        isError: generateStrategyMutation.isError,
                        error: generateStrategyMutation.error
                      });
                      if (selectedProject) {
                        generateStrategyMutation.mutate({ projectId: selectedProject });
                        console.log("[Strategy Button] Mutation triggered");
                      }
                    }}
                    disabled={generateStrategyMutation.isPending || !keywords || keywords.length === 0}
                  >
                    {generateStrategyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Lightbulb className="h-4 w-4 mr-2 text-yellow-500" />
                    )}
                    {savedStrategy ? '戦略を再生成' : '成長戦略を提案'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportCSV()}
                    disabled={!keywords || keywords.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSVエクスポート
                  </Button>
                </div>

                {/* キーワード追加フォーム */}
                <div className="flex gap-2">
                  <Input
                    placeholder="キーワードを入力"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddKeyword();
                      }
                    }}
                  />
                  <Button
                    onClick={handleAddKeyword}
                    disabled={addKeywordMutation.isPending}
                  >
                    {addKeywordMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* キーワードテーブル */}
                {keywordsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : keywords && keywords.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>キーワード</TableHead>
                          <TableHead className="text-right">検索ボリューム</TableHead>
                          <TableHead className="text-right">競合性</TableHead>
                          <TableHead className="text-right">推奨出現回数</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keywords.map((keyword) => (
                          <TableRow key={keyword.id}>
                            <TableCell className="font-medium">
                              {keyword.keyword}
                            </TableCell>
                            <TableCell className="text-right">
                              {keyword.searchVolume
                                ? keyword.searchVolume.toLocaleString()
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {keyword.competition || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {keyword.targetCount ? keyword.targetCount : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAnalyzeSEO(keyword.id)}
                                  disabled={analyzingKeywordId === keyword.id}
                                >
                                  {analyzingKeywordId === keyword.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteKeyword(keyword.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <p>キーワードがありません</p>
                    <p className="text-sm">上のフォームから追加してください</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 戦略提案ダイアログ */}
      <Dialog open={strategyDialogOpen} onOpenChange={setStrategyDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ブログ成長戦略提案</DialogTitle>
            <DialogDescription>
              AIが分析したキーワードの優先順位とコンテンツ計画
            </DialogDescription>
          </DialogHeader>
          {strategy && (
            <div className="space-y-6 py-4">
              {/* 優先順位付けされたキーワード */}
              <div>
                <h3 className="text-lg font-semibold mb-3">キーワード優先順位</h3>
                <div className="space-y-3">
                  {strategy.prioritizedKeywords.map((kw: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={
                            kw.priority === "high"
                              ? "destructive"
                              : kw.priority === "medium"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {kw.priority === "high" ? "高" : kw.priority === "medium" ? "中" : "低"}
                        </Badge>
                        <span className="font-medium">{kw.keyword}</span>
                        <Badge variant="outline">{kw.estimatedDifficulty}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{kw.reason}</p>
                      <p className="text-sm">
                        <span className="font-medium">推奨文字数:</span> {kw.suggestedContentLength.toLocaleString()}文字
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* コンテンツ計画 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">コンテンツ計画</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">フェーズ1 (1-2ヶ月)</h4>
                    <ul className="space-y-1 text-sm">
                      {strategy.contentPlan.phase1.map((kw: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                          {kw}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">フェーズ2 (3-4ヶ月)</h4>
                    <ul className="space-y-1 text-sm">
                      {strategy.contentPlan.phase2.map((kw: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                          {kw}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">フェーズ3 (5-6ヶ月)</h4>
                    <ul className="space-y-1 text-sm">
                      {strategy.contentPlan.phase3.map((kw: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                          {kw}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 全体戦略 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">全体戦略</h3>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-sm whitespace-pre-wrap">{strategy.overallStrategy}</p>
                </div>
              </div>

              {/* 推定タイムライン */}
              <div>
                <h3 className="text-lg font-semibold mb-3">推定タイムライン</h3>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-sm whitespace-pre-wrap">{strategy.estimatedTimeline}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 編集ダイアログ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>プロジェクト編集</DialogTitle>
            <DialogDescription>
              プロジェクト情報を編集します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">プロジェクト名 *</Label>
              <Input
                id="edit-name"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">説明</Label>
              <Textarea
                id="edit-description"
                value={editProjectDescription}
                onChange={(e) => setEditProjectDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-targetUrl">対象URL</Label>
              <Input
                id="edit-targetUrl"
                value={editProjectTargetUrl}
                onChange={(e) => setEditProjectTargetUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleUpdateProject}
              disabled={updateProjectMutation.isPending}
            >
              {updateProjectMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
