import test from 'node:test';
import assert from 'node:assert/strict';
import type { Recipe, RecipeIngredient } from './recipeMatcher.ts';
import { calculateRecipeMatch } from './recipeMatcher.ts';
import {
  buildSubstitutionContext,
  findSubstituteEntry,
  findSubstitutions,
  isTrivialIngredient,
  matchWithSubstitutions,
  missingWithoutSubstitute,
  substitutionAmount,
} from './ingredientSubstitution.ts';

// Recetas minimas con los mismos ingredientes del catalogo: las pruebas no dependen de
// las imagenes ni de los datos de la app, solo de los nombres y cantidades reales.
function makeRecipe(
  ingredients: RecipeIngredient[],
  title = 'Receta de prueba',
  category = 'Postres'
): Recipe {
  return {
    id: 'prueba',
    title,
    category,
    mealType: 'Desayuno',
    description: '',
    prepTimeMinutes: 5,
    cookTimeMinutes: 5,
    servings: 2,
    difficulty: 'Fácil',
    ingredients,
    steps: [],
    validationsCount: 0,
    isValidated: false,
    author: '',
    authorRole: '',
    imageUrl: '',
    wasteReductionTip: '',
  };
}

const PAN_FRANCES = makeRecipe(
  [
    { name: 'Pan de caja / bolillo', amount: '4', unit: 'rebanadas', essential: true },
    { name: 'Huevos', amount: '2', unit: 'piezas', essential: true },
    { name: 'Leche entera', amount: '0.25', unit: 'taza', essential: true },
    { name: 'Canela molida', amount: '0.5', unit: 'cucharadita', essential: false },
    { name: 'Vainilla', amount: '0.5', unit: 'cucharadita', essential: false },
    { name: 'Mantequilla o Aceite', amount: '1', unit: 'cucharada', essential: true },
    { name: 'Azúcar', amount: '1', unit: 'cucharadita', essential: false },
  ],
  'Pan Francés Dorado con Canela y Miel'
);

const ENFRIJOLADAS = makeRecipe(
  [
    { name: 'Tortillas de maíz', amount: '6', unit: 'piezas', essential: true },
    { name: 'Frijoles cocidos', amount: '2', unit: 'tazas', essential: true },
    { name: 'Queso Fresco', amount: '90', unit: 'g', essential: true },
    { name: 'Cebolla', amount: '0.25', unit: 'pieza', essential: false },
    { name: 'Crema ácida', amount: '2', unit: 'cucharadas', essential: false },
    { name: 'Aceite vegetal', amount: '1', unit: 'cucharada', essential: true },
  ],
  'Enfrijoladas Rápidas con Queso'
);

// Despensa sin leche, pero con yogur: el caso tipico de la funcionalidad.
const PANTRY_WITH_YOGURT = ['Pan de caja / bolillo', 'Huevos', 'Yogur natural'];

test('encuentra yogur natural cuando falta leche entera', () => {
  const result = calculateRecipeMatch(PAN_FRANCES, PANTRY_WITH_YOGURT);
  const suggestions = findSubstitutions(result.missingIngredients, PANTRY_WITH_YOGURT);

  const milk = suggestions.find((s) => s.missing === 'Leche entera');
  assert.ok(milk, 'hay sugerencia para la leche');
  assert.equal(milk.substitute, 'Yogur natural');
  assert.equal(milk.amount, '¼');
  assert.equal(milk.unit, 'taza');
  assert.equal(milk.source, 'base');
  assert.deepEqual(milk.allergens, ['lácteo']);
  assert.match(milk.explanation, /líquido/);
  assert.match(milk.explanation, /grasa/);
  assert.ok(milk.note.length > 10);
});

test('el porcentaje sube solo por el faltante cubierto, sin inflarse', () => {
  const original = calculateRecipeMatch(PAN_FRANCES, PANTRY_WITH_YOGURT);
  // 7 ingredientes, 2 en casa: 29 %. Con la leche cubierta: 3 de 7 = 43 %.
  assert.equal(original.matchPercentage, 29);

  const withSubstitutions = matchWithSubstitutions(original, PANTRY_WITH_YOGURT);
  assert.equal(withSubstitutions.originalPercentage, 29);
  assert.equal(withSubstitutions.matchPercentage, 43);
  assert.deepEqual(withSubstitutions.covered, ['Leche entera']);
  assert.ok(withSubstitutions.matchPercentage < 100);
});

