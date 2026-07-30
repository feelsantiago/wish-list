CREATE TABLE `coupon_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`coupon` text NOT NULL,
	`threshold_amount` real NOT NULL,
	`threshold_currency` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`coupon`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `coupon_rules_coupon_idx` ON `coupon_rules` (`coupon`);--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`vendor` text NOT NULL,
	`code` text NOT NULL,
	`tag` text NOT NULL,
	`amount_amount` real,
	`amount_currency` text,
	`percentage` integer,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendor`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `coupons_user_idx` ON `coupons` (`user`);--> statement-breakpoint
CREATE INDEX `coupons_vendor_idx` ON `coupons` (`vendor`);--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_user_vendor_code_idx` ON `coupons` (`user`,`vendor`,`code`);--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`item` text NOT NULL,
	`price_amount` real NOT NULL,
	`price_currency` text NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`item`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `price_history_item_idx` ON `price_history` (`item`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`item` text NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reservations_item_idx` ON `reservations` (`item`);--> statement-breakpoint
CREATE TABLE `tracked_items` (
	`id` text PRIMARY KEY NOT NULL,
	`item` text NOT NULL,
	`active` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`item`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracked_items_item_idx` ON `tracked_items` (`item`);