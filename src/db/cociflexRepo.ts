import { eq, desc, and } from 'drizzle-orm';
import { db } from './index.ts';
import {
  users,
  pantryItems,
  shoppingItems,
  savedRecipes,
  recipeHistory,
  communityValidations,
} from './schema.ts';

const HISTORY_LIMIT = 50;

async function findUserByUid(uid: string) {
  const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  return rows[0];
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string
) {
  try {
    const safeName = displayName?.trim() || email.split('@')[0] || 'Cocinero';
    await db
      .insert(users)
      .values({ uid, email, displayName: safeName })
      .onDuplicateKeyUpdate({ set: { email } });

    const user = await findUserByUid(uid);
    if (!user) throw new Error('Usuario no encontrado tras sincronizar.');
    return user;
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('No se pudo sincronizar el usuario con la base de datos.', {
      cause: error,
    });
  }
}

export async function updateUserPreferences(
  uid: string,
  email: string,
  updates: {
    displayName?: string;
    dietaryPreference?: string;
    walkthroughCompleted?: boolean;
  }
) {
  try {
    const existing = await getOrCreateUser(uid, email, updates.displayName);
    const changes = {
      ...(updates.displayName !== undefined ? { displayName: updates.displayName } : {}),
      ...(updates.dietaryPreference !== undefined
        ? { dietaryPreference: updates.dietaryPreference }
        : {}),
      ...(updates.walkthroughCompleted !== undefined
        ? { walkthroughCompleted: updates.walkthroughCompleted }
        : {}),
    };

    if (Object.keys(changes).length > 0) {
      await db.update(users).set(changes).where(eq(users.id, existing.id));
    }

    const updated = await findUserByUid(uid);
    return updated ?? existing;
  } catch (error) {
    console.error('Database query failed in updateUserPreferences:', error);
    throw new Error('No se pudieron guardar las preferencias del usuario.', {
      cause: error,
    });
  }
}

export async function getUserFullState(uid: string, email: string, displayName?: string) {
  try {
    const user = await getOrCreateUser(uid, email, displayName);
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    const [pantryRows, shoppingRows, recipeRows, historyRows] = await Promise.all([
      db.select().from(pantryItems).where(eq(pantryItems.userId, user.id)),
      db.select().from(shoppingItems).where(eq(shoppingItems.userId, user.id)),
      db
        .select()
        .from(savedRecipes)
        .where(eq(savedRecipes.userId, user.id))
        .orderBy(desc(savedRecipes.createdAt), desc(savedRecipes.id)),
      db
        .select()
        .from(recipeHistory)
        .where(eq(recipeHistory.userId, user.id))
        .orderBy(desc(recipeHistory.createdAt), desc(recipeHistory.id))
        .limit(HISTORY_LIMIT),
    ]);

    return {
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        dietaryPreference: user.dietaryPreference,
        walkthroughCompleted: user.walkthroughCompleted,
      },
      pantryIngredients: pantryRows.map((r) => r.ingredientName),
      shoppingList: shoppingRows.map((r) => r.itemName),
      savedRecipes: recipeRows.map((r) => r.recipePayload),
      recipeHistory: historyRows.map(toHistoryEntry),
    };
  } catch (error) {
    console.error('Database query failed in getUserFullState:', error);
    throw new Error('No se pudo cargar la información del usuario.', {
      cause: error,
    });
  }
}

export async function replaceUserPantry(
  uid: string,
  email: string,
  ingredients: string[]
) {
  try {
    const user = await getOrCreateUser(uid, email);
    const cleaned = Array.from(
      new Set(ingredients.map((i) => i.trim().slice(0, 120)).filter(Boolean))
    );

    await db.transaction(async (tx) => {
      await tx.delete(pantryItems).where(eq(pantryItems.userId, user.id));
      if (cleaned.length > 0) {
        await tx.insert(pantryItems).values(
          cleaned.map((ingredientName) => ({ userId: user.id, ingredientName }))
        );
      }
    });

    return cleaned;
  } catch (error) {
    console.error('Database query failed in replaceUserPantry:', error);
    throw new Error('No se pudo guardar la alacena en la base de datos.', {
      cause: error,
    });
  }
}

export async function replaceUserShoppingList(
  uid: string,
  email: string,
  items: string[]
) {
  try {
    const user = await getOrCreateUser(uid, email);
    const cleaned = Array.from(
      new Set(items.map((i) => i.trim().slice(0, 160)).filter(Boolean))
    );

    await db.transaction(async (tx) => {
      await tx.delete(shoppingItems).where(eq(shoppingItems.userId, user.id));
      if (cleaned.length > 0) {
        await tx.insert(shoppingItems).values(
          cleaned.map((itemName) => ({ userId: user.id, itemName }))
        );
      }
    });

    return cleaned;
  } catch (error) {
    console.error('Database query failed in replaceUserShoppingList:', error);
    throw new Error('No se pudo actualizar la lista de mandado.', {
      cause: error,
    });
  }
}

