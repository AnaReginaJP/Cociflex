export interface IngredientItem {
  id: string;
  name: string;
  category: 'proteina' | 'lacteo' | 'verdura' | 'grano' | 'condimento' | 'otro';
  amount?: string;
}

export interface RecipeIngredient {
  name: string;
  amount: string;
  unit: string;
  essential: boolean;
}

export interface RecipeStep {
  stepNumber: number;
  title: string;
  instruction: string;
  timeMinutes?: number;
  imageUrl?: string;
  tip?: string;
}

export interface Recipe {
  id: string;
  title: string;
  category: string;
  mealType: 'Desayuno' | 'Comida' | 'Cena' | 'Plato Fuerte' | 'Sopa y Caldo' | 'Postre';
  description: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  difficulty: 'Fácil' | 'Media' | 'Avanzada';
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  validationsCount: number;
  isValidated: boolean;
  author: string;
  authorRole: string;
  imageUrl: string;
  wasteReductionTip: string;
  caloriesApprox?: number;
}

export interface FermentationGuide {
  id: string;
  name: string;
  category: string;
  description: string;
  targetTempC: number;
  tempToleranceC: number;
  incubationTimeHours: number;
  incubationTimeDisplay: string;
  phTargetMin: number;
  phTargetMax: number;
  microbiology: string;
  equipment: string[];
  safetyChecklist: string[];
  ingredients: { name: string; amount: string; notes?: string }[];
  steps: { stepNumber: number; title: string; instruction: string; criticalControlPoint?: string }[];
  validationsCount: number;
  badge: string;
}

export interface MatchResult {
  recipe: Recipe;
  matchPercentage: number;
  matchedIngredients: string[];
  missingIngredients: RecipeIngredient[];
}

/**
 * Normalizes text for lenient matching (lowercase, no accents, trimmed)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Checks if a recipe ingredient is present in the user's available ingredients.
 */
export function isIngredientMatched(recipeIng: string, availableIngredients: string[]): boolean {
  const normRecipe = normalizeText(recipeIng);
  return availableIngredients.some(avail => {
    const normAvail = normalizeText(avail);
    return normRecipe.includes(normAvail) || normAvail.includes(normRecipe);
  });
}

/**
 * Calculates matching score and identifies missing ingredients for a recipe.
 */
export function calculateRecipeMatch(recipe: Recipe, availableIngredients: string[]): MatchResult {
  if (recipe.ingredients.length === 0) {
    return {
      recipe,
      matchPercentage: 0,
      matchedIngredients: [],
      missingIngredients: [],
    };
  }

  const matchedIngredients: string[] = [];
  const missingIngredients: RecipeIngredient[] = [];

  recipe.ingredients.forEach(ing => {
    if (isIngredientMatched(ing.name, availableIngredients)) {
      matchedIngredients.push(ing.name);
    } else {
      missingIngredients.push(ing);
    }
  });

  const matchPercentage = Math.round((matchedIngredients.length / recipe.ingredients.length) * 100);

  return {
    recipe,
    matchPercentage,
    matchedIngredients,
    missingIngredients,
  };
}

/**
 * Filters and sorts recipes by match percentage and constraints (time, servings, meal preference).
 */
export function getRankedRecipes(
  recipes: Recipe[],
  availableIngredients: string[],
  maxTimeMinutes: number = 0,
  servingsFilter: number = 0,
  preference: string = 'Todas'
): MatchResult[] {
  return recipes
    .filter(recipe => {
      const totalTime = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
      if (maxTimeMinutes > 0 && totalTime > maxTimeMinutes) {
        return false;
      }
      if (preference !== 'Todas' && recipe.category !== preference && recipe.mealType !== preference) {
        return false;
      }
      return true;
    })
    .map(recipe => calculateRecipeMatch(recipe, availableIngredients))
    .sort((a, b) => b.matchPercentage - a.matchPercentage);
}

/**
 * Scales ingredient amounts based on base servings vs requested servings.
 */
export function scaleIngredientAmount(originalAmountStr: string, baseServings: number, targetServings: number): string {
  if (baseServings <= 0 || targetServings <= 0) return originalAmountStr;
  const ratio = targetServings / baseServings;
  const parsed = parseFloat(originalAmountStr);
  if (isNaN(parsed)) return originalAmountStr;
  const scaled = Math.round(parsed * ratio * 100) / 100;
  return scaled.toString();
}

/**
 * Validates whether measured fermentation parameters are within safe microbiology bounds.
 */
export function validateFermentationSafety(guide: FermentationGuide, measuredTempC: number, measuredPh: number): {
  isTempSafe: boolean;
  isPhSafe: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const tempDiff = Math.abs(measuredTempC - guide.targetTempC);
  const isTempSafe = tempDiff <= guide.tempToleranceC + 2; // Allow small tolerance band
  if (!isTempSafe) {
    warnings.push(`Temperatura actual (${measuredTempC}°C) desviada del rango óptimo (${guide.targetTempC} ±${guide.tempToleranceC}°C). Riesgo de inhibición del cultivo o crecimiento bacteriano no deseado.`);
  }

  const isPhSafe = measuredPh >= guide.phTargetMin - 0.2 && measuredPh <= guide.phTargetMax + 0.2;
  if (!isPhSafe) {
    warnings.push(`Nivel de pH (${measuredPh}) fuera del rango de inocuidad (${guide.phTargetMin} - ${guide.phTargetMax}).`);
  }

  return {
    isTempSafe,
    isPhSafe,
    warnings,
  };
}
