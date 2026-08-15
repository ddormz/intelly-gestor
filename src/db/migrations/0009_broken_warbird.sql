ALTER TABLE `integration_attempts` ADD `endpoint` varchar(200);--> statement-breakpoint
ALTER TABLE `integration_attempts` ADD `provider_document_id` varchar(120);--> statement-breakpoint
ALTER TABLE `integration_attempts` ADD `request_body` json;--> statement-breakpoint
ALTER TABLE `integration_attempts` ADD `response_body` json;--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `tenant_api_key_ciphertext` text;--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `tenant_api_key_iv` varchar(32);--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `tenant_api_key_auth_tag` varchar(32);--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `tenant_api_key_last_four` varchar(4);--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `system_api_key_ciphertext` text;--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `system_api_key_iv` varchar(32);--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `system_api_key_auth_tag` varchar(32);--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `system_api_key_last_four` varchar(4);--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `tenant_rut` varchar(20);--> statement-breakpoint
ALTER TABLE `intellydte_webhook_events` ADD `tenant_rut` varchar(20);--> statement-breakpoint
ALTER TABLE `invoice_evidence` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoice_evidence` ADD `encoding` varchar(30);--> statement-breakpoint
ALTER TABLE `invoices` ADD `tenant_rut` varchar(20);--> statement-breakpoint
ALTER TABLE `invoices` ADD `evidence_status` varchar(30) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `evidence_error` varchar(300);--> statement-breakpoint
ALTER TABLE `invoice_evidence` ADD CONSTRAINT `invoice_evidence_version_uq` UNIQUE(`invoice_id`,`kind`,`version`);--> statement-breakpoint
ALTER TABLE `invoice_evidence` DROP INDEX `invoice_evidence_kind_uq`;--> statement-breakpoint
DROP INDEX `invoice_evidence_invoice_idx` ON `invoice_evidence`;--> statement-breakpoint
CREATE INDEX `invoice_evidence_invoice_idx` ON `invoice_evidence` (`invoice_id`,`kind`,`version`);