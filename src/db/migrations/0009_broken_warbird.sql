DROP PROCEDURE IF EXISTS `__drizzle_add_column_if_not_exists`;--> statement-breakpoint
CREATE PROCEDURE `__drizzle_add_column_if_not_exists`(
  IN in_table VARCHAR(128),
  IN in_column VARCHAR(128),
  IN in_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = in_table
    AND column_name = in_column
  ) THEN
    SET @add_col_sql = CONCAT('ALTER TABLE `', in_table, '` ADD `', in_column, '` ', in_definition);
    PREPARE stmt_add_col FROM @add_col_sql;
    EXECUTE stmt_add_col;
    DEALLOCATE PREPARE stmt_add_col;
  END IF;
END;--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__drizzle_drop_index_if_exists`;--> statement-breakpoint
CREATE PROCEDURE `__drizzle_drop_index_if_exists`(
  IN in_table VARCHAR(128),
  IN in_index VARCHAR(128)
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = in_table
    AND index_name = in_index
  ) THEN
    SET @drop_idx_sql = CONCAT('ALTER TABLE `', in_table, '` DROP INDEX `', in_index, '`');
    PREPARE stmt_drop_idx FROM @drop_idx_sql;
    EXECUTE stmt_drop_idx;
    DEALLOCATE PREPARE stmt_drop_idx;
  END IF;
END;--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__drizzle_add_unique_if_not_exists`;--> statement-breakpoint
CREATE PROCEDURE `__drizzle_add_unique_if_not_exists`(
  IN in_table VARCHAR(128),
  IN in_constraint VARCHAR(128),
  IN in_columns VARCHAR(256)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
    AND table_name = in_table
    AND constraint_name = in_constraint
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = in_table
    AND index_name = in_constraint
  ) THEN
    SET @add_uq_sql = CONCAT('ALTER TABLE `', in_table, '` ADD CONSTRAINT `', in_constraint, '` UNIQUE(', in_columns, ')');
    PREPARE stmt_add_uq FROM @add_uq_sql;
    EXECUTE stmt_add_uq;
    DEALLOCATE PREPARE stmt_add_uq;
  END IF;
END;--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__drizzle_add_index_if_not_exists`;--> statement-breakpoint
CREATE PROCEDURE `__drizzle_add_index_if_not_exists`(
  IN in_table VARCHAR(128),
  IN in_index VARCHAR(128),
  IN in_columns VARCHAR(256)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = in_table
    AND index_name = in_index
  ) THEN
    SET @add_idx_sql = CONCAT('CREATE INDEX `', in_index, '` ON `', in_table, '` (', in_columns, ')');
    PREPARE stmt_add_idx FROM @add_idx_sql;
    EXECUTE stmt_add_idx;
    DEALLOCATE PREPARE stmt_add_idx;
  END IF;
END;--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('integration_attempts', 'endpoint', 'varchar(200)');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('integration_attempts', 'provider_document_id', 'varchar(120)');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('integration_attempts', 'request_body', 'json');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('integration_attempts', 'response_body', 'json');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('integration_configs', 'tenant_api_key_ciphertext', 'text');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('integration_configs', 'tenant_api_key_iv', 'varchar(32)');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('integration_configs', 'tenant_api_key_auth_tag', 'varchar(32)');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('integration_configs', 'tenant_api_key_last_four', 'varchar(4)');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('integration_configs', 'system_api_key_ciphertext', 'text');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('integration_configs', 'system_api_key_iv', 'varchar(32)');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('integration_configs', 'system_api_key_auth_tag', 'varchar(32)');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('integration_configs', 'system_api_key_last_four', 'varchar(4)');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('integration_configs', 'tenant_rut', 'varchar(20)');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('intellydte_webhook_events', 'tenant_rut', 'varchar(20)');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('invoice_evidence', 'version', 'int DEFAULT 1 NOT NULL');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('invoice_evidence', 'encoding', 'varchar(30)');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('invoices', 'tenant_rut', 'varchar(20)');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('invoices', 'evidence_status', 'varchar(30) DEFAULT \'pending\' NOT NULL');--> statement-breakpoint
CALL `__drizzle_add_column_if_not_exists`('invoices', 'evidence_error', 'varchar(300)');--> statement-breakpoint
CALL `__drizzle_add_unique_if_not_exists`('invoice_evidence', 'invoice_evidence_version_uq', '`invoice_id`,`kind`,`version`');--> statement-breakpoint
CALL `__drizzle_drop_index_if_exists`('invoice_evidence', 'invoice_evidence_kind_uq');--> statement-breakpoint
CALL `__drizzle_drop_index_if_exists`('invoice_evidence', 'invoice_evidence_invoice_idx');--> statement-breakpoint
CALL `__drizzle_add_index_if_not_exists`('invoice_evidence', 'invoice_evidence_invoice_idx', '`invoice_id`,`kind`,`version`');--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__drizzle_add_column_if_not_exists`;--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__drizzle_drop_index_if_exists`;--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__drizzle_add_unique_if_not_exists`;--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__drizzle_add_index_if_not_exists`;