CREATE TABLE `interview_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`position` int NOT NULL,
	`prompt` text NOT NULL,
	`answer` text,
	`score` int,
	`feedback` text,
	`idealAnswer` text,
	CONSTRAINT `interview_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interview_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` varchar(120) NOT NULL,
	`level` enum('foundation','practitioner','advanced') NOT NULL,
	`focus` varchar(120) NOT NULL,
	`status` enum('active','completed') NOT NULL DEFAULT 'active',
	`questionCount` int NOT NULL DEFAULT 5,
	`score` int,
	`strengths` text,
	`improvements` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `interview_sessions_id` PRIMARY KEY(`id`)
);
