-- Migración idempotente para instalaciones existentes: cuentas locales (sin Firebase).
-- Agrega la contraseña cifrada, hace único el correo y crea la tabla de sesiones.
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `password_hash` varchar(255) NULL AFTER `email`;
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);

CREATE TABLE IF NOT EXISTS `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	KEY `sessions_user_idx` (`user_id`),
	CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
