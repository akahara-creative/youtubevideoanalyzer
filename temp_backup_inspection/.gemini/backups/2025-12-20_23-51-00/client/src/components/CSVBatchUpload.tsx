import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, AlertCircle, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CSVBatchUploadProps {
  autoEnhance: boolean;
  onBatchCreated?: (batchId: string) => void;
}

export default function CSVBatchUpload({ autoEnhance, onBatchCreated }: CSVBatchUploadProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createBatchJobMutation = trpc.seoArticle.createBatchJob.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setCsvFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      // バッチIDを親コンポーネントに通知
      if (data.batchId && onBatchCreated) {
        onBatchCreated(data.batchId);
      }
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const handleFileSelect = (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      toast.error("CSVファイルを選択してください");
      return;
    }
    setCsvFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const downloadTemplate = () => {
    const template = `テーマ,文字数,筆者名,自動加工\nAIツールの選び方,5000,赤原,true\nSEO対策の基本,3000,赤原,false\nマーケティング戦略,4000,山田,true`;
    
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'seo_batch_template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("テンプレートをダウンロードしました");
  };

  const handleUpload = async () => {
    if (!csvFile) {
      toast.error("CSVファイルを選択してください");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvContent = e.target?.result as string;
      createBatchJobMutation.mutate({ csvContent });
    };
    reader.readAsText(csvFile);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CSVバッチアップロード</CardTitle>
          <CardDescription>
            複数のテーマをCSVファイルでまとめてアップロードし、一括で記事生成を開始します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* CSV Format Example */}
          <div className="bg-muted p-4 rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">CSVフォーマット例：</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                テンプレートをダウンロード
              </Button>
            </div>
            <pre className="text-xs overflow-x-auto">
{`テーマ,文字数,筆者名,自動加工
AIツールの選び方,5000,赤原,true
SEO対策の基本,3000,赤原,false
マーケティング戦略,4000,山田,true`}
            </pre>
            <p className="text-xs text-muted-foreground">
              ※ ヘッダー行は必須です。自動加工はtrue/falseで指定します。
            </p>
          </div>

          {/* Drag & Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInputChange}
              className="hidden"
            />
            
            {csvFile ? (
              <div className="space-y-2">
                <FileText className="w-12 h-12 mx-auto text-primary" />
                <p className="font-medium">{csvFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(csvFile.size / 1024).toFixed(2)} KB
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCsvFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  ファイルを変更
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  CSVファイルをドラッグ&ドロップ
                </p>
                <p className="text-xs text-muted-foreground">または</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  ファイルを選択
                </Button>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <Button
            className="w-full"
            onClick={handleUpload}
            disabled={!csvFile || createBatchJobMutation.isPending}
          >
            {createBatchJobMutation.isPending ? "アップロード中..." : "バッチ生成を開始"}
          </Button>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-semibold">注意事項：</p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>CSVファイルはUTF-8エンコーディングで保存してください</li>
                <li>大量のテーマを一度にアップロードすると、処理に時間がかかります</li>
                <li>自動加工をtrueにすると、記事生成後に自動的にAIO要約・FAQ・JSON-LD・メタ情報が生成されます</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
