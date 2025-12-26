CREATE TABLE `chatConversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255),
	`keywordProjectId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatConversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`ragContext` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contentChunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`longContentId` int NOT NULL,
	`chunkIndex` int NOT NULL,
	`content` text NOT NULL,
	`wordCount` int NOT NULL,
	`status` enum('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contentChunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contentImports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileType` enum('txt','docx','pdf') NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileSize` int,
	`extractedText` longtext,
	`category` varchar(100),
	`tags` text,
	`notes` text,
	`ragId` varchar(100),
	`isPinned` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contentImports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exportHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`analysisId` int NOT NULL,
	`exportType` enum('pdf','markdown') NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileSize` int,
	`category` varchar(100),
	`tags` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exportHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generatedContents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`conversationId` int,
	`contentType` enum('general','email','slide','script','longContent') NOT NULL,
	`title` varchar(255),
	`content` longtext NOT NULL,
	`keywordProjectId` int,
	`keywordCounts` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generatedContents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `keywordProjectItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`keyword` varchar(255) NOT NULL,
	`targetCount` int NOT NULL DEFAULT 0,
	`currentCount` int NOT NULL DEFAULT 0,
	`searchVolume` int,
	`competition` varchar(50),
	`seoAnalysisData` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `keywordProjectItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `keywordProjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`targetUrl` varchar(500),
	`status` enum('draft','in_progress','completed') NOT NULL DEFAULT 'draft',
	`strategyData` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `keywordProjects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `longContents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`prompt` text NOT NULL,
	`content` text,
	`targetWordCount` int,
	`actualWordCount` int,
	`status` enum('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
	`contentType` enum('blog','article','essay','report') NOT NULL DEFAULT 'blog',
	`tone` varchar(100),
	`keywords` text,
	`useRAGStyle` int NOT NULL DEFAULT 0,
	`seoScore` int,
	`ragId` varchar(100),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `longContents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promptTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`template` longtext NOT NULL,
	`variables` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promptTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ragDocumentTags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`tagId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ragDocumentTags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ragDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`content` longtext NOT NULL,
	`type` varchar(64) NOT NULL,
	`sourceId` varchar(255),
	`successLevel` enum('高','中','低'),
	`importance` int DEFAULT 0,
	`pickedUp` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ragDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seoArticleEnhancements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`userId` int NOT NULL,
	`originalArticle` longtext,
	`enhancedArticle` longtext,
	`aioSummary` longtext,
	`faqSection` longtext,
	`jsonLd` longtext,
	`metaInfo` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seoArticleEnhancements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seoArticleJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`theme` varchar(500) NOT NULL,
	`targetWordCount` int NOT NULL,
	`authorName` varchar(100) NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`currentStep` int DEFAULT 1,
	`progress` int DEFAULT 0,
	`keywords` longtext,
	`analyses` longtext,
	`criteria` longtext,
	`structure` longtext,
	`article` longtext,
	`qualityCheck` longtext,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seoArticleJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seoArticles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`theme` varchar(500) NOT NULL,
	`keywords` longtext,
	`analyses` longtext,
	`criteria` longtext,
	`structure` longtext,
	`article` longtext NOT NULL,
	`qualityCheck` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seoArticles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tagCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`description` text,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tagCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `tagCategories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`value` varchar(128) NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`color` varchar(7),
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `timelineSegments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysisId` int NOT NULL,
	`startTime` int NOT NULL,
	`endTime` int NOT NULL,
	`transcription` text,
	`visualDescription` text,
	`codeContent` text,
	`codeExplanation` text,
	`frameUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `timelineSegments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `videoAnalyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`youtubeUrl` varchar(500) NOT NULL,
	`videoId` varchar(100) NOT NULL,
	`title` text,
	`status` enum('processing','completed','failed') NOT NULL DEFAULT 'processing',
	`currentStep` varchar(100),
	`progress` int DEFAULT 0,
	`estimatedTimeRemaining` int,
	`stepProgress` text,
	`summary` text,
	`learningPoints` text,
	`errorMessage` text,
	`errorDetails` text,
	`shareToken` varchar(64),
	`isPublic` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videoAnalyses_id` PRIMARY KEY(`id`),
	CONSTRAINT `videoAnalyses_shareToken_unique` UNIQUE(`shareToken`)
);
--> statement-breakpoint
CREATE TABLE `videoBenchmarkAnalysis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`userId` int NOT NULL,
	`benchmarkVideos` longtext,
	`transcripts` longtext,
	`visualAnalysis` longtext,
	`summary` longtext,
	`sellerIntent` longtext,
	`targetPersonas` longtext,
	`personaReactions` longtext,
	`successFactors` longtext,
	`viralLaws` longtext,
	`savedToRAG` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videoBenchmarkAnalysis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `videoGenerationJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`theme` varchar(500) NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`currentStep` int DEFAULT 1,
	`progress` int DEFAULT 0,
	`estimatedTimeRemaining` int,
	`benchmarkAnalysisId` int,
	`strategyId` int,
	`scenarioId` int,
	`slideDesignId` int,
	`projectId` int,
	`errorMessage` text,
	`errorDetails` longtext,
	`retryCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `videoGenerationJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `videoProjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`theme` varchar(128),
	`targetAudience` varchar(255),
	`status` enum('draft','generating','completed','failed') NOT NULL DEFAULT 'draft',
	`videoUrl` varchar(512),
	`duration` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videoProjects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `videoScenario` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`userId` int NOT NULL,
	`hookContent` longtext,
	`hookDuration` int,
	`hookPurpose` longtext,
	`problemContent` longtext,
	`problemDuration` int,
	`problemPurpose` longtext,
	`solutionContent` longtext,
	`solutionDuration` int,
	`solutionPurpose` longtext,
	`ctaContent` longtext,
	`ctaDuration` int,
	`ctaPurpose` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videoScenario_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `videoScenes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sceneNumber` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`script` longtext NOT NULL,
	`duration` int,
	`audioUrl` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videoScenes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `videoSlideDesign` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`userId` int NOT NULL,
	`scenarioId` int NOT NULL,
	`slides` longtext,
	`fontFamily` varchar(100),
	`fontSize` int,
	`colorScheme` longtext,
	`layout` varchar(50),
	`ragReferences` longtext,
	`userRules` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videoSlideDesign_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `videoSlides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sceneId` int NOT NULL,
	`slideNumber` int NOT NULL,
	`content` longtext NOT NULL,
	`design` longtext,
	`imageUrl` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videoSlides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `videoStrategy` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`userId` int NOT NULL,
	`theme` varchar(500) NOT NULL,
	`trafficKeywords` longtext,
	`solutionKeywords` longtext,
	`hookStrategy` longtext,
	`problemStrategy` longtext,
	`solutionStrategy` longtext,
	`ragReferences` longtext,
	`userRules` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videoStrategy_id` PRIMARY KEY(`id`)
);
