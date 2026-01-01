ALTER TABLE `seoArticleJobs` ADD `autoEnhance` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `seoArticleJobs` ADD `batchId` varchar(64);--> statement-breakpoint
ALTER TABLE `seoArticleJobs` ADD `completedAt` timestamp;