declare module "google-trends-api" {
  export interface TrendsOptions {
    keyword: string | string[];
    geo?: string;
    hl?: string;
    startTime?: Date;
    endTime?: Date;
    category?: number;
  }

  export function interestOverTime(options: TrendsOptions): Promise<string>;
  export function relatedQueries(options: TrendsOptions): Promise<string>;
  export function relatedTopics(options: TrendsOptions): Promise<string>;
  export function interestByRegion(options: TrendsOptions): Promise<string>;

  const googleTrends: {
    interestOverTime: typeof interestOverTime;
    relatedQueries: typeof relatedQueries;
    relatedTopics: typeof relatedTopics;
    interestByRegion: typeof interestByRegion;
  };

  export default googleTrends;
}
