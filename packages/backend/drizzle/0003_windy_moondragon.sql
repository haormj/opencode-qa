CREATE TABLE `assistants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`default_bot_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`default_bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assistants_slug_unique` ON `assistants` (`slug`);--> statement-breakpoint
CREATE TABLE `user_assistant_bots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assistant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`bot_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`assistant_id`) REFERENCES `assistants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_assistant_unique` ON `user_assistant_bots` (`assistant_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `assistant_id` text REFERENCES assistants(id);