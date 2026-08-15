ALTER TABLE `catalog_items` MODIFY COLUMN `type` enum('product','service','project') NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `giro` varchar(180);
