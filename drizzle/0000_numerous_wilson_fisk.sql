CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`timer_id` text NOT NULL,
	`happened_at` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`timer_id`) REFERENCES `timers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_events_timer_time` ON `events` (`timer_id`,`happened_at`);--> statement-breakpoint
CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_folders_workspace_name` ON `folders` (`workspace_id`,`name`);--> statement-breakpoint
CREATE TABLE `timers` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`folder_id` text,
	`title` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'since' NOT NULL,
	`started_at` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`labels` text DEFAULT '[]' NOT NULL,
	`color` text DEFAULT 'mint' NOT NULL,
	`emoji` text DEFAULT '⏳' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_timers_workspace` ON `timers` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workspaces_owner` ON `workspaces` (`owner`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workspaces_owner_name` ON `workspaces` (`owner`,`name`);