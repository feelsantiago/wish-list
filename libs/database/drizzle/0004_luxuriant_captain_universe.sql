DROP INDEX `users_provider_provider_id_idx`;--> statement-breakpoint
ALTER TABLE `users` ADD `name_source` text DEFAULT 'broker' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_provider_id_idx` ON `users` (`provider_id`);--> statement-breakpoint
ALTER TABLE `categories` ADD `kind` text DEFAULT 'custom' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_unsorted_idx` ON `categories` (`user`) WHERE "categories"."kind" = 'unsorted';