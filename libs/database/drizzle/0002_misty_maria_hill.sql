DROP INDEX "categories_user_idx";--> statement-breakpoint
DROP INDEX "categories_user_name_idx";--> statement-breakpoint
DROP INDEX "coupon_rules_coupon_idx";--> statement-breakpoint
DROP INDEX "coupons_user_idx";--> statement-breakpoint
DROP INDEX "coupons_vendor_idx";--> statement-breakpoint
DROP INDEX "coupons_user_vendor_code_idx";--> statement-breakpoint
DROP INDEX "items_wishlist_idx";--> statement-breakpoint
DROP INDEX "items_category_idx";--> statement-breakpoint
DROP INDEX "items_vendor_idx";--> statement-breakpoint
DROP INDEX "price_history_item_idx";--> statement-breakpoint
DROP INDEX "reservations_item_idx";--> statement-breakpoint
DROP INDEX "tracked_items_item_idx";--> statement-breakpoint
DROP INDEX "users_email_idx";--> statement-breakpoint
DROP INDEX "users_provider_provider_id_idx";--> statement-breakpoint
DROP INDEX "vendors_vendor_domain_idx";--> statement-breakpoint
DROP INDEX "wishlists_user_idx";--> statement-breakpoint
DROP INDEX "wishlists_slug_idx";--> statement-breakpoint
ALTER TABLE `vendors` ALTER COLUMN "name" TO "name" text;--> statement-breakpoint
CREATE INDEX `categories_user_idx` ON `categories` (`user`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_name_idx` ON `categories` (`user`,`name`);--> statement-breakpoint
CREATE INDEX `coupon_rules_coupon_idx` ON `coupon_rules` (`coupon`);--> statement-breakpoint
CREATE INDEX `coupons_user_idx` ON `coupons` (`user`);--> statement-breakpoint
CREATE INDEX `coupons_vendor_idx` ON `coupons` (`vendor`);--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_user_vendor_code_idx` ON `coupons` (`user`,`vendor`,`code`);--> statement-breakpoint
CREATE INDEX `items_wishlist_idx` ON `items` (`wishlist`);--> statement-breakpoint
CREATE INDEX `items_category_idx` ON `items` (`category`);--> statement-breakpoint
CREATE INDEX `items_vendor_idx` ON `items` (`vendor`);--> statement-breakpoint
CREATE INDEX `price_history_item_idx` ON `price_history` (`item`);--> statement-breakpoint
CREATE UNIQUE INDEX `reservations_item_idx` ON `reservations` (`item`);--> statement-breakpoint
CREATE UNIQUE INDEX `tracked_items_item_idx` ON `tracked_items` (`item`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_provider_provider_id_idx` ON `users` (`provider`,`provider_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_vendor_domain_idx` ON `vendors` (`vendor_domain`);--> statement-breakpoint
CREATE INDEX `wishlists_user_idx` ON `wishlists` (`user`);--> statement-breakpoint
CREATE UNIQUE INDEX `wishlists_slug_idx` ON `wishlists` (`slug`);--> statement-breakpoint
ALTER TABLE `vendors` ALTER COLUMN "currency" TO "currency" text;--> statement-breakpoint
ALTER TABLE `vendors` ADD `tag` text NOT NULL;