ALTER TABLE `timers` ADD `reset_enabled` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `timers` ADD `ended_at` text;