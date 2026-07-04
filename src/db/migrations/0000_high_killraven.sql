CREATE TABLE `voice_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`hash` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `voice_sources_name_unique` ON `voice_sources` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `voice_sources_normalized_name_unique` ON `voice_sources` (`normalized_name`);