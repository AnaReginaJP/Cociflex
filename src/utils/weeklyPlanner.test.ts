import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_NAMES,
  buildShoppingList,
  shoppingQuantity,
  buildWeeklyPlan,
  displayAmount,
  isVegan,
  isVegetarian,
  namesForMandado,
  rebuildWeeklyPlan,
  replaceDay,
  unitKey,
  validatePlannerInput,
} from './weeklyPlanner.ts';
import type { PlannerInput } from './weeklyPlanner.ts';
import type { Recipe, RecipeIngredient } from './recipeMatcher.ts';

const ing = (name: string, amount: string, unit: string): RecipeIngredient => ({
  name,
  amount,
  unit,
  essential: true,
});

function recipe(
  id: string,
  mealType: Recipe['mealType'],
  category: string,
  minutes: number,
  servings: number,
  ingredients: RecipeIngredient[]
): Recipe {
  return {
    id,
    title: id,
    category,
    mealType,
    description: '',
    prepTimeMinutes: Math.floor(minutes / 2),
    cookTimeMinutes: minutes - Math.floor(minutes / 2),
    servings,
    difficulty: 'Fácil',
    ingredients,
    steps: [],
    validationsCount: 1,
    isValidated: true,
    author: 'test',
    authorRole: 'test',
    imageUrl: '',
    wasteReductionTip: '',
  };
}

// A small catalog that mirrors the real one (same ingredient names and units).
const CATALOG: Recipe[] = [
  recipe('chilaquiles', 'Desayuno', 'Tradicional Mexicana', 25, 2, [
    ing('Tortillas de maíz', '8', 'piezas'), ing('Huevos', '4', 'piezas'), ing('Jitomate', '3', 'piezas'),
    ing('Cebolla', '0.5', 'pieza'), ing('Queso Fresco', '80', 'g'), ing('Aceite vegetal', '2', 'cucharadas'),
  ]),
  recipe('huevos-mexicana', 'Desayuno', 'Tradicional Mexicana', 15, 2, [
    ing('Huevos', '4', 'piezas'), ing('Jitomate', '2', 'piezas'), ing('Cebolla', '0.25', 'pieza'),
    ing('Frijoles cocidos', '1', 'taza'), ing('Sal', '1', 'pizca'),
  ]),
  recipe('sopa-tortilla', 'Sopa y Caldo', 'Tradicional Mexicana', 35, 4, [
    ing('Tortillas de maíz', '10', 'piezas'), ing('Jitomate', '4', 'piezas'), ing('Cebolla', '0.5', 'pieza'),
    ing('Caldo de pollo o verduras', '4', 'tazas'), ing('Aguacate', '1', 'pieza'),
  ]),
  recipe('tinga-pollo', 'Plato Fuerte', 'Tradicional Mexicana', 35, 4, [
    ing('Pollo / Pechuga', '400', 'g'), ing('Cebolla', '2', 'piezas'), ing('Jitomate', '4', 'piezas'),
    ing('Chile chipotle', '2', 'piezas'),
  ]),
  recipe('enfrijoladas', 'Cena', 'Tradicional Mexicana', 15, 2, [
    ing('Tortillas de maíz', '6', 'piezas'), ing('Frijoles cocidos', '2', 'tazas'), ing('Queso Fresco', '90', 'g'),
    ing('Cebolla', '0.25', 'pieza'),
  ]),
  recipe('calabacitas', 'Comida', 'Tradicional Mexicana', 25, 3, [
    ing('Calabacitas', '3', 'piezas'), ing('Elote / granos de maíz', '1', 'taza'), ing('Jitomate', '2', 'piezas'),
    ing('Cebolla', '0.5', 'pieza'), ing('Queso Fresco', '80', 'g'),
  ]),
  recipe('arroz-pollo', 'Plato Fuerte', 'Tradicional Mexicana', 40, 4, [
    ing('Arroz', '1.5', 'tazas'), ing('Pollo / Pechuga', '400', 'g'), ing('Jitomate', '3', 'piezas'),
    ing('Zanahorias', '1', 'pieza'),
  ]),
  recipe('tacos-papa', 'Comida', 'Vegetarianas', 25, 2, [
    ing('Tortillas de maíz', '8', 'piezas'), ing('Papas', '2', 'piezas'), ing('Queso Fresco', '60', 'g'),
    ing('Crema ácida', '3', 'cucharadas'),
  ]),
  recipe('pasta-tomate', 'Cena', 'Rápidas', 17, 2, [
    ing('Pasta / Espagueti', '200', 'g'), ing('Jitomate', '2', 'piezas'), ing('Ajo', '2', 'dientes'),
    ing('Queso Fresco o Parmesano', '40', 'g'),
  ]),
  // These two never go in a weekly menu: a dessert and a fermentation recipe.
  recipe('pastel', 'Postre', 'Postres', 50, 6, [ing('Harina de trigo', '2', 'tazas'), ing('Huevos', '3', 'piezas')]),
  recipe('queso-morelos', 'Plato Fuerte', 'Fermentación y Bioartesanal', 60, 4, [ing('Leche entera', '12', 'tazas')]),
];

const BASE: PlannerInput = { personas: 2, presupuesto: 800, minutosPorDia: 60, dieta: 'Todas' };

const mealIds = (plan: ReturnType<typeof buildWeeklyPlan>) => plan.days.map((d) => d.recipeId);

// ---------- Input ----------

test('validatePlannerInput accepts good values, also written as text', () => {
  const result = validatePlannerInput({ personas: '4', presupuesto: '1200,50', minutosPorDia: 45, dieta: 'Vegetariano' });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.input, { personas: 4, presupuesto: 1200.5, minutosPorDia: 45, dieta: 'Vegetariano' });
});

test('validatePlannerInput explains every wrong value and never throws', () => {
  const result = validatePlannerInput({ personas: 'abc', presupuesto: '', minutosPorDia: -5 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errors.length, 3);
  for (const personas of [0, 2.5, 21, null]) {
    const r = validatePlannerInput({ personas, presupuesto: 500, minutosPorDia: 30 });
    assert.equal(r.ok, false);
  }
  const huge = validatePlannerInput({ personas: 2, presupuesto: 1e9, minutosPorDia: 30 });
  assert.equal(huge.ok, false);
});

test('validatePlannerInput falls back to "Todas" for an unknown diet', () => {
  const r = validatePlannerInput({ personas: 2, presupuesto: 500, minutosPorDia: 30, dieta: 'Carnívoro' });
  assert.equal(r.ok && r.input.dieta, 'Todas');
});

// ---------- Diet ----------

test('vegetarian is decided by ingredients, not by category', () => {
  const byId = (id: string) => CATALOG.find((r) => r.id === id)!;
  assert.equal(isVegetarian(byId('huevos-mexicana')), true); // category is "Tradicional Mexicana"
  assert.equal(isVegetarian(byId('tinga-pollo')), false);
  assert.equal(isVegetarian(byId('arroz-pollo')), false);
  assert.equal(isVegetarian(byId('sopa-tortilla')), true); // "caldo de pollo o verduras"
  assert.equal(isVegan(byId('huevos-mexicana')), false);
  assert.equal(isVegan(byId('sopa-tortilla')), true);
});

test('a vegetarian menu has no meat and notes the vegetable stock', () => {
  const plan = buildWeeklyPlan(CATALOG, { ...BASE, dieta: 'Vegetariano' });
  assert.equal(plan.days.length, 7);
  for (const id of mealIds(plan)) assert.ok(!['tinga-pollo', 'arroz-pollo'].includes(id));
  assert.ok(plan.warnings.some((w) => /caldo de verduras/.test(w)));
});

test('a vegan menu with no vegan dish gives a clear warning and does not break', () => {
  const noVegan = CATALOG.filter((r) => !isVegan(r));
  const plan = buildWeeklyPlan(noVegan, { ...BASE, dieta: 'Vegano' });
  assert.equal(plan.days.length, 0);
  assert.equal(plan.totalCost, 0);
  assert.match(plan.warnings[0], /Ninguna receta/);
});

// ---------- Time ----------

test('only dishes that fit the daily time are planned', () => {
  const plan = buildWeeklyPlan(CATALOG, { ...BASE, minutosPorDia: 20 });
  assert.ok(plan.days.length > 0);
  for (const day of plan.days) assert.ok(day.minutes <= 20);
  assert.ok(plan.warnings.some((w) => /se repiten/.test(w)));
});

test('with 15 minutes and nothing that fits, it warns instead of failing', () => {
  const slow = CATALOG.filter((r) => r.prepTimeMinutes + r.cookTimeMinutes > 15);
  const plan = buildWeeklyPlan(slow, { ...BASE, minutosPorDia: 15 });
  assert.equal(plan.days.length, 0);
  assert.match(plan.warnings[0], /15 minutos/);
});

test('desserts and fermentation recipes are never part of the menu', () => {
  const plan = buildWeeklyPlan(CATALOG, { ...BASE, minutosPorDia: 240 });
  for (const id of mealIds(plan)) assert.ok(!['pastel', 'queso-morelos'].includes(id));
});

// ---------- Variety and the plan itself ----------

test('with enough recipes the week has 7 different dishes, one per day', () => {
  const plan = buildWeeklyPlan(CATALOG, BASE);
  assert.deepEqual(plan.days.map((d) => d.day), DAY_NAMES);
  assert.equal(new Set(mealIds(plan)).size, 7);
});

test('the same input always gives the same menu', () => {
  assert.deepEqual(mealIds(buildWeeklyPlan(CATALOG, BASE)), mealIds(buildWeeklyPlan(CATALOG, BASE)));
});

test('with a single recipe it repeats it every day but never crashes', () => {
  const plan = buildWeeklyPlan([CATALOG[0]], BASE);
  assert.equal(plan.days.length, 7);
  assert.ok(plan.warnings.some((w) => /1 receta distinta/.test(w)));
});

test('an empty catalog gives an empty plan with a warning', () => {
  const plan = buildWeeklyPlan([], BASE);
  assert.equal(plan.days.length, 0);
  assert.equal(plan.shopping.length, 0);
  assert.equal(plan.warnings.length, 1);
});

test('the menu prefers dishes that share ingredients', () => {
  const shared = recipe('a', 'Comida', 'x', 20, 2, [ing('Jitomate', '2', 'piezas'), ing('Cebolla', '1', 'pieza')]);
  const alsoShared = recipe('b', 'Cena', 'x', 20, 2, [ing('Jitomate', '2', 'piezas'), ing('Cebolla', '1', 'pieza')]);
  const lonely = recipe('c', 'Sopa y Caldo', 'x', 20, 2, [ing('Aguacate', '1', 'pieza'), ing('Papas', '2', 'piezas')]);
  const plan = buildWeeklyPlan([lonely, shared, alsoShared], { ...BASE, personas: 2 });
  assert.deepEqual(mealIds(plan).slice(0, 2).sort(), ['a', 'b']);
});

// ---------- People, cost and shopping ----------

test('amounts follow the number of people: 1 and 6 people', () => {
  const one = buildWeeklyPlan([CATALOG[1]], { ...BASE, personas: 1 });
  const six = buildWeeklyPlan([CATALOG[1]], { ...BASE, personas: 6 });
  const huevos = (p: typeof one) => p.days[0].ingredients.find((i) => i.name === 'Huevos')!.amount;
  assert.equal(huevos(one), 2); // 4 eggs for 2 people → 2 for 1
  assert.equal(huevos(six), 12);
  assert.ok(six.totalCost > one.totalCost * 5.9 && six.totalCost < one.totalCost * 6.1);
});

test('an ingredient used on two days is one line with the added amount and cost', () => {
  const plan = buildWeeklyPlan(CATALOG, BASE);
  const jitomate = plan.shopping.find((l) => l.name === 'Jitomate')!;
  const used = plan.days.filter((d) => d.ingredients.some((i) => i.name === 'Jitomate'));
  assert.ok(used.length >= 2);
  assert.deepEqual(jitomate.days, used.map((d) => d.day));
  const expectedAmount = used.reduce((sum, d) => sum + d.ingredients.find((i) => i.name === 'Jitomate')!.amount!, 0);
  assert.equal(jitomate.quantity, shoppingQuantity(expectedAmount, 'pieza'));
  assert.match(jitomate.quantity, /^\d+ piezas/); // you buy whole tomatoes
  assert.equal(plan.shopping.filter((l) => l.name === 'Jitomate').length, 1);
});

test('buildShoppingList adds fractions and keeps different units apart', () => {
  const plan = buildWeeklyPlan(
    [
      recipe('x', 'Comida', 'x', 20, 2, [ing('Cebolla', '0.5', 'pieza'), ing('Leche entera', '1', 'taza')]),
      recipe('y', 'Cena', 'x', 20, 2, [ing('Cebolla', '0.25', 'pieza'), ing('Leche entera', '200', 'ml')]),
    ],
    { ...BASE }
  );
  // The week repeats both dishes; take one day of each to check the addition.
  const oneOfEach = ['x', 'y'].map((id) => plan.days.find((d) => d.recipeId === id)!);
  const list = buildShoppingList(oneOfEach);
  assert.equal(list.find((l) => l.name === 'Cebolla')?.quantity, '1 pieza (usas ¾)');
  assert.equal(list.find((l) => l.name === 'Leche entera')?.quantity.includes(' + '), true);
});

test('the shopping list rounds up what is bought whole and keeps the amount used', () => {
  assert.equal(shoppingQuantity(4 + 1 / 3, 'diente'), '5 dientes (usas 4⅓)');
  assert.equal(shoppingQuantity(1.75, 'pieza'), '2 piezas (usas 1¾)');
  assert.equal(shoppingQuantity(0.5, 'pieza'), '1 pieza (usas ½)');
  assert.equal(shoppingQuantity(12, 'pieza'), '12 piezas');
  assert.equal(shoppingQuantity((0.1 + 0.2) * 10, 'pieza'), '3 piezas'); // floating-point noise is not a fourth piece
  // Measured units are not rounded up
  assert.equal(shoppingQuantity(1.5, 'taza'), '1½ tazas');
  assert.equal(shoppingQuantity(363, 'g'), '363 g');
});

test('an ingredient with no price makes the cost partial and says so', () => {
  const odd = recipe('odd', 'Comida', 'x', 20, 2, [ing('Nopales', '4', 'piezas'), ing('Jitomate', '2', 'piezas')]);
  const plan = buildWeeklyPlan([odd], BASE);
  assert.equal(plan.unpricedCount, 1);
  assert.ok(plan.warnings.some((w) => /no tiene precio/.test(w)));
  assert.ok(plan.totalCost > 0);
});

test('amounts like "al gusto" do not break the plan', () => {
  const taste = recipe('taste', 'Comida', 'x', 20, 2, [ing('Sal', 'al gusto', ''), ing('Jitomate', '1/2', 'pieza')]);
  const plan = buildWeeklyPlan([taste], BASE);
  assert.equal(plan.days.length, 7);
  assert.match(plan.shopping.find((l) => l.name === 'Sal')!.quantity, /al gusto/);
});

test('a very low budget shows a clear warning and still gives a menu', () => {
  const plan = buildWeeklyPlan(CATALOG, { ...BASE, presupuesto: 50 });
  assert.equal(plan.days.length, 7);
  assert.ok(plan.totalCost > 50);
  assert.ok(plan.warnings.some((w) => /más que tu presupuesto/.test(w)));
});

test('a generous budget gives no budget warning', () => {
  const plan = buildWeeklyPlan(CATALOG, { ...BASE, presupuesto: 20000 });
  assert.ok(!plan.warnings.some((w) => /presupuesto/.test(w)));
});

test('a low budget picks a cheaper menu than a high one', () => {
  const low = buildWeeklyPlan(CATALOG, { ...BASE, presupuesto: 100, minutosPorDia: 60 });
  const high = buildWeeklyPlan(CATALOG, { ...BASE, presupuesto: 20000, minutosPorDia: 60 });
  assert.ok(low.totalCost <= high.totalCost);
});

test('very large groups scale without producing broken numbers', () => {
  const plan = buildWeeklyPlan(CATALOG, { ...BASE, personas: 20 });
  assert.ok(Number.isFinite(plan.totalCost));
  for (const line of plan.shopping) assert.ok(!/NaN|undefined/.test(line.quantity));
});

// ---------- Change one day ----------

test('"cambiar este día" replaces only that day and recalculates the totals', () => {
  const plan = buildWeeklyPlan(CATALOG, BASE);
  const result = replaceDay(CATALOG, plan, 3);
  assert.equal(result.changed, true);
  const before = mealIds(plan);
  const after = mealIds(result.plan);
  assert.notEqual(after[3], before[3]);
  assert.deepEqual(after.filter((_, i) => i !== 3), before.filter((_, i) => i !== 3));
  assert.equal(
    result.plan.totalCost,
    Math.round(result.plan.days.reduce((s, d) => s + d.cost, 0) * 100) / 100
  );
});

test('changing a day twice in a row never repeats the dish it just left on the same spot', () => {
  let plan = buildWeeklyPlan(CATALOG, BASE);
  const seen = new Set<string>([plan.days[3].recipeId]);
  for (let i = 0; i < 3; i++) {
    const next = replaceDay(CATALOG, plan, 3);
    assert.equal(next.changed, true);
    assert.notEqual(next.plan.days[3].recipeId, plan.days[3].recipeId);
    seen.add(next.plan.days[3].recipeId);
    plan = next.plan;
  }
  assert.ok(seen.size >= 2);
});

test('"cambiar este día" with no other recipe leaves the plan as it was', () => {
  const plan = buildWeeklyPlan([CATALOG[0]], BASE);
  const result = replaceDay([CATALOG[0]], plan, 2);
  assert.equal(result.changed, false);
  assert.ok(result.message);
  assert.deepEqual(mealIds(result.plan), mealIds(plan));
});

test('replaceDay rejects a day that is not in the menu', () => {
  const plan = buildWeeklyPlan(CATALOG, BASE);
  assert.equal(replaceDay(CATALOG, plan, 9).changed, false);
  assert.equal(replaceDay(CATALOG, plan, -1).changed, false);
});

// ---------- Saved plans ----------

test('rebuildWeeklyPlan gives the same menu back from the saved ids', () => {
  const plan = buildWeeklyPlan(CATALOG, BASE);
  const rebuilt = rebuildWeeklyPlan(CATALOG, BASE, mealIds(plan));
  assert.deepEqual(rebuilt && mealIds(rebuilt), mealIds(plan));
  assert.equal(rebuilt?.totalCost, plan.totalCost);
});

test('rebuildWeeklyPlan returns null if a recipe disappeared or the data is odd', () => {
  assert.equal(rebuildWeeklyPlan(CATALOG, BASE, ['no-existe']), null);
  assert.equal(rebuildWeeklyPlan(CATALOG, BASE, []), null);
  assert.equal(rebuildWeeklyPlan(CATALOG, BASE, new Array(8).fill('chilaquiles')), null);
});

// ---------- Mandado ----------

test('namesForMandado skips what is already there and never repeats a name', () => {
  const plan = buildWeeklyPlan(CATALOG, BASE);
  const names = namesForMandado(plan, ['jitomate', 'CEBOLLA', 'Cilantro']);
  const normalized = names.map((n) => n.toLowerCase());
  assert.ok(!normalized.includes('jitomate'));
  assert.ok(!normalized.includes('cebolla'));
  assert.equal(new Set(normalized).size, names.length);
  assert.ok(names.length > 0);
});

test('sending the list twice adds nothing the second time', () => {
  const plan = buildWeeklyPlan(CATALOG, BASE);
  const first = namesForMandado(plan, ['Cilantro']);
  const second = namesForMandado(plan, ['Cilantro', ...first]);
  assert.deepEqual(second, []);
});

test('unitKey reduces units to a comparable singular form', () => {
  assert.equal(unitKey('piezas grandes'), 'pieza');
  assert.equal(unitKey('cucharada sopera'), 'cucharada');
  assert.equal(unitKey('g cocido'), 'g');
  assert.equal(unitKey('dientes'), 'diente');
  assert.equal(unitKey(''), '');
});

test('displayAmount shows kitchen fractions and whole grams', () => {
  assert.equal(displayAmount(4.83, 'dientes'), '4¾');
  assert.equal(displayAmount(0.5, 'pieza'), '½');
  assert.equal(displayAmount(2, 'piezas'), '2');
  assert.equal(displayAmount(133.4, 'g'), '133');
  assert.equal(displayAmount(0.2, 'g'), '1');
  assert.equal(displayAmount(0.02, 'pizca'), '0.02');
});
