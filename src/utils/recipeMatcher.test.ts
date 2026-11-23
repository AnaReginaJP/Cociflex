import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeText,
  isIngredientMatched,
  calculateRecipeMatch,
  getRankedRecipes,
  scaleIngredientAmount,
  validateFermentationSafety,
} from './recipeMatcher.ts';
import type { Recipe, FermentationGuide } from './recipeMatcher.ts';

const dummyRecipe: Recipe = {
  id: 'test-1',
  title: 'Chilaquiles Rojos',
  category: 'Tradicional Mexicana',
  mealType: 'Desayuno',
  description: 'Chilaquiles crujientes con salsa roja y queso',
  prepTimeMinutes: 10,
  cookTimeMinutes: 15,
  servings: 2,
  difficulty: 'Fácil',
  ingredients: [
    { name: 'Tortillas de maíz', amount: '6', unit: 'piezas', essential: true },
    { name: 'Huevos', amount: '4', unit: 'piezas', essential: true },
    { name: 'Jitomate', amount: '3', unit: 'piezas', essential: true },
    { name: 'Cebolla', amount: '0.5', unit: 'pieza', essential: false },
    { name: 'Queso Fresco', amount: '100', unit: 'g', essential: false },
  ],
  steps: [
    { stepNumber: 1, title: 'Cortar tortillas', instruction: 'Cortar en triángulos y freír u hornear.' },
  ],
  validationsCount: 5,
  isValidated: true,
  author: 'Chef Gretel',
  authorRole: 'Cocinera Casera',
  imageUrl: '',
  wasteReductionTip: 'Aprovecha tortillas duras del día anterior',
};

test('normalizeText handles accents and uppercase', () => {
  assert.equal(normalizeText('  KÉFIR de Leche  '), 'kefir de leche');
  assert.equal(normalizeText('Tortilla'), 'tortilla');
});

test('isIngredientMatched correctly checks presence', () => {
  const userPantry = ['Tortillas', 'Huevos', 'Jitomate'];
  assert.equal(isIngredientMatched('Tortillas de maíz', userPantry), true);
  assert.equal(isIngredientMatched('Queso Fresco', userPantry), false);
});

test('calculateRecipeMatch calculates percentage and separates missing items', () => {
  const userPantry = ['Tortillas', 'Huevos', 'Jitomate'];
  const result = calculateRecipeMatch(dummyRecipe, userPantry);

  // 3 of 5 matched = 60%
  assert.equal(result.matchPercentage, 60);
  assert.equal(result.matchedIngredients.length, 3);
  assert.equal(result.missingIngredients.length, 2);
  assert.equal(result.missingIngredients[0].name, 'Cebolla');
  assert.equal(result.missingIngredients[1].name, 'Queso Fresco');
});

test('getRankedRecipes sorts recipes descending by match', () => {
  const recipe2: Recipe = {
    ...dummyRecipe,
    id: 'test-2',
    title: 'Huevos con Jitomate',
    ingredients: [
      { name: 'Huevos', amount: '2', unit: 'piezas', essential: true },
      { name: 'Jitomate', amount: '1', unit: 'pieza', essential: true },
    ],
  };

  const userPantry = ['Huevos', 'Jitomate']; // 100% for recipe2, 40% for dummyRecipe
  const ranked = getRankedRecipes([dummyRecipe, recipe2], userPantry);

  assert.equal(ranked[0].recipe.id, 'test-2');
  assert.equal(ranked[0].matchPercentage, 100);
  assert.equal(ranked[1].recipe.id, 'test-1');
  assert.equal(ranked[1].matchPercentage, 40);
});

test('scaleIngredientAmount scales correctly for diner count', () => {
  assert.equal(scaleIngredientAmount('2', 2, 4), '4');
  assert.equal(scaleIngredientAmount('100', 2, 3), '150');
  assert.equal(scaleIngredientAmount('al gusto', 2, 4), 'al gusto');
});

test('validateFermentationSafety flags temp and pH deviations', () => {
  const guide: FermentationGuide = {
    id: 'f-1',
    name: 'Queso Fresco Morelos',
    category: 'Queso',
    description: 'Queso artesanal',
    targetTempC: 35,
    tempToleranceC: 1,
    incubationTimeHours: 1,
    incubationTimeDisplay: '40 min',
    phTargetMin: 6.2,
    phTargetMax: 6.4,
    microbiology: 'Cuajo vegetal / microbiano',
    equipment: ['Olla de acero'],
    safetyChecklist: ['Leche pasteurizada'],
    ingredients: [],
    steps: [],
    validationsCount: 19,
    badge: '100% Inocuidad',
  };

  const safeResult = validateFermentationSafety(guide, 35.5, 6.3);
  assert.equal(safeResult.isTempSafe, true);
  assert.equal(safeResult.isPhSafe, true);
  assert.equal(safeResult.warnings.length, 0);

  const unsafeResult = validateFermentationSafety(guide, 45, 5.0);
  assert.equal(unsafeResult.isTempSafe, false);
  assert.equal(unsafeResult.isPhSafe, false);
  assert.equal(unsafeResult.warnings.length, 2);
});
