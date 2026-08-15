CREATE TABLE `order_email_deliveries` (
	`id` varchar(36) NOT NULL,
	`payment_order_id` varchar(36) NOT NULL,
	`recipient` varchar(254) NOT NULL,
	`status` enum('sent','failed') NOT NULL,
	`error_code` varchar(80),
	`safe_message` varchar(300),
	`sent_at` datetime,
	`created_by` varchar(36) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `order_email_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `order_email_deliveries` ADD CONSTRAINT `order_email_deliveries_payment_order_id_payment_orders_id_fk` FOREIGN KEY (`payment_order_id`) REFERENCES `payment_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_email_deliveries` ADD CONSTRAINT `order_email_deliveries_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `order_email_order_idx` ON `order_email_deliveries` (`payment_order_id`,`created_at`);