test('sin sustituto en la despensa el porcentaje no cambia', () => {
  const pantry = ['Pan de caja / bolillo', 'Huevos'];
  const original = calculateRecipeMatch(PAN_FRANCES, pantry);
  const withSubstitutions = matchWithSubstitutions(original, pantry);

  assert.equal(withSubstitutions.suggestions.length, 0);
  assert.equal(withSubstitutions.matchPercentage, original.matchPercentage);
  assert.equal(withSubstitutions.covered.length, 0);
});

test('recomienda queso manchego u oaxaca cuando falta queso fresco', () => {
  const pantry = [
    'Tortillas de maíz',
    'Frijoles cocidos',
    'Cebolla',
    'Crema ácida',
    'Aceite vegetal',
    'Queso Manchego o Oaxaca',
  ];
  const result = calculateRecipeMatch(ENFRIJOLADAS, pantry);
  assert.ok(result.missingIngredients.some((ing) => ing.name === 'Queso Fresco'));

  const suggestions = findSubstitutions(result.missingIngredients, pantry);
  const cheese = suggestions.find((s) => s.missing === 'Queso Fresco');
  assert.ok(cheese);
  assert.equal(cheese.substitute, 'Queso Manchego o Oaxaca');
  assert.equal(cheese.amount, '90');
  assert.equal(cheese.unit, 'g');
  assert.deepEqual(cheese.allergens, ['lácteo']);
  assert.ok(cheese.note.length > 10);

  const withSubstitutions = matchWithSubstitutions(result, pantry);
  assert.equal(withSubstitutions.covered.includes('Queso Fresco'), true);
});

test('si el sustituto no esta en la despensa, el faltante se conserva', () => {
  const pantry = ['Tortillas de maíz', 'Frijoles cocidos', 'Cebolla', 'Crema ácida', 'Aceite vegetal'];
  const result = calculateRecipeMatch(ENFRIJOLADAS, pantry);

  const suggestions = findSubstitutions(result.missingIngredients, pantry);
  assert.equal(suggestions.length, 0);
  const uncovered = missingWithoutSubstitute(result.missingIngredients, pantry);
  assert.ok(uncovered.some((ing) => ing.name === 'Queso Fresco'));
});

test('una despensa vacia no rompe y no inventa sustitutos', () => {
  const result = calculateRecipeMatch(PAN_FRANCES, []);
  assert.equal(findSubstitutions(result.missingIngredients, []).length, 0);
  assert.equal(matchWithSubstitutions(result, []).matchPercentage, 0);
  assert.deepEqual(findSubstitutions(result.missingIngredients, undefined as unknown as string[]), []);
});

test('compara nombres sin acentos ni mayusculas', () => {
  const suggestion = findSubstitutions(
    [{ name: 'LECHE ENTERA', amount: '1', unit: 'taza', essential: true }],
    ['yogur NATURAL']
  );
  assert.equal(suggestion.length, 1);
  assert.equal(suggestion[0].substitute, 'Yogur natural');
});

test('la cantidad se ajusta con la proporcion y se muestra como medida de cocina', () => {
  const butter = findSubstituteEntry('Mantequilla o Aceite');
  assert.ok(butter);
  const option = butter.substitutes[0];
  const amount = substitutionAmount(
    { name: 'Mantequilla o Aceite', amount: '2', unit: 'cucharadas', essential: true },
    option
  );
  assert.equal(amount.amount, '1½');
  assert.equal(amount.unit, 'cucharadas');

  const unmeasured = substitutionAmount(
    { name: 'Mantequilla o Aceite', amount: 'al gusto', unit: 'al gusto', essential: false },
    option
  );
  assert.equal(unmeasured.amount, 'Al gusto');
});

test('la leche para hacer queso no se sustituye', () => {
  const entry = findSubstituteEntry('Leche entera pasteurizada');
  assert.ok(entry);
  assert.equal(entry.substitutes.length, 0);
  assert.match(entry.avoidWhen ?? '', /cuajada/);
});

test('todas las sugerencias salen de la despensa', () => {
  const pantry = ['Yogur natural', 'Crema ácida'];
  const result = calculateRecipeMatch(PAN_FRANCES, pantry);
  const suggestions = findSubstitutions(result.missingIngredients, pantry);
  assert.ok(suggestions.length > 0);
  for (const suggestion of suggestions) {
    assert.ok(
      pantry.some((item) => item.toLowerCase() === suggestion.substitute.toLowerCase()),
      `${suggestion.substitute} esta en la despensa`
    );
  }
});

