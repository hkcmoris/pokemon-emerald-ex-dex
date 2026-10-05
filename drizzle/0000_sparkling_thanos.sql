CREATE TABLE `compatibility` (
	`species_id` integer NOT NULL,
	`machine` text NOT NULL,
	PRIMARY KEY(`species_id`, `machine`),
	FOREIGN KEY (`species_id`) REFERENCES `species`(`species_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`machine`) REFERENCES `machines`(`machine`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `evolutions` (
	`edge_id` integer PRIMARY KEY NOT NULL,
	`from_species_id` integer NOT NULL,
	`to_species_id` integer NOT NULL,
	`internal_only` integer NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`from_species_id`) REFERENCES `species`(`species_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_species_id`) REFERENCES `species`(`species_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_evolutions_from` ON `evolutions` (`from_species_id`);--> statement-breakpoint
CREATE INDEX `idx_evolutions_to` ON `evolutions` (`to_species_id`);--> statement-breakpoint
CREATE TABLE `learnsets` (
	`species_id` integer NOT NULL,
	`position` integer NOT NULL,
	`level` integer NOT NULL,
	`move_id` integer NOT NULL,
	PRIMARY KEY(`species_id`, `position`),
	FOREIGN KEY (`species_id`) REFERENCES `species`(`species_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`move_id`) REFERENCES `moves`(`move_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `machines` (
	`machine` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`number` integer NOT NULL,
	`move_id` integer NOT NULL,
	FOREIGN KEY (`move_id`) REFERENCES `moves`(`move_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "machine_kind" CHECK("machines"."kind" IN ('TM', 'HM'))
);
--> statement-breakpoint
CREATE TABLE `metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `moves` (
	`move_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `species` (
	`species_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`search_name` text NOT NULL,
	`same_name_count` integer NOT NULL,
	`move_count` integer NOT NULL,
	`machine_count` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_species_search_name` ON `species` (`search_name`);