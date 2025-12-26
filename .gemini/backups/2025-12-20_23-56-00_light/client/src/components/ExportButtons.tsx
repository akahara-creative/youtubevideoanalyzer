import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { Download, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ExportButtonsProps {
  analysisId: number;
}

export function ExportButtons({ analysisId }: ExportButtonsProps) {
  const [isExportingMarkdown, setIsExportingMarkdown] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const exportMarkdownMutation = trpc.video.exportMarkdown.useMutation({
    onSuccess: (data) => {
      // Convert content to blob and download
      const blob = new Blob([data.content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsExportingMarkdown(false);
      toast.success("Markdownをダウンロードしました");
    },
    onError: (error) => {
      setIsExportingMarkdown(false);
      toast.error(`Markdownエクスポートに失敗しました: ${error.message}`);
    },
  });

  const exportPdfMutation = trpc.video.exportPdf.useMutation({
    onSuccess: (data) => {
      // Convert base64 to blob and download
      const byteCharacters = atob(data.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsExportingPdf(false);
      toast.success("PDFをダウンロードしました");
    },
    onError: (error) => {
      setIsExportingPdf(false);
      toast.error(`PDFエクスポートに失敗しました: ${error.message}`);
    },
  });

  const handleExportMarkdown = () => {
    setIsExportingMarkdown(true);
    exportMarkdownMutation.mutate({ analysisId });
  };

  const handleExportPdf = () => {
    setIsExportingPdf(true);
    exportPdfMutation.mutate({ analysisId });
  };

  const isLoading = isExportingMarkdown || isExportingPdf;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              エクスポート中...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              エクスポート
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover text-popover-foreground">
        <DropdownMenuItem
          onClick={handleExportMarkdown}
          disabled={isLoading}
          className="cursor-pointer"
        >
          <FileText className="w-4 h-4 mr-2" />
          Markdown形式
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleExportPdf}
          disabled={isLoading}
          className="cursor-pointer"
        >
          <FileText className="w-4 h-4 mr-2" />
          PDF形式
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
