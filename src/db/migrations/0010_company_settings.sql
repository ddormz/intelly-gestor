CREATE TABLE IF NOT EXISTS `company_settings` (
	`id` varchar(36) NOT NULL,
	`rut` varchar(20) NOT NULL DEFAULT '76.123.456-7',
	`legal_name` varchar(200) NOT NULL DEFAULT 'Intelly SpA',
	`trade_name` varchar(200) DEFAULT 'Intelly',
	`giro` varchar(200) DEFAULT 'Servicios Informáticos y Desarrollo de Software',
	`address_line` varchar(250) DEFAULT 'Av. Providencia 1234, Of. 501',
	`commune` varchar(100) DEFAULT 'Providencia',
	`city` varchar(100) DEFAULT 'Santiago',
	`region` varchar(100) DEFAULT 'Región Metropolitana',
	`email` varchar(254) DEFAULT 'contacto@intelly.cl',
	`phone` varchar(50) DEFAULT '+56 9 1234 5678',
	`website` varchar(200) DEFAULT 'https://intelly.cl',
	`bank_name` varchar(100) DEFAULT 'Banco Santander',
	`bank_account_type` varchar(50) DEFAULT 'Cuenta Corriente',
	`bank_account_number` varchar(50) DEFAULT '12345678',
	`bank_account_holder` varchar(200) DEFAULT 'Intelly SpA',
	`bank_account_rut` varchar(20) DEFAULT '76.123.456-7',
	`bank_account_email` varchar(254) DEFAULT 'pagos@intelly.cl',
	`updated_by` varchar(36),
	`created_at` datetime NOT NULL DEFAULT (now()),
	`updated_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `company_settings_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
INSERT IGNORE INTO `company_settings` (`id`, `rut`, `legal_name`, `trade_name`, `giro`, `address_line`, `commune`, `city`, `region`, `email`, `phone`, `website`, `bank_name`, `bank_account_type`, `bank_account_number`, `bank_account_holder`, `bank_account_rut`, `bank_account_email`)
VALUES ('default', '76.123.456-7', 'Intelly SpA', 'Intelly', 'Servicios Informáticos y Desarrollo de Software', 'Av. Providencia 1234, Of. 501', 'Providencia', 'Santiago', 'Región Metropolitana', 'contacto@intelly.cl', '+56 9 1234 5678', 'https://intelly.cl', 'Banco Santander', 'Cuenta Corriente', '12345678', 'Intelly SpA', '76.123.456-7', 'pagos@intelly.cl');