test('el porcentaje nunca pasa de 100', () => {
  const pantry = ['Pan de caja / bolillo', 'Huevos', 'Yogur natural', 'Canela molida', 'Vainilla'];
  const result = calculateRecipeMatch(PAN_FRANCES, pantry);
  const withSubstitutions = matchWithSubstitutions(result, pantry);
  assert.ok(withSubstitutions.matchPercentage <= 100);
});

test('3 cucharadas de crema se sustituyen por 3 cucharadas de yogur, no por tazas', () => {
  const chilaquiles = makeRecipe(
    [
      { name: 'Tortillas de maíz', amount: '6', unit: 'piezas', essential: true },
      { name: 'Crema ácida', amount: '3', unit: 'cucharadas', essential: false },
    ],
    'Chilaquiles Rojos',
    'Tradicional Mexicana'
  );
  const pantry = ['Tortillas de maíz', 'Yogur natural'];
  const result = calculateRecipeMatch(chilaquiles, pantry);
  const suggestion = findSubstitutions(result.missingIngredients, pantry).find(
    (s) => s.missing === 'Crema ácida'
  );
  assert.ok(suggestion);
  assert.equal(suggestion.substitute, 'Yogur natural');
  assert.equal(suggestion.amount, '3');
  assert.equal(suggestion.unit, 'cucharadas');
});

test('½ taza de aceite se sustituye por ½ taza, no por ½ cucharada', () => {
  const pastel = makeRecipe(
    [{ name: 'Aceite vegetal', amount: '0.5', unit: 'taza', essential: true }],
    'Pastel de Zanahoria',
    'Postres'
  );
  const pick = findSubstitutions(
    [{ name: 'Aceite vegetal', amount: '0.5', unit: 'taza', essential: true }],
    ['Mantequilla o Aceite'],
    buildSubstitutionContext(pastel)
  )[0];
  assert.ok(pick);
  assert.equal(pick.substitute, 'Mantequilla o Aceite');
  assert.equal(pick.amount, '½');
  assert.equal(pick.unit, 'taza');
});

test('no propone yogur para el huevo en huevos a la mexicana', () => {
  const huevos = makeRecipe(
    [{ name: 'Huevos', amount: '4', unit: 'piezas', essential: true }],
    'Huevos a la Mexicana con Frijolitos',
    'Tradicional Mexicana'
  );
  const context = buildSubstitutionContext(huevos);
  const missing = [{ name: 'Huevos', amount: '4', unit: 'piezas', essential: true }];
  assert.deepEqual(findSubstitutions(missing, ['Yogur natural'], context), []);
  assert.deepEqual(missingWithoutSubstitute(missing, ['Yogur natural'], context), []);
});

test('tampoco propone yogur para chilaquiles con huevo', () => {
  const chilaquiles = makeRecipe(
    [{ name: 'Huevos', amount: '3', unit: 'piezas', essential: true }],
    'Chilaquiles Rojos con Huevo',
    'Tradicional Mexicana'
  );
  const context = buildSubstitutionContext(chilaquiles);
  const missing = [{ name: 'Huevos', amount: '3', unit: 'piezas', essential: true }];
  assert.deepEqual(findSubstitutions(missing, ['Yogur natural'], context), []);
});

test('sí propone yogur para el huevo en un pastel', () => {
  const pastel = makeRecipe(
    [{ name: 'Huevos', amount: '3', unit: 'piezas', essential: true }],
    'Pastel de Zanahoria',
    'Postres'
  );
  const context = buildSubstitutionContext(pastel);
  const suggestion = findSubstitutions(
    [{ name: 'Huevos', amount: '3', unit: 'piezas', essential: true }],
    ['Yogur natural'],
    context
  )[0];
  assert.ok(suggestion);
  assert.equal(suggestion.substitute, 'Yogur natural');
  assert.equal(suggestion.amount, '¾');
  assert.equal(suggestion.unit, 'taza');
});

test('sal, pimienta y agua no se mandan a la IA', () => {
  assert.equal(isTrivialIngredient('Sal y pimienta'), true);
  assert.equal(isTrivialIngredient('Agua no clorada'), true);
  assert.equal(isTrivialIngredient('Chile chipotle'), false);

  const sinSustituto = missingWithoutSubstitute(
    [
      { name: 'Sal y pimienta', amount: '1', unit: 'pizca', essential: true },
      { name: 'Chile chipotle', amount: '1', unit: 'pieza', essential: false },
    ],
    []
  );
  assert.deepEqual(sinSustituto.map((ingredient) => ingredient.name), ['Chile chipotle']);
});
