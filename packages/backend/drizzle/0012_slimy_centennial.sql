ALTER TABLE `task_executions` ADD `bot_id` text REFERENCES bots(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `bot_id` text REFERENCES bots(id);