export async function saveUserAiRecipe(
  uid: string,
  email: string,
  recipe: {
    id: string;
    title: string;
    category: string;
    mealType: string;
    description: string;
    prepTimeMinutes: number;
    cookTimeMinutes: number;
    servings: number;
    difficulty: string;
    wasteReductionTip: string;
  }
) {
  try {
    const user = await getOrCreateUser(uid, email);
    const values = {
      userId: user.id,
      externalId: recipe.id.slice(0, 80),
      title: recipe.title.slice(0, 200),
      category: recipe.category.slice(0, 80),
      mealType: recipe.mealType.slice(0, 40),
      description: recipe.description,
      prepTimeMinutes: recipe.prepTimeMinutes,
      cookTimeMinutes: recipe.cookTimeMinutes,
      servings: recipe.servings,
      difficulty: recipe.difficulty.slice(0, 30),
      wasteReductionTip: recipe.wasteReductionTip,
      recipePayload: recipe as unknown as Record<string, unknown>,
    };

    // Saving the same recipe twice updates it instead of failing.
    await db.insert(savedRecipes).values(values).onDuplicateKeyUpdate({
      set: { title: values.title, description: values.description, recipePayload: values.recipePayload },
    });

    const rows = await db
      .select()
      .from(savedRecipes)
      .where(and(eq(savedRecipes.userId, user.id), eq(savedRecipes.externalId, values.externalId)))
      .limit(1);
    return rows[0];
  } catch (error) {
    console.error('Database query failed in saveUserAiRecipe:', error);
    throw new Error('No se pudo guardar la receta generada.', { cause: error });
  }
}

// ---------------- Recipe history ----------------

export interface RecipeHistoryInput {
  ingredients: string[];
  timeAvailable: number;
  servings: number;
  preference: string;
  extraNotes?: string;
  status: 'ok' | 'fallback' | 'error';
  model?: string;
  recipe?: Record<string, unknown> | null;
  errorMessage?: string;
  durationMs?: number;
}

function toHistoryEntry(row: typeof recipeHistory.$inferSelect) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    status: row.status,
    ingredients: row.ingredients,
    timeAvailable: row.timeAvailable,
    servings: row.servings,
    preference: row.preference,
    extraNotes: row.extraNotes,
    model: row.model,
    recipeTitle: row.recipeTitle,
    recipe: row.recipePayload,
    errorMessage: row.errorMessage,
    durationMs: row.durationMs,
  };
}

export async function recordRecipeGeneration(
  uid: string,
  email: string,
  entry: RecipeHistoryInput
) {
  try {
    const user = await getOrCreateUser(uid, email);
    const title = typeof entry.recipe?.title === 'string' ? entry.recipe.title : null;
    const [result] = await db.insert(recipeHistory).values({
      userId: user.id,
      ingredients: entry.ingredients.slice(0, 60),
      timeAvailable: entry.timeAvailable,
      servings: entry.servings,
      preference: entry.preference.slice(0, 80),
      extraNotes: entry.extraNotes?.slice(0, 1000) || null,
      status: entry.status,
      model: entry.model?.slice(0, 60) ?? null,
      recipeTitle: title?.slice(0, 200) ?? null,
      recipePayload: entry.recipe ?? null,
      errorMessage: entry.errorMessage?.slice(0, 1000) ?? null,
      durationMs: entry.durationMs ?? null,
    } as typeof recipeHistory.$inferInsert);
    return result.insertId;
  } catch (error) {
    console.error('Database query failed in recordRecipeGeneration:', error);
    throw new Error('No se pudo guardar el historial de recetas.', { cause: error });
  }
}

export async function listRecipeHistory(uid: string, email: string, limit = HISTORY_LIMIT) {
  try {
    const user = await getOrCreateUser(uid, email);
    const rows = await db
      .select()
      .from(recipeHistory)
      .where(eq(recipeHistory.userId, user.id))
      .orderBy(desc(recipeHistory.createdAt), desc(recipeHistory.id))
      .limit(Math.min(Math.max(limit, 1), 200));
    return rows.map(toHistoryEntry);
  } catch (error) {
    console.error('Database query failed in listRecipeHistory:', error);
    throw new Error('No se pudo consultar el historial de recetas.', { cause: error });
  }
}

export async function deleteRecipeHistoryEntry(uid: string, email: string, id: number) {
  try {
    const user = await getOrCreateUser(uid, email);
    const [result] = await db
      .delete(recipeHistory)
      .where(and(eq(recipeHistory.id, id), eq(recipeHistory.userId, user.id)));
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Database query failed in deleteRecipeHistoryEntry:', error);
    throw new Error('No se pudo borrar la entrada del historial.', { cause: error });
  }
}

// ---------------- Community ----------------

export async function listCommunityValidations() {
  try {
    return await db.select().from(communityValidations);
  } catch (error) {
    console.error('Database query failed in listCommunityValidations:', error);
    throw new Error('No se pudieron consultar las validaciones comunitarias.', {
      cause: error,
    });
  }
}

export async function addCommunityValidation(
  communityRecipeId: string,
  userUid: string,
  validatorName: string
) {
  try {
    // The unique index (recipe, user) keeps one validation per user.
    await db
      .insert(communityValidations)
      .values({
        communityRecipeId: communityRecipeId.slice(0, 80),
        userUid,
        validatorName: validatorName.slice(0, 120),
      })
      .onDuplicateKeyUpdate({ set: { validatorName: validatorName.slice(0, 120) } });

    return await db
      .select()
      .from(communityValidations)
      .where(eq(communityValidations.communityRecipeId, communityRecipeId.slice(0, 80)));
  } catch (error) {
    console.error('Database query failed in addCommunityValidation:', error);
    throw new Error('No se pudo registrar la validación comunitaria.', {
      cause: error,
    });
  }
}
