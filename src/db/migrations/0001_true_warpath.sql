CREATE TABLE `integration_configs` (
	`id` varchar(36) NOT NULL,
	`integration` varchar(50) NOT NULL,
	`base_url` varchar(500) NOT NULL,
	`api_key_ciphertext` text NOT NULL,
	`api_key_iv` varchar(32) NOT NULL,
	`api_key_auth_tag` varchar(32) NOT NULL,
	`api_key_last_four` varchar(4) NOT NULL,
	`status` enum('active','disabled') NOT NULL DEFAULT 'active',
	`updated_by` varchar(36) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (now()),
	`updated_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_configs_name_uq` UNIQUE(`integration`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_requests` (
	`id` varchar(36) NOT NULL,
	`email_hash` varchar(64) NOT NULL,
	`ip_hash` varchar(64) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` datetime NOT NULL,
	`used_at` datetime,
	`requested_ip_hash` varchar(64) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_hash_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `integration_configs` ADD CONSTRAINT `integration_configs_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `password_reset_requests_email_idx` ON `password_reset_requests` (`email_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `password_reset_requests_ip_idx` ON `password_reset_requests` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_user_idx` ON `password_reset_tokens` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_expiry_idx` ON `password_reset_tokens` (`expires_at`);