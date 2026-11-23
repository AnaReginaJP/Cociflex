import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default(''),
  dietaryPreference: text('dietary_preference').notNull().default('Omnívoro'),
  walkthroughCompleted: boolean('walkthrough_completed').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const pantryItems = pgTable(
  'pantry_items',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    ingredientName: text('ingredient_name').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    uniqueIndex('pantry_user_ingredient_idx').on(table.userId, table.ingredientName),
  ]
);

export const shoppingItems = pgTable(
  'shopping_items',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    itemName: text('item_name').notNull(),
    isChecked: boolean('is_checked').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    uniqueIndex('shopping_user_item_idx').on(table.userId, table.itemName),
  ]
);

export const savedRecipes = pgTable('saved_recipes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalId: text('external_id').notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  mealType: text('meal_type').notNull(),
  description: text('description').notNull(),
  prepTimeMinutes: integer('prep_time_minutes').notNull(),
  cookTimeMinutes: integer('cook_time_minutes').notNull(),
  servings: integer('servings').notNull(),
  difficulty: text('difficulty').notNull(),
  wasteReductionTip: text('waste_reduction_tip').notNull(),
  recipePayload: jsonb('recipe_payload').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const communityValidations = pgTable(
  'community_validations',
  {
    id: serial('id').primaryKey(),
    communityRecipeId: text('community_recipe_id').notNull(),
    userUid: text('user_uid').notNull(),
    validatorName: text('validator_name').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    uniqueIndex('community_recipe_user_uid_idx').on(
      table.communityRecipeId,
      table.userUid
    ),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  pantryItems: many(pantryItems),
  shoppingItems: many(shoppingItems),
  savedRecipes: many(savedRecipes),
}));

export const pantryItemsRelations = relations(pantryItems, ({ one }) => ({
  user: one(users, {
    fields: [pantryItems.userId],
    references: [users.id],
  }),
}));

export const shoppingItemsRelations = relations(shoppingItems, ({ one }) => ({
  user: one(users, {
    fields: [shoppingItems.userId],
    references: [users.id],
  }),
}));

export const savedRecipesRelations = relations(savedRecipes, ({ one }) => ({
  user: one(users, {
    fields: [savedRecipes.userId],
    references: [users.id],
  }),
}));
