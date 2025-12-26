import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Home, Loader2, Plus, Pencil, Trash2, Tag as TagIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function TagManagement() {
  const { user, loading: authLoading } = useAuth();
  const [isCreateCategoryDialogOpen, setIsCreateCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", displayName: "", description: "" });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<any>(null);
  const [newTag, setNewTag] = useState({ categoryId: 0, value: "", displayName: "", color: "#3B82F6" });

  const { data: tagsData, isLoading, refetch } = trpc.tags.getAllWithCategories.useQuery();
  const createTagMutation = trpc.tags.createTag.useMutation();
  const updateTagMutation = trpc.tags.updateTag.useMutation();
  const deleteTagMutation = trpc.tags.deleteTag.useMutation();
  const createCategoryMutation = trpc.tags.createCategory.useMutation();

  const handleCreateTag = async () => {
    if (!newTag.value || !newTag.displayName || !newTag.categoryId) {
      toast.error("すべてのフィールドを入力してください");
      return;
    }

    try {
      await createTagMutation.mutateAsync(newTag);
      toast.success("タグを作成しました");
      setIsCreateDialogOpen(false);
      setNewTag({ categoryId: 0, value: "", displayName: "", color: "#3B82F6" });
      refetch();
    } catch (error) {
      toast.error("タグの作成に失敗しました");
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name || !newCategory.displayName) {
      toast.error("必須フィールドを入力してください");
      return;
    }

    try {
      await createCategoryMutation.mutateAsync(newCategory);
      toast.success("カテゴリーを作成しました");
      setIsCreateCategoryDialogOpen(false);
      setNewCategory({ name: "", displayName: "", description: "" });
      refetch();
    } catch (error) {
      toast.error("カテゴリーの作成に失敗しました");
    }
  };

  const handleUpdateTag = async () => {
    if (!selectedTag) return;

    try {
      await updateTagMutation.mutateAsync({
        id: selectedTag.id,
        value: selectedTag.value,
        displayName: selectedTag.displayName,
        color: selectedTag.color,
      });
      toast.success("タグを更新しました");
      setIsEditDialogOpen(false);
      setSelectedTag(null);
      refetch();
    } catch (error) {
      toast.error("タグの更新に失敗しました");
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    if (!confirm("このタグを削除してもよろしいですか？")) return;

    try {
      await deleteTagMutation.mutateAsync({ tagId });
      toast.success("タグを削除しました");
      refetch();
    } catch (error) {
      toast.error("タグの削除に失敗しました");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>ログインが必要です</CardTitle>
            <CardDescription>タグ管理機能を使用するにはログインしてください</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">タグ管理</h1>
              <p className="text-muted-foreground">RAGシステムで使用するタグを管理します</p>
            </div>
          </div>
          <Dialog open={isCreateCategoryDialogOpen} onOpenChange={setIsCreateCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                カテゴリーを追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新しいカテゴリーを作成</DialogTitle>
                <DialogDescription>
                  タグをグループ化する新しいカテゴリーを作成します
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="cat-name">識別名（英数字）</Label>
                  <Input
                    id="cat-name"
                    placeholder="例: author, genre"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cat-displayName">表示名</Label>
                  <Input
                    id="cat-displayName"
                    placeholder="例: 著者、ジャンル"
                    value={newCategory.displayName}
                    onChange={(e) => setNewCategory({ ...newCategory, displayName: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cat-description">説明（任意）</Label>
                  <Input
                    id="cat-description"
                    placeholder="カテゴリーの説明"
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateCategoryDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleCreateCategory} disabled={createCategoryMutation.isPending}>
                  {createCategoryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  作成
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6">
          {tagsData?.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TagIcon className="h-5 w-5" />
                      {category.displayName}
                    </CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </div>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        onClick={() => setNewTag({ ...newTag, categoryId: category.id })}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        タグを追加
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>新しいタグを作成</DialogTitle>
                        <DialogDescription>
                          {category.displayName}カテゴリーに新しいタグを追加します
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="value">値（英数字）</Label>
                          <Input
                            id="value"
                            placeholder="例: seo, video, slide"
                            value={newTag.value}
                            onChange={(e) => setNewTag({ ...newTag, value: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="displayName">表示名</Label>
                          <Input
                            id="displayName"
                            placeholder="例: SEO記事、動画、スライド"
                            value={newTag.displayName}
                            onChange={(e) => setNewTag({ ...newTag, displayName: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="color">カラー</Label>
                          <Input
                            id="color"
                            type="color"
                            value={newTag.color}
                            onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                          キャンセル
                        </Button>
                        <Button onClick={handleCreateTag} disabled={createTagMutation.isPending}>
                          {createTagMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          作成
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {category.tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">タグがありません</p>
                  ) : (
                    category.tags.map((tag: any) => (
                      <div key={tag.id} className="flex items-center gap-1">
                        <Badge
                          style={{ backgroundColor: tag.color || "#3B82F6" }}
                          className="text-white"
                        >
                          {tag.displayName}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setSelectedTag(tag);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => handleDeleteTag(tag.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Edit Tag Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>タグを編集</DialogTitle>
              <DialogDescription>タグの情報を更新します</DialogDescription>
            </DialogHeader>
            {selectedTag && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-value">値（英数字）</Label>
                  <Input
                    id="edit-value"
                    value={selectedTag.value}
                    onChange={(e) => setSelectedTag({ ...selectedTag, value: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-displayName">表示名</Label>
                  <Input
                    id="edit-displayName"
                    value={selectedTag.displayName}
                    onChange={(e) => setSelectedTag({ ...selectedTag, displayName: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-color">カラー</Label>
                  <Input
                    id="edit-color"
                    type="color"
                    value={selectedTag.color || "#3B82F6"}
                    onChange={(e) => setSelectedTag({ ...selectedTag, color: e.target.value })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleUpdateTag} disabled={updateTagMutation.isPending}>
                {updateTagMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                更新
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
