ALTER TABLE `payment_orders` ADD `discount_percent` decimal(5,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `discount_reason` varchar(240);