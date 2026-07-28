CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `categories_user_idx` ON `categories` (`user`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_name_idx` ON `categories` (`user`,`name`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`wishlist` text NOT NULL,
	`vendor` text NOT NULL,
	`category` text NOT NULL,
	`url` text NOT NULL,
	`status` text NOT NULL,
	`tag` text NOT NULL,
	`name` text,
	`price_amount` real,
	`price_currency` text,
	`image` text,
	`reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`wishlist`) REFERENCES `wishlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vendor`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `items_wishlist_idx` ON `items` (`wishlist`);--> statement-breakpoint
CREATE INDEX `items_category_idx` ON `items` (`category`);--> statement-breakpoint
CREATE INDEX `items_vendor_idx` ON `items` (`vendor`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`provider_id` text NOT NULL,
	`plan` text NOT NULL,
	`status` text NOT NULL,
	`deactivated_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_provider_provider_id_idx` ON `users` (`provider`,`provider_id`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_domain` text NOT NULL,
	`website` text NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_vendor_domain_idx` ON `vendors` (`vendor_domain`);--> statement-breakpoint
CREATE TABLE `wishlists` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`published` integer NOT NULL,
	`style` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `wishlists_user_idx` ON `wishlists` (`user`);--> statement-breakpoint
CREATE UNIQUE INDEX `wishlists_slug_idx` ON `wishlists` (`slug`);