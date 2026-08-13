CREATE TABLE `audit_events` (
	`id` varchar(36) NOT NULL,
	`actor_user_id` varchar(36),
	`actor_type` enum('user','system','public') NOT NULL,
	`action` varchar(100) NOT NULL,
	`entity_type` varchar(60) NOT NULL,
	`entity_id` varchar(36),
	`correlation_id` varchar(36) NOT NULL,
	`metadata` json NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `business_counters` (
	`name` varchar(40) NOT NULL,
	`value` bigint unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `business_counters_name` PRIMARY KEY(`name`)
);
--> statement-breakpoint
CREATE TABLE `catalog_items` (
	`id` varchar(36) NOT NULL,
	`type` enum('product','service') NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`unit_price` decimal(18,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'CLP',
	`tax_category` enum('taxable','exempt') NOT NULL,
	`tax_rate` decimal(5,2) NOT NULL DEFAULT '19.00',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` datetime NOT NULL DEFAULT (now()),
	`updated_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `catalog_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `catalog_code_uq` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` varchar(36) NOT NULL,
	`kind` enum('person','company') NOT NULL,
	`tax_id` varchar(20),
	`legal_name` varchar(180) NOT NULL,
	`trade_name` varchar(180),
	`email` varchar(254) NOT NULL,
	`phone` varchar(30),
	`address_line` varchar(240),
	`commune` varchar(100),
	`city` varchar(100),
	`region` varchar(100),
	`country_code` varchar(2) NOT NULL DEFAULT 'CL',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` datetime NOT NULL DEFAULT (now()),
	`updated_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_attempts` (
	`id` varchar(36) NOT NULL,
	`integration` varchar(50) NOT NULL,
	`operation` varchar(80) NOT NULL,
	`aggregate_type` varchar(50) NOT NULL,
	`aggregate_id` varchar(36) NOT NULL,
	`idempotency_key` varchar(100) NOT NULL,
	`correlation_id` varchar(36) NOT NULL,
	`attempt_number` int NOT NULL,
	`status` varchar(40) NOT NULL,
	`request_hash` varchar(64) NOT NULL,
	`http_status` int,
	`provider_code` varchar(80),
	`safe_message` varchar(300),
	`created_at` datetime NOT NULL DEFAULT (now()),
	`completed_at` datetime,
	CONSTRAINT `integration_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `attempt_uq` UNIQUE(`integration`,`idempotency_key`,`attempt_number`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` varchar(36) NOT NULL,
	`payment_order_id` varchar(36) NOT NULL,
	`status` enum('pending','processing','issued','rejected') NOT NULL DEFAULT 'pending',
	`document_type` varchar(40) NOT NULL DEFAULT 'factura-electronica',
	`provider` varchar(40) NOT NULL DEFAULT 'intellydte',
	`provider_document_id` varchar(120),
	`folio` varchar(60),
	`request_hash` varchar(64) NOT NULL,
	`issued_at` datetime,
	`rejected_at` datetime,
	`last_error_code` varchar(80),
	`last_error_message` varchar(300),
	`created_at` datetime NOT NULL DEFAULT (now()),
	`updated_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_order_uq` UNIQUE(`payment_order_id`),
	CONSTRAINT `invoices_provider_id_uq` UNIQUE(`provider_document_id`)
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` varchar(36) NOT NULL,
	`email_hash` varchar(64) NOT NULL,
	`ip_hash` varchar(64) NOT NULL,
	`succeeded` boolean NOT NULL,
	`occurred_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_order_lines` (
	`id` varchar(36) NOT NULL,
	`payment_order_id` varchar(36) NOT NULL,
	`catalog_item_id` varchar(36),
	`code` varchar(50),
	`description` varchar(240) NOT NULL,
	`quantity` decimal(12,3) NOT NULL,
	`unit_price` decimal(18,2) NOT NULL,
	`discount_amount` decimal(18,2) NOT NULL DEFAULT '0',
	`tax_rate` decimal(5,2) NOT NULL,
	`subtotal` decimal(18,2) NOT NULL,
	`tax_amount` decimal(18,2) NOT NULL,
	`total` decimal(18,2) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `payment_order_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_orders` (
	`id` varchar(36) NOT NULL,
	`number` varchar(32) NOT NULL,
	`client_id` varchar(36) NOT NULL,
	`status` enum('draft','issued','paid','expired','cancelled','invoiced') NOT NULL DEFAULT 'draft',
	`currency` varchar(3) NOT NULL DEFAULT 'CLP',
	`subtotal` decimal(18,2) NOT NULL,
	`discount_total` decimal(18,2) NOT NULL DEFAULT '0',
	`tax_total` decimal(18,2) NOT NULL,
	`total` decimal(18,2) NOT NULL,
	`due_at` datetime,
	`notes` text,
	`issued_at` datetime,
	`paid_at` datetime,
	`cancelled_at` datetime,
	`invoiced_at` datetime,
	`public_token_hash` varchar(64),
	`public_expires_at` datetime,
	`public_revoked_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	`created_by` varchar(36) NOT NULL,
	`updated_by` varchar(36) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (now()),
	`updated_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_number_uq` UNIQUE(`number`),
	CONSTRAINT `orders_public_token_uq` UNIQUE(`public_token_hash`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` varchar(36) NOT NULL,
	`payment_order_id` varchar(36) NOT NULL,
	`idempotency_key` varchar(100) NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`method` enum('manual','external') NOT NULL,
	`external_reference` varchar(120),
	`paid_at` datetime NOT NULL,
	`recorded_by` varchar(36),
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_idempotency_uq` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`ip_hash` varchar(64),
	`user_agent` varchar(300),
	`last_seen_at` datetime NOT NULL,
	`idle_expires_at` datetime NOT NULL,
	`absolute_expires_at` datetime NOT NULL,
	`revoked_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(254) NOT NULL,
	`name` varchar(120) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('admin','operator') NOT NULL DEFAULT 'operator',
	`status` enum('active','disabled','locked') NOT NULL DEFAULT 'active',
	`failed_login_count` int NOT NULL DEFAULT 0,
	`locked_until` datetime,
	`password_changed_at` datetime NOT NULL DEFAULT (now()),
	`last_login_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	`updated_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_uq` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_payment_order_id_payment_orders_id_fk` FOREIGN KEY (`payment_order_id`) REFERENCES `payment_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_order_lines` ADD CONSTRAINT `payment_order_lines_payment_order_id_payment_orders_id_fk` FOREIGN KEY (`payment_order_id`) REFERENCES `payment_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_order_lines` ADD CONSTRAINT `payment_order_lines_catalog_item_id_catalog_items_id_fk` FOREIGN KEY (`catalog_item_id`) REFERENCES `catalog_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD CONSTRAINT `payment_orders_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD CONSTRAINT `payment_orders_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD CONSTRAINT `payment_orders_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_payment_order_id_payment_orders_id_fk` FOREIGN KEY (`payment_order_id`) REFERENCES `payment_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_recorded_by_users_id_fk` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_entity_date_idx` ON `audit_events` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_correlation_idx` ON `audit_events` (`correlation_id`);--> statement-breakpoint
CREATE INDEX `catalog_name_idx` ON `catalog_items` (`name`);--> statement-breakpoint
CREATE INDEX `clients_search_idx` ON `clients` (`legal_name`,`email`);--> statement-breakpoint
CREATE INDEX `clients_tax_idx` ON `clients` (`tax_id`);--> statement-breakpoint
CREATE INDEX `attempt_aggregate_idx` ON `integration_attempts` (`aggregate_type`,`aggregate_id`);--> statement-breakpoint
CREATE INDEX `invoices_status_date_idx` ON `invoices` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `login_email_time_idx` ON `login_attempts` (`email_hash`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `login_ip_time_idx` ON `login_attempts` (`ip_hash`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `order_lines_order_idx` ON `payment_order_lines` (`payment_order_id`);--> statement-breakpoint
CREATE INDEX `orders_status_date_idx` ON `payment_orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_client_idx` ON `payment_orders` (`client_id`);--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`payment_order_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);