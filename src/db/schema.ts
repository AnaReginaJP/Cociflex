import { relations } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

// MariaDB stores JSON as LONGTEXT, so the driver returns a string: parse it back.
const jsonText = <T>() =>
  customType<{ data: T; driverData: string }>({
    dataType: () => 'json',
    toDriver: (value) => JSON.stringify(value),
    fromDriver: (value) => (typeof value === 'string' ? JSON.parse(value) : (value as T)),
  });

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  uid: varchar('uid', { length: 128 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  // scrypt hash ("scrypt$salt$hash"); local accounts only, no external login provider.
  passwordHash: varchar('password_hash', { length: 255 }),
  displayName: varchar('display_name', { length: 120 }).notNull().default(''),
  dietaryPreference: varchar('dietary_preference', { length: 40 }).notNull().default('Omnívoro'),
  walkthroughCompleted: boolean('walkthrough_completed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  lastLoginAt: timestamp('last_login_at'),
});

// Login sessions: the browser keeps a random token in an HttpOnly cookie; only its SHA-256 is stored.
export const sessions = mysqlTable(
  'sessions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('sessions_user_idx').on(table.userId)]
);

export const pantryItems = mysqlTable(
  'pantry_items',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ingredientName: varchar('ingredient_name', { length: 120 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('pantry_user_ingredient_idx').on(table.userId, table.ingredientName)]
);

export const shoppingItems = mysqlTable(
  'shopping_items',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemName: varchar('item_name', { length: 160 }).notNull(),
    isChecked: boolean('is_checked').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('shopping_user_item_idx').on(table.userId, table.itemName)]
);

// Recipes the user kept (AI-generated recipes shown in the app).
export const savedRecipes = mysqlTable(
  'saved_recipes',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    externalId: varchar('external_id', { length: 80 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    category: varchar('category', { length: 80 }).notNull(),
    mealType: varchar('meal_type', { length: 40 }).notNull(),
    description: text('description').notNull(),
    prepTimeMinutes: int('prep_time_minutes').notNull(),
    cookTimeMinutes: int('cook_time_minutes').notNull(),
    servings: int('servings').notNull(),
    difficulty: varchar('difficulty', { length: 30 }).notNull(),
    wasteReductionTip: text('waste_reduction_tip').notNull(),
    recipePayload: jsonText<Record<string, unknown>>()('recipe_payload').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('saved_recipes_user_idx').on(table.userId, table.createdAt),
    uniqueIndex('saved_recipes_user_external_idx').on(table.userId, table.externalId),
  ]
);

// Every AI generation request of a signed-in user: inputs, result and outcome.
export const recipeHistory = mysqlTable(
  'recipe_history',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ingredients: jsonText<string[]>()('ingredients').notNull(),
    timeAvailable: int('time_available').notNull(),
    servings: int('servings').notNull(),
    preference: varchar('preference', { length: 80 }).notNull(),
    extraNotes: text('extra_notes'),
    status: varchar('status', { length: 16 }).notNull(), // ok | fallback | error
    model: varchar('model', { length: 60 }),
    recipeTitle: varchar('recipe_title', { length: 200 }),
    recipePayload: jsonText<Record<string, unknown>>()('recipe_payload'),
    errorMessage: text('error_message'),
    durationMs: int('duration_ms'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('recipe_history_user_idx').on(table.userId, table.createdAt)]
);

export const communityValidations = mysqlTable(
  'community_validations',
  {
    id: int('id').autoincrement().primaryKey(),
    communityRecipeId: varchar('community_recipe_id', { length: 80 }).notNull(),
    userUid: varchar('user_uid', { length: 128 }).notNull(),
    validatorName: varchar('validator_name', { length: 120 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('community_recipe_user_uid_idx').on(table.communityRecipeId, table.userUid),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  pantryItems: many(pantryItems),
  shoppingItems: many(shoppingItems),
  savedRecipes: many(savedRecipes),
  recipeHistory: many(recipeHistory),
}));

export const pantryItemsRelations = relations(pantryItems, ({ one }) => ({
  user: one(users, { fields: [pantryItems.userId], references: [users.id] }),
}));

export const shoppingItemsRelations = relations(shoppingItems, ({ one }) => ({
  user: one(users, { fields: [shoppingItems.userId], references: [users.id] }),
}));

export const savedRecipesRelations = relations(savedRecipes, ({ one }) => ({
  user: one(users, { fields: [savedRecipes.userId], references: [users.id] }),
}));

export const recipeHistoryRelations = relations(recipeHistory, ({ one }) => ({
  user: one(users, { fields: [recipeHistory.userId], references: [users.id] }),
}));
