import { GENERATED_IMAGES } from '../data/generatedImages.ts';
import type { Recipe } from './recipeMatcher.ts';

/** Turns the raw JSON returned by the AI endpoint into a full Recipe for the app. */
export function buildRecipeFromAi(
  raw: any,
  defaults: { preference: string; servings: number },
  id: string = `ai-gen-${Date.now()}`
): Recipe {
  return {
    id,
    title: raw.title,
    category: raw.category || defaults.preference,
    mealType: raw.mealType || 'Comida',
    description: raw.description,
    prepTimeMinutes: raw.prepTimeMinutes || 10,
    cookTimeMinutes: raw.cookTimeMinutes || 15,
    servings: raw.servings || defaults.servings,
    difficulty: raw.difficulty || 'Fácil',
    ingredients: raw.ingredients || [],
    steps: raw.steps || [],
    validationsCount: 1,
    isValidated: false,
    author: 'CociFlex IA (modelo local)',
    authorRole: 'Chef Cero Desperdicio',
    imageUrl: GENERATED_IMAGES.arrozPollo,
    wasteReductionTip: raw.wasteReductionTip || 'Aprovecha todos los ingredientes al 100%.',
    caloriesApprox: raw.caloriesApprox,
  };
}
