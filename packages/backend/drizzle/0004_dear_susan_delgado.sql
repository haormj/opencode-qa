PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`sender_type` text NOT NULL,
	`content` text NOT NULL,
	`reasoning` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`user_id` text,
	`bot_id` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_messages`("id", "session_id", "sender_type", "content", "reasoning", "metadata", "created_at", "user_id", "bot_id") SELECT "id", "session_id", "sender_type", "content", "reasoning", "metadata", "created_at", "user_id", "bot_id" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;