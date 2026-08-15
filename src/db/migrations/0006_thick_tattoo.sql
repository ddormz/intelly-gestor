ALTER TABLE `payment_orders` ADD `public_token_ciphertext` text;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `public_token_iv` varchar(32);--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `public_token_auth_tag` varchar(32);