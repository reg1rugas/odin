CREATE TABLE `records` (
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_owner_kind` ON `records` (`owner`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `records_identity` ON `records` (`owner`,`kind`,`id`);