import { eq, desc, and } from 'drizzle-orm';
import { db } from './index.ts';
import {
  users,
  pantryItems,
  shoppingItems,
  savedRecipes,
  communityValidations,
} from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string
) {
  try {
    const safeName = displayName?.trim() || email.split('@')[0] || 'Cocinero';
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: safeName,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
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
    const result = await db
      .update(users)
      .set({
        ...(updates.displayName !== undefined
          ? { displayName: updates.displayName }
          : {}),
        ...(updates.dietaryPreference !== undefined
          ? { dietaryPreference: updates.dietaryPreference }
          : {}),
        ...(updates.walkthroughCompleted !== undefined
          ? { walkthroughCompleted: updates.walkthroughCompleted }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();

    return result[0];
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

    const [pantryRows, shoppingRows, recipeRows] = await Promise.all([
      db.select().from(pantryItems).where(eq(pantryItems.userId, user.id)),
      db.select().from(shoppingItems).where(eq(shoppingItems.userId, user.id)),
      db
        .select()
        .from(savedRecipes)
        .where(eq(savedRecipes.userId, user.id))
        .orderBy(desc(savedRecipes.createdAt)),
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
      new Set(ingredients.map((i) => i.trim()).filter(Boolean))
    );

    await db.transaction(async (tx) => {
      await tx.delete(pantryItems).where(eq(pantryItems.userId, user.id));
      if (cleaned.length > 0) {
        await tx.insert(pantryItems).values(
          cleaned.map((ingredientName) => ({
            userId: user.id,
            ingredientName,
          }))
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
      new Set(items.map((i) => i.trim()).filter(Boolean))
    );

    await db.transaction(async (tx) => {
      await tx.delete(shoppingItems).where(eq(shoppingItems.userId, user.id));
      if (cleaned.length > 0) {
        await tx.insert(shoppingItems).values(
          cleaned.map((itemName) => ({
            userId: user.id,
            itemName,
          }))
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
    const inserted = await db
      .insert(savedRecipes)
      .values({
        userId: user.id,
        externalId: recipe.id,
        title: recipe.title,
        category: recipe.category,
        mealType: recipe.mealType,
        description: recipe.description,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        wasteReductionTip: recipe.wasteReductionTip,
        recipePayload: recipe,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in saveUserAiRecipe:', error);
    throw new Error('No se pudo guardar la receta generada.', { cause: error });
  }
}

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
    const existing = await db
      .select()
      .from(communityValidations)
      .where(
        and(
          eq(communityValidations.communityRecipeId, communityRecipeId),
          eq(communityValidations.userUid, userUid)
        )
      );

    if (existing.length === 0) {
      await db.insert(communityValidations).values({
        communityRecipeId,
        userUid,
        validatorName,
      });
    }

    return await db
      .select()
      .from(communityValidations)
      .where(eq(communityValidations.communityRecipeId, communityRecipeId));
  } catch (error) {
    console.error('Database query failed in addCommunityValidation:', error);
    throw new Error('No se pudo registrar la validación comunitaria.', {
      cause: error,
    });
  }
}
