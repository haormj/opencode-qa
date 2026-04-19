ALTER TABLE `task_executions` ADD `opencode_session_id` text;--> statement-breakpoint
ALTER TABLE `task_executions` ADD `cancelled_by` text REFERENCES users(id);