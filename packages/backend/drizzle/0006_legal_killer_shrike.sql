PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`content` text,
	`category_id` integer NOT NULL,
	`author_id` text NOT NULL,
	`version` text DEFAULT '1.0.0' NOT NULL,
	`icon` text,
	`tags` text,
	`install_command` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reject_reason` text,
	`download_count` integer DEFAULT 0 NOT NULL,
	`favorite_count` integer DEFAULT 0 NOT NULL,
	`average_rating` real DEFAULT 0 NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `skill_categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_skills`("id", "name", "display_name", "slug", "description", "content", "category_id", "author_id", "version", "icon", "tags", "install_command", "status", "reject_reason", "download_count", "favorite_count", "average_rating", "rating_count", "created_at", "updated_at") SELECT "id", "name", "display_name", "slug", "description", "content", "category_id", "author_id", "version", "icon", "tags", "install_command", "status", "reject_reason", "download_count", "favorite_count", "average_rating", "rating_count", "created_at", "updated_at" FROM `skills`;--> statement-breakpoint
DROP TABLE `skills`;--> statement-breakpoint
ALTER TABLE `__new_skills` RENAME TO `skills`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `skills_name_unique` ON `skills` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `skills_slug_unique` ON `skills` (`slug`);