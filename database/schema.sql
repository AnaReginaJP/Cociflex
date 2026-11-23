CREATE TABLE `community_validations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`community_recipe_id` varchar(80) NOT NULL,
	`user_uid` varchar(128) NOT NULL,
	`validator_name` varchar(120) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_validations_id` PRIMARY KEY(`id`),
	CONSTRAINT `community_recipe_user_uid_idx` UNIQUE(`community_recipe_id`,`user_uid`)
);

CREATE TABLE `pantry_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`ingredient_name` varchar(120) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pantry_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `pantry_user_ingredient_idx` UNIQUE(`user_id`,`ingredient_name`)
);

CREATE TABLE `recipe_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`ingredients` json NOT NULL,
	`time_available` int NOT NULL,
	`servings` int NOT NULL,
	`preference` varchar(80) NOT NULL,
	`extra_notes` text,
	`status` varchar(16) NOT NULL,
	`model` varchar(60),
	`recipe_title` varchar(200),
	`recipe_payload` json,
	`error_message` text,
	`duration_ms` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recipe_history_id` PRIMARY KEY(`id`)
);

CREATE TABLE `saved_recipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`external_id` varchar(80) NOT NULL,
	`title` varchar(200) NOT NULL,
	`category` varchar(80) NOT NULL,
	`meal_type` varchar(40) NOT NULL,
	`description` text NOT NULL,
	`prep_time_minutes` int NOT NULL,
	`cook_time_minutes` int NOT NULL,
	`servings` int NOT NULL,
	`difficulty` varchar(30) NOT NULL,
	`waste_reduction_tip` text NOT NULL,
	`recipe_payload` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_recipes_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_recipes_user_external_idx` UNIQUE(`user_id`,`external_id`)
);

CREATE TABLE `shopping_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`item_name` varchar(160) NOT NULL,
	`is_checked` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shopping_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `shopping_user_item_idx` UNIQUE(`user_id`,`item_name`)
);

CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uid` varchar(128) NOT NULL,
	`email` varchar(255) NOT NULL,
	`display_name` varchar(120) NOT NULL DEFAULT '',
	`dietary_preference` varchar(40) NOT NULL DEFAULT 'Omnívoro',
	`walkthrough_completed` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`last_login_at` timestamp,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_uid_unique` UNIQUE(`uid`)
);

ALTER TABLE `pantry_items` ADD CONSTRAINT `pantry_items_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `recipe_history` ADD CONSTRAINT `recipe_history_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `saved_recipes` ADD CONSTRAINT `saved_recipes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `shopping_items` ADD CONSTRAINT `shopping_items_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE INDEX `recipe_history_user_idx` ON `recipe_history` (`user_id`,`created_at`);
CREATE INDEX `saved_recipes_user_idx` ON `saved_recipes` (`user_id`,`created_at`);