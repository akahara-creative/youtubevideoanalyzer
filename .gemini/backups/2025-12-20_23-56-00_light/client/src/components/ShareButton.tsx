import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Check, Copy, Link2, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ShareButtonProps {
  analysisId: number;
  initialShareToken?: string | null;
  initialIsPublic?: number;
}

export function ShareButton({ analysisId, initialShareToken, initialIsPublic }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(
    initialShareToken && initialIsPublic === 1
      ? `${window.location.origin}/share/${initialShareToken}`
      : null
  );

  const generateShareMutation = trpc.video.generateShareLink.useMutation({
    onSuccess: (data) => {
      const fullUrl = `${window.location.origin}${data.shareUrl}`;
      setShareUrl(fullUrl);
      toast.success("共有リンクを生成しました");
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const disableSharingMutation = trpc.video.disableSharing.useMutation({
    onSuccess: () => {
      setShareUrl(null);
      toast.success("共有を無効にしました");
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleGenerateLink = () => {
    generateShareMutation.mutate({ analysisId });
  };

  const handleCopyLink = async () => {
    if (shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success("リンクをコピーしました");
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        toast.error("コピーに失敗しました");
      }
    }
  };

  const handleDisableSharing = () => {
    if (confirm("共有を無効にしますか? リンクは無効になります。")) {
      disableSharingMutation.mutate({ analysisId });
    }
  };

  const isLoading = generateShareMutation.isPending || disableSharingMutation.isPending;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Share2 className="w-4 h-4 mr-2" />
        共有
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>分析結果を共有</DialogTitle>
            <DialogDescription>
              共有リンクを生成して、他の人に分析結果を見せることができます
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!shareUrl ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  共有リンクを生成すると、認証なしで誰でもこの分析結果を閲覧できるようになります。
                </p>
                <Button
                  onClick={handleGenerateLink}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-2" />
                      共有リンクを生成
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">共有リンク</label>
                  <div className="flex gap-2">
                    <Input
                      value={shareUrl}
                      readOnly
                      className="flex-1 bg-muted text-foreground"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyLink}
                      disabled={copied}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    このリンクを共有すると、誰でもこの分析結果を閲覧できます
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCopyLink}
                    className="flex-1"
                    disabled={copied}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        コピー済み
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        リンクをコピー
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisableSharing}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "共有を無効化"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
