import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ExportHistory } from "../../../drizzle/schema";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

interface EditExportDialogProps {
  exportItem: ExportHistory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditExportDialog({ exportItem, open, onOpenChange }: EditExportDialogProps) {
  const utils = trpc.useUtils();
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (exportItem) {
      setCategory(exportItem.category || "");
      try {
        const parsedTags = exportItem.tags ? JSON.parse(exportItem.tags) : [];
        setTags(Array.isArray(parsedTags) ? parsedTags : []);
      } catch {
        setTags([]);
      }
      setNotes(exportItem.notes || "");
    }
  }, [exportItem]);

  const updateMutation = trpc.exports.updateMetadata.useMutation({
    onSuccess: () => {
      utils.exports.list.invalidate();
      toast.success("メタデータを更新しました");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`更新に失敗しました: ${error.message}`);
    },
  });

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = () => {
    if (!exportItem) return;
    updateMutation.mutate({
      exportId: exportItem.id,
      category: category || null,
      tags,
      notes: notes || null,
    });
  };

  if (!exportItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle>エクスポート情報を編集</DialogTitle>
          <DialogDescription>
            カテゴリ、タグ、メモを追加して整理しましょう
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category">カテゴリ</Label>
            <Input
              id="category"
              placeholder="例: チュートリアル、講義、ドキュメント"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">タグ</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                placeholder="タグを入力してEnter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button type="button" onClick={handleAddTag} variant="outline">
                追加
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <div
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">メモ</Label>
            <Textarea
              id="notes"
              placeholder="このエクスポートについてのメモ"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
