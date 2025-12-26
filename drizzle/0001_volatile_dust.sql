ALTER TABLE `videoGenerationJobs` ADD `videoUrl` text;--> statement-breakpoint
ALTER TABLE `videoStrategy` ADD `targetAudience` varchar(500);--> statement-breakpoint
ALTER TABLE `videoStrategy` ADD `painPoints` longtext;--> statement-breakpoint
ALTER TABLE `videoStrategy` ADD `desiredOutcome` text;--> statement-breakpoint
ALTER TABLE `videoStrategy` ADD `uniqueValueProposition` text;