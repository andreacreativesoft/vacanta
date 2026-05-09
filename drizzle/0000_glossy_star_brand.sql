CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`search_id` text,
	`role` text NOT NULL,
	`content_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`search_id`) REFERENCES `searches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `search_results` (
	`id` text PRIMARY KEY NOT NULL,
	`search_id` text NOT NULL,
	`status` text NOT NULL,
	`results_json` text,
	`error_message` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`search_id`) REFERENCES `searches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `searches` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text,
	`params_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
