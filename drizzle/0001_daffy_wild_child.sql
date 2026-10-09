CREATE TABLE `ai_budget` (
	`id` text PRIMARY KEY NOT NULL,
	`reserved_cents` integer DEFAULT 0 NOT NULL,
	`actual_micros` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`accounted` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_requests_owner_created` ON `ai_requests` (`owner_id`,`created_at`);