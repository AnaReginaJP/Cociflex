import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmount,
  roundToKitchenFraction,
  formatKitchenNumber,
  prettyAmount,
  compatibleUnits,
  isMeasurable,
  scaleQuantitiesInText,
  partitionRecipe,
} from './recipePartition.ts';
import type { Recipe } from './recipeMatcher.ts';

const cake: Recipe = {
  id: 'pastel',
  title: 'Pastel de Zanahoria',
  category: 'Postres',
  mealType: 'Postre',
  description: 'Bizcocho húmedo de zanahoria.',
  prepTimeMinutes: 15,
  cookTimeMinutes: 35,
  servings: 6,
  difficulty: 'Fácil',
  ingredients: [
    { name: 'Zanahorias', amount: '3', unit: 'piezas grandes', essential: true },
    { name: 'Huevos', amount: '3', unit: 'piezas', essential: true },
    { name: 'Harina de trigo', amount: '2', unit: 'tazas', essential: true },
    { name: 'Aceite vegetal', amount: '0.5', unit: 'taza', essential: true },
    { name: 'Azúcar', amount: '0.75', unit: 'taza', essential: true },
    { name: 'Vainilla', amount: '1', unit: 'cucharadita', essential: false },
    { name: 'Sal', amount: '1', unit: 'pizca', essential: true },
  ],
  steps: [
    { stepNumber: 1, title: 'Batir', instruction: 'Bate los huevos con media taza de azúcar.', timeMinutes: 4 },
    { stepNumber: 2, title: 'Hornear', instruction: 'Vierte en un molde y hornea a 180°C por 35 minutos.', timeMinutes: 35 },
  ],
  validationsCount: 1,
  isValidated: true,
  author: 'Prueba',
  authorRole: 'Prueba',
  imageUrl: '',
  wasteReductionTip: '',
};

const stew: Recipe = {
  ...cake,
  id: 'tinga',
  title: 'Tinga de Pollo',
  mealType: 'Plato Fuerte',
  servings: 4,
  ingredients: [
    { name: 'Pollo', amount: '400', unit: 'g', essential: true },
    { name: 'Leche', amount: '1', unit: 'litro', essential: true },
    { name: 'Cebolla', amount: '0.5', unit: 'pieza', essential: true },
    { name: 'Queso', amount: '80', unit: 'g', essential: false },
  ],
  steps: [{ stepNumber: 1, title: 'Guisar', instruction: 'Guisa todo en una cacerola con 2 cucharadas de aceite.' }],
};

const ingredientNamed = (plan: { ingredients: { name: string }[] }, name: string) =>
  plan.ingredients.find((i) => i.name === name) as any;

test('parseAmount reads numbers, fractions, words and ranges', () => {
  assert.equal(parseAmount('2'), 2);
  assert.equal(parseAmount('0.5'), 0.5);
  assert.equal(parseAmount('0,75'), 0.75);
  assert.equal(parseAmount('1/2'), 0.5);
  assert.equal(parseAmount('1 1/2'), 1.5);
  assert.equal(parseAmount('1½'), 1.5);
  assert.equal(parseAmount('½'), 0.5);
  assert.equal(parseAmount('media'), 0.5);
  assert.equal(parseAmount('un cuarto'), 0.25);
  assert.equal(parseAmount('tres cuartos'), 0.75);
  assert.equal(parseAmount('1 y media'), 1.5);
  assert.equal(parseAmount('1-2'), 1.5);
  assert.equal(parseAmount('2 tazas'), 2);
  assert.equal(parseAmount('0'), 0);
  assert.equal(parseAmount('al gusto'), null);
  assert.equal(parseAmount(''), null);
});

test('kitchen fractions round to measurable amounts', () => {
  assert.equal(formatKitchenNumber(roundToKitchenFraction(0.66)), '⅔');
  assert.equal(formatKitchenNumber(roundToKitchenFraction(1.5)), '1½');
  assert.equal(formatKitchenNumber(roundToKitchenFraction(0.9)), '1');
  assert.equal(formatKitchenNumber(roundToKitchenFraction(0.9, 'down')), '¾');
  assert.equal(formatKitchenNumber(roundToKitchenFraction(0.1, 'nearest', true)), '⅛');
  assert.equal(formatKitchenNumber(0.9), '0.9');
  assert.equal(prettyAmount('0.75'), '¾');
  assert.equal(prettyAmount('80'), '80');
  assert.equal(prettyAmount('al gusto'), 'al gusto');
});

test('compatibleUnits offers only units that can be converted', () => {
  assert.deepEqual(
    compatibleUnits('tazas').map((u) => u.value),
    ['taza', 'cucharada', 'cucharadita', 'ml', 'l']
  );
  assert.deepEqual(compatibleUnits('piezas grandes'), [{ value: 'pieza', label: 'piezas grandes' }]);
  assert.deepEqual(compatibleUnits('g').map((u) => u.value), ['g', 'kg']);
  assert.deepEqual(compatibleUnits('pizca'), []);
  assert.equal(isMeasurable({ name: 'Sal', amount: '1', unit: 'pizca', essential: true }), false);
  assert.equal(isMeasurable({ name: 'Sal', amount: 'al gusto', unit: '', essential: true }), false);
});

test('the scarcest ingredient sets the proportion for the whole recipe', () => {
  const outcome = partitionRecipe(cake, [{ index: 2, amount: '1', unit: 'taza' }]);
  assert.ok(outcome.ok);
  const plan = outcome.plan;
  assert.equal(plan.factor, 0.5);
  assert.equal(plan.percent, 50);
  assert.equal(plan.limitingIngredient, 'Harina de trigo');
  assert.equal(plan.servingsLabel, '3 porciones');
  assert.equal(plan.isFullRecipe, false);

  const flour = ingredientNamed(plan, 'Harina de trigo');
  assert.equal(flour.limiting, true);
  assert.equal(`${flour.amount} ${flour.unit}`, '1 taza');

  assert.equal(`${ingredientNamed(plan, 'Zanahorias').amount} ${ingredientNamed(plan, 'Zanahorias').unit}`, '1½ piezas grandes');
  assert.equal(ingredientNamed(plan, 'Aceite vegetal').amount, '¼');
  // ⅜ taza has no simple fraction: it becomes exact tablespoons
  assert.equal(`${ingredientNamed(plan, 'Azúcar').amount} ${ingredientNamed(plan, 'Azúcar').unit}`, '6 cucharadas');
  assert.equal(`${ingredientNamed(plan, 'Vainilla').amount} ${ingredientNamed(plan, 'Vainilla').unit}`, '½ cucharadita');
  // A pinch stays a pinch
  assert.equal(`${ingredientNamed(plan, 'Sal').amount} ${ingredientNamed(plan, 'Sal').unit}`, '1 pizca');
});

test('eggs are split only in halves, with a tip on how to measure half an egg', () => {
  const outcome = partitionRecipe(cake, [{ index: 2, amount: '1', unit: 'taza' }]);
  assert.ok(outcome.ok);
  const eggs = ingredientNamed(outcome.plan, 'Huevos');
  assert.equal(`${eggs.amount} ${eggs.unit}`, '1½ piezas');
  assert.match(eggs.note, /medio huevo/);
});

test('amounts in other units are converted before comparing', () => {
  // 6 tablespoons of flour out of 2 cups = 90 ml / 480 ml
  const outcome = partitionRecipe(cake, [{ index: 2, amount: '6', unit: 'cucharada' }]);
  assert.ok(outcome.ok);
  assert.equal(outcome.plan.factor, 0.1875);
  assert.equal(outcome.plan.percent, 18);
  assert.ok(outcome.plan.tips.some((t) => t.includes('muy poquito')));

  const milk = partitionRecipe(stew, [{ index: 1, amount: '500', unit: 'ml' }]);
  assert.ok(milk.ok);
  assert.equal(milk.plan.factor, 0.5);
  assert.equal(`${ingredientNamed(milk.plan, 'Leche').amount} ${ingredientNamed(milk.plan, 'Leche').unit}`, '500 ml');
  assert.equal(`${ingredientNamed(milk.plan, 'Pollo').amount} ${ingredientNamed(milk.plan, 'Pollo').unit}`, '200 g');
});

test('with several short ingredients the smallest share wins and the others never exceed what you have', () => {
  const outcome = partitionRecipe(cake, [
    { index: 1, amount: '2', unit: 'pieza' }, // 2 of 3 eggs → 66 %
    { index: 2, amount: '1', unit: 'taza' }, // 1 of 2 cups → 50 %
  ]);
  assert.ok(outcome.ok);
  assert.equal(outcome.plan.limitingIngredient, 'Harina de trigo');
  const eggs = ingredientNamed(outcome.plan, 'Huevos');
  assert.equal(eggs.limited, true);
  assert.equal(eggs.limiting, false);
  assert.ok(parseAmount(eggs.amount)! <= 2);
  assert.deepEqual(
    outcome.plan.missingForFullRecipe.map((m) => `${m.amount} ${m.unit} ${m.name}`),
    ['1 pieza Huevos', '1 taza Harina de trigo']
  );
});

test('baking recipes get the smaller-pan tip; stews get the smaller-pot tip', () => {
  const cakePlan = partitionRecipe(cake, [{ index: 2, amount: '1', unit: 'taza' }]);
  const stewPlan = partitionRecipe(stew, [{ index: 0, amount: '200', unit: 'g' }]);
  assert.ok(cakePlan.ok && stewPlan.ok);
  assert.match(cakePlan.plan.tips[0], /molde/);
  assert.match(stewPlan.plan.tips[0], /olla o sartén/);
});

test('steps keep times and temperatures but reduce measured amounts', () => {
  const outcome = partitionRecipe(cake, [{ index: 2, amount: '1', unit: 'taza' }]);
  assert.ok(outcome.ok);
  assert.equal(outcome.plan.steps[0].instruction, 'Bate los huevos con ¼ taza de azúcar.');
  assert.equal(outcome.plan.steps[1].instruction, cake.steps[1].instruction);

  assert.equal(scaleQuantitiesInText('Agrega 2 cucharadas de aceite.', 0.5), 'Agrega 1 cucharada de aceite.');
  assert.equal(scaleQuantitiesInText('Licúa con 1 litro de agua.', 0.5), 'Licúa con 500 ml de agua.');
  assert.equal(scaleQuantitiesInText('Hornea 8 minutos a 190°C.', 0.5), 'Hornea 8 minutos a 190°C.');
  // Per-piece amounts don't change when you make fewer pieces
  assert.equal(
    scaleQuantitiesInText('Coloca una cucharada de puré en cada tortilla.', 0.5),
    'Coloca una cucharada de puré en cada tortilla.'
  );
});

test('an optional ingredient you lack is omitted; a missing essential one is an error', () => {
  const omitted = partitionRecipe(stew, [{ index: 3, amount: '0', unit: 'g' }]);
  assert.ok(omitted.ok);
  assert.equal(omitted.plan.isFullRecipe, true);
  assert.equal(ingredientNamed(omitted.plan, 'Queso').omitted, true);
  assert.ok(omitted.plan.tips.some((t) => t.includes('Queso')));

  const essential = partitionRecipe(stew, [{ index: 0, amount: '0', unit: 'g' }]);
  assert.equal(essential.ok, false);
});

test('having enough keeps the original recipe; bad input gives a clear error', () => {
  const enough = partitionRecipe(cake, [{ index: 2, amount: '3', unit: 'taza' }]);
  assert.ok(enough.ok);
  assert.equal(enough.plan.isFullRecipe, true);
  assert.equal(enough.plan.factor, 1);
  assert.equal(ingredientNamed(enough.plan, 'Harina de trigo').amount, '2');
  assert.deepEqual(enough.plan.missingForFullRecipe, []);

  const wrongUnit = partitionRecipe(cake, [{ index: 2, amount: '100', unit: 'g' }]);
  assert.equal(wrongUnit.ok, false);
  const notANumber = partitionRecipe(cake, [{ index: 2, amount: 'poquita', unit: 'taza' }]);
  assert.equal(notANumber.ok, false);
  const unmeasured = partitionRecipe(cake, [{ index: 6, amount: '1', unit: 'pizca' }]);
  assert.equal(unmeasured.ok, false);
  assert.equal(partitionRecipe(cake, []).ok, false);
});
