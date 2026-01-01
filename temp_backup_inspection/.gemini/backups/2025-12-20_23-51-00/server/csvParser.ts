import Papa from 'papaparse';

export interface CSVRow {
  theme: string;
  targetWordCount: number;
  authorName: string;
  autoEnhance: boolean;
}

/**
 * Parse CSV content and return array of SEO article job data
 */
export function parseCSV(csvContent: string): CSVRow[] {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8',
  });

  if (result.errors.length > 0) {
    throw new Error(`CSV parsing error: ${result.errors[0].message}`);
  }

  return result.data.map((row: any) => {
    const theme = row['テーマ'] || row['theme'] || '';
    const targetWordCount = parseInt(row['文字数'] || row['targetWordCount'] || '3000');
    const authorName = row['筆者名'] || row['authorName'] || '赤原';
    const autoEnhanceValue = row['自動加工'] || row['autoEnhance'] || 'false';
    const autoEnhance = autoEnhanceValue === 'true' || autoEnhanceValue === 'TRUE' || autoEnhanceValue === '1';

    if (!theme) {
      throw new Error('テーマが指定されていない行があります');
    }

    return {
      theme,
      targetWordCount: isNaN(targetWordCount) ? 3000 : targetWordCount,
      authorName,
      autoEnhance,
    };
  });
}

/**
 * Generate batch ID (unique identifier for a batch of jobs)
 */
export function generateBatchId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `batch_${timestamp}_${random}`;
}
