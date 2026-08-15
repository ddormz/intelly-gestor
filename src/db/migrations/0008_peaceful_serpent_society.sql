CREATE TABLE `intellydte_webhook_events` (
	`id` varchar(36) NOT NULL,
	`provider_event_id` varchar(160) NOT NULL,
	`event_type` varchar(80) NOT NULL,
	`dte_record_id` varchar(120),
	`payload` json NOT NULL,
	`processed_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `intellydte_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `intelly_webhook_event_id_uq` UNIQUE(`provider_event_id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_evidence` (
	`id` varchar(36) NOT NULL,
	`invoice_id` varchar(36) NOT NULL,
	`kind` enum('signed_xml','reconstructed_pdf') NOT NULL,
	`storage_key` varchar(500) NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`dte_type` varchar(10) NOT NULL,
	`folio` varchar(60) NOT NULL,
	`renderer_version` varchar(40),
	`regenerated_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `invoice_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoice_evidence_kind_uq` UNIQUE(`invoice_id`,`kind`)
);
--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `webhook_secret_ciphertext` text;--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `webhook_secret_iv` varchar(32);--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `webhook_secret_auth_tag` varchar(32);--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `webhook_secret_last_four` varchar(4);--> statement-breakpoint
ALTER TABLE `invoices` ADD `track_id` varchar(120);--> statement-breakpoint
ALTER TABLE `invoices` ADD `sii_status` varchar(50);--> statement-breakpoint
ALTER TABLE `invoices` ADD `sii_glosa` varchar(300);--> statement-breakpoint
ALTER TABLE `invoices` ADD `signed_xml_evidence_id` varchar(36);--> statement-breakpoint
ALTER TABLE `invoices` ADD `reconstructed_pdf_evidence_id` varchar(36);--> statement-breakpoint
ALTER TABLE `invoice_evidence` ADD CONSTRAINT `invoice_evidence_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `intelly_webhook_dte_idx` ON `intellydte_webhook_events` (`dte_record_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `invoice_evidence_invoice_idx` ON `invoice_evidence` (`invoice_id`,`created_at`);