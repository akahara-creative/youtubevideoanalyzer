import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorUtils";
import { ArrowLeft, Edit, Filter, Loader2, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function StrategySearch() {
  const { user, loading: authLoading } = useAuth();
  const [selectedFilters, setSelectedFilters] = useState<{
    genre: string[];
    contentType: string[];
    theme: string[];
    successLevel: string[];
  }>({
    genre: [],
    contentType: [],
    theme: [],
    successLevel: [],
  });
  const [editingStrategy, setEditingStrategy] = useState<{ id: number; content: string } | null>(null);
  const [editedContent, setEditedContent] = useState("");

  const utils = trpc.useUtils();

  // Get all tags
  const { data: tagsData } = trpc.tags.getAllWithCategories.useQuery(undefined, {
    enabled: !!user,
  });

  const updateMutation = trpc.strategy.update.useMutation({
    onSuccess: () => {
      toast.success("戦略を更新しました");
      setEditingStrategy(null);
      utils.strategy.search.invalidate();
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  const deleteMutation = trpc.strategy.delete.useMutation({
    onSuccess: () => {
      toast.success("戦略を削除しました");
      utils.strategy.search.invalidate();
    },
    onError: (error) => {
      toast.error(`エラー: ${getErrorMessage(error)}`);
    },
  });

  const handleEdit = (strategy: any) => {
    setEditingStrategy({ id: strategy.id, content: strategy.content });
    setEditedContent(strategy.content);
  };

  const handleSaveEdit = () => {
    if (editingStrategy) {
      updateMutation.mutate({
        documentId: editingStrategy.id,
        content: editedContent,
      });
    }
  };

  const handleDelete = (strategyId: number) => {
    if (confirm("本当に削除しますか？")) {
      deleteMutation.mutate({ documentId: strategyId });
    }
  };

  // Search strategies
  const { data: searchResults, isLoading: isSearching } = trpc.strategy.search.useQuery(
    {
      tagFilters: selectedFilters,
      limit: 50,
    },
    {
      enabled: !!user,
    }
  );

  const handleFilterChange = (category: keyof typeof selectedFilters, value: string, checked: boolean) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [category]: checked
        ? [...prev[category], value]
        : prev[category].filter((v) => v !== value),
    }));
  };

  const clearFilters = () => {
    setSelectedFilters({
      genre: [],
      contentType: [],
      theme: [],
      successLevel: [],
    });
  };

  const hasActiveFilters = Object.values(selectedFilters).some((arr) => arr.length > 0);

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
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-foreground mb-2">戦略検索</h2>
            <p className="text-muted-foreground">
              タグフィルターを使ってRAGに蓄積された戦略を検索できます
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filter Sidebar */}
            <div className="lg:col-span-1">
              <Card className="bg-card text-card-foreground sticky top-4">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Filter className="w-5 h-5" />
                      フィルター
                    </CardTitle>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        クリア
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {tagsData?.categories.map((category) => (
                    <div key={category.id}>
                      <h3 className="font-semibold mb-3 text-sm">{category.displayName}</h3>
                      <div className="space-y-2">
                        {category.tags.map((tag) => {
                          const categoryKey = category.name as keyof typeof selectedFilters;
                          const isChecked = selectedFilters[categoryKey]?.includes(tag.value) || false;
                          
                          return (
                            <label
                              key={tag.id}
                              className="flex items-center space-x-2 cursor-pointer"
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) =>
                                  handleFilterChange(categoryKey, tag.value, checked as boolean)
                                }
                              />
                              <span className="text-sm text-muted-foreground">
                                {tag.displayName}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Results */}
            <div className="lg:col-span-3">
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : searchResults && searchResults.strategies.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-4">
                    {searchResults.total}件の戦略が見つかりました
                  </div>
                  {searchResults.strategies.map((strategy) => (
                    <Card key={strategy.id} className="bg-card text-card-foreground">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <CardTitle className="text-base mb-2">{strategy.type}</CardTitle>
                            <CardDescription className="text-sm">
                              {strategy.content.substring(0, 200)}
                              {strategy.content.length > 200 && "..."}
                            </CardDescription>
                          </div>
                          {strategy.successLevel && (
                            <Badge variant={
                              strategy.successLevel === '高' ? 'default' :
                              strategy.successLevel === '中' ? 'secondary' : 'outline'
                            }>
                              {strategy.successLevel}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {strategy.tags.map((tag: any, index: number) => (
                            <Badge key={index} variant="outline">
                              {tag.tagDisplayName || tag.tagValue}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2 mb-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(strategy)}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            編集
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(strategy.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 mr-2 text-destructive" />
                            削除
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          作成日: {new Date(strategy.createdAt).toLocaleDateString('ja-JP')}
                          {strategy.sourceId && ` • ソース: ${strategy.sourceId}`}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-muted">
                  <CardContent className="py-12 text-center">
                    <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {hasActiveFilters
                        ? "条件に一致する戦略が見つかりませんでした"
                        : "フィルターを選択して戦略を検索してください"}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editingStrategy !== null} onOpenChange={(open) => !open && setEditingStrategy(null)}>
          <DialogContent className="max-w-2xl bg-card text-card-foreground">
            <DialogHeader>
              <DialogTitle>戦略を編集</DialogTitle>
              <DialogDescription>
                戦略の内容を編集してください
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={10}
              className="bg-background text-foreground"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingStrategy(null)}>
                キャンセル
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
