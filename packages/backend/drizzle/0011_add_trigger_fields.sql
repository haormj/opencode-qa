ALTER TABLE `tasks` RENAME COLUMN `schedule_type` TO `trigger_type`;
ALTER TABLE `tasks` ADD COLUMN `webhook_token` text;
