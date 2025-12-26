import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";

interface StrategyItem {
  content: string;
  genre: string[];
  contentType: string[];
  theme: string[];
}

interface Strategies {
  slideDesignPatterns: StrategyItem[];
  timingStrategies: StrategyItem[];
  structurePatterns: StrategyItem[];
  explanationPatterns: StrategyItem[];
  aiStrategies: StrategyItem[];
  learningPoints: StrategyItem[];
}

interface StrategyPreviewDialogProps {
  strategies: Strategies;
  open: boolean;
  onClose: () => void;
}

function StrategyCard({ item, index }: { item: StrategyItem; index: number }) {
  return (
    <Card className="bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-base">戦略 #{index + 1}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{item.content}</p>
        <div className="flex flex-wrap gap-2">
          {item.genre.map((tag, i) => (
            <Badge key={`genre-${i}`} variant="secondary">
              {tag}
            </Badge>
          ))}
          {item.contentType.map((tag, i) => (
            <Badge key={`type-${i}`} variant="outline">
              {tag}
            </Badge>
          ))}
          {item.theme.map((tag, i) => (
            <Badge key={`theme-${i}`} variant="default">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function StrategyPreviewDialog({
  strategies,
  open,
  onClose,
}: StrategyPreviewDialogProps) {
  const categories = [
    { key: "slideDesignPatterns", label: "スライドデザイン", icon: "🎨" },
    { key: "timingStrategies", label: "タイミング戦略", icon: "⏱️" },
    { key: "structurePatterns", label: "構成パターン", icon: "📐" },
    { key: "explanationPatterns", label: "説明パターン", icon: "💬" },
    { key: "aiStrategies", label: "AI活用戦略", icon: "🤖" },
    { key: "learningPoints", label: "学習ポイント", icon: "📚" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-background text-foreground">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>戦略抽出結果</DialogTitle>
              <DialogDescription>
                PDFから抽出された戦略的知見を確認できます
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="slideDesignPatterns" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            {categories.map((cat) => (
              <TabsTrigger key={cat.key} value={cat.key} className="text-xs">
                <span className="mr-1">{cat.icon}</span>
                <span className="hidden sm:inline">{cat.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => {
            const items = strategies[cat.key as keyof Strategies] || [];
            return (
              <TabsContent key={cat.key} value={cat.key} className="space-y-4 mt-4">
                {items.length === 0 ? (
                  <Card className="bg-muted">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      このカテゴリーには戦略が抽出されませんでした
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <StrategyCard key={index} item={item} index={index} />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
