CREATE TABLE `extractions` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`url` text NOT NULL,
	`vendor` text NOT NULL,
	`tag` text NOT NULL,
	`source` text,
	`reason` text,
	`data_name` text,
	`data_price_amount` real,
	`data_price_currency` text,
	`data_image` text,
	`vendor_data_name` text,
	`vendor_data_website` text,
	`vendor_data_currency` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`vendor`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `extractions_key_created_at_idx` ON `extractions` (`key`,`created_at`);