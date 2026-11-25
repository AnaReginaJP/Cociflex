import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PANTRY_EXPIRY_STORAGE_KEY,
  addDaysToKey,
  buildExpiryReport,
  daysUntil,
  describeExpiry,
  getExpiryStatus,
  getMissingForShopping,
  getRescueIngredients,
  getRescueRecipes,
  isValidDateKey,
  loadExpiryDates,
  saveExpiryDates,
  setExpiryDate,
  toDateKey,
} from './pantryExpiry.ts';
import type { Recipe } from './recipeMatcher.ts';

// Martes 24 de noviembre de 2026, hora local
const TODAY = new Date(2026, 10, 24, 15, 30);

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

function makeRecipe(id: string, names: string[]): Recipe {
  return {
    id,
    title: `Receta ${id}`,
    category: 'Tradicional Mexicana',
    mealType: 'Comida',
    description: '',
    prepTimeMinutes: 10,
    cookTimeMinutes: 10,
    servings: 2,
    difficulty: 'Fácil',
    ingredients: names.map((name) => ({ name, amount: '1', unit: 'pieza', essential: true })),
    steps: [],
    validationsCount: 0,
    isValidated: false,
    author: 'Prueba',
    authorRole: 'Prueba',
    imageUrl: '',
    wasteReductionTip: '',
  };
}

test('toDateKey y addDaysToKey usan la fecha local y cruzan meses y años', () => {
  assert.equal(toDateKey(TODAY), '2026-11-24');
  assert.equal(addDaysToKey(TODAY, 0), '2026-11-24');
  assert.equal(addDaysToKey(TODAY, 7), '2026-12-01');
  assert.equal(addDaysToKey(TODAY, 14), '2026-12-08');
  assert.equal(addDaysToKey(new Date(2026, 11, 30), 3), '2027-01-02');
});

test('toDateKey no adelanta el día a las 11 de la noche', () => {
  assert.equal(toDateKey(new Date(2026, 10, 24, 23, 59)), '2026-11-24');
});

test('isValidDateKey acepta fechas reales y rechaza todo lo demás', () => {
  assert.equal(isValidDateKey('2026-11-24'), true);
  assert.equal(isValidDateKey('2028-02-29'), true);
  assert.equal(isValidDateKey('2026-02-29'), false);
  assert.equal(isValidDateKey('2026-02-31'), false);
  assert.equal(isValidDateKey('2026-13-01'), false);
  assert.equal(isValidDateKey('24/11/2026'), false);
  assert.equal(isValidDateKey(''), false);
  assert.equal(isValidDateKey(null), false);
  assert.equal(isValidDateKey(20261124), false);
});

test('daysUntil cuenta días de calendario: hoy, mañana, 5 días, ayer, sin fecha', () => {
  assert.equal(daysUntil('2026-11-24', TODAY), 0);
  assert.equal(daysUntil('2026-11-25', TODAY), 1);
  assert.equal(daysUntil('2026-11-29', TODAY), 5);
  assert.equal(daysUntil('2026-11-23', TODAY), -1);
  assert.equal(daysUntil('2027-11-24', TODAY), 365);
  assert.equal(daysUntil(null, TODAY), null);
  assert.equal(daysUntil('basura', TODAY), null);
});

test('daysUntil no se descuadra con el cambio de horario', () => {
  // Hoy: 1 de abril (después del horario de verano en otros países); caduca el 1 de noviembre
  assert.equal(daysUntil('2026-11-01', new Date(2026, 3, 1)), 214);
  assert.equal(daysUntil('2026-03-30', new Date(2026, 2, 28, 23, 0)), 2);
});

test('getExpiryStatus: caducado, urgente, pronto, bien y sin fecha', () => {
  assert.equal(getExpiryStatus(-1), 'expired');
  assert.equal(getExpiryStatus(-30), 'expired');
  assert.equal(getExpiryStatus(0), 'urgent');
  assert.equal(getExpiryStatus(1), 'urgent');
  assert.equal(getExpiryStatus(2), 'soon');
  assert.equal(getExpiryStatus(3), 'soon');
  assert.equal(getExpiryStatus(4), 'ok');
  assert.equal(getExpiryStatus(100), 'ok');
  assert.equal(getExpiryStatus(null), 'none');
});

test('describeExpiry escribe mensajes claros en español', () => {
  assert.equal(describeExpiry(null), 'Sin fecha');
  assert.equal(describeExpiry(-3), 'Caducó hace 3 días');
  assert.equal(describeExpiry(-1), 'Caducó ayer');
  assert.equal(describeExpiry(0), 'Caduca hoy');
  assert.equal(describeExpiry(1), 'Caduca mañana');
  assert.equal(describeExpiry(5), 'Caduca en 5 días');
});

test('buildExpiryReport: hoy, 5 días, caducado y sin fecha', () => {
  const dates = {
    jitomate: '2026-11-24',
    leche: '2026-11-29',
    pollo: '2026-11-20',
  };
  const report = buildExpiryReport(['Jitomate', 'Leche', 'Pollo', 'Arroz'], dates, TODAY);
  assert.deepEqual(report.urgent.map((i) => i.name), ['Jitomate']);
  assert.deepEqual(report.ok.map((i) => i.name), ['Leche']);
  assert.deepEqual(report.expired.map((i) => i.name), ['Pollo']);
  assert.deepEqual(report.none.map((i) => i.name), ['Arroz']);
  assert.equal(report.soon.length, 0);
  assert.equal(report.expired[0].daysLeft, -4);
  assert.equal(report.none[0].dateKey, null);
});

test('buildExpiryReport ordena por cercanía y ya no incluye lo que se quitó de la despensa', () => {
  const dates = { cebolla: '2026-11-26', jitomate: '2026-11-25', queso: '2026-11-24' };
  const full = buildExpiryReport(['Cebolla', 'Jitomate', 'Queso'], dates, TODAY);
  assert.deepEqual(full.urgent.map((i) => i.name), ['Queso', 'Jitomate']);
  assert.deepEqual(full.soon.map((i) => i.name), ['Cebolla']);

  // La persona quitó el queso: su alerta desaparece (aunque la fecha siga guardada)
  const withoutCheese = buildExpiryReport(['Cebolla', 'Jitomate'], dates, TODAY);
  const allNames = Object.values(withoutCheese).flat().map((i) => i.name);
  assert.deepEqual(allNames.sort(), ['Cebolla', 'Jitomate']);
});

test('buildExpiryReport reconoce el nombre sin importar mayúsculas ni acentos y no repite', () => {
  const dates = { jitomate: '2026-11-24', limon: '2026-11-25' };
  const report = buildExpiryReport(['JITOMATE', 'jitomate', 'Limón'], dates, TODAY);
  assert.equal(report.urgent.length, 2);
  assert.deepEqual(report.urgent.map((i) => i.name), ['JITOMATE', 'Limón']);
});

test('buildExpiryReport con despensa vacía no se rompe', () => {
  const report = buildExpiryReport([], {}, TODAY);
  assert.deepEqual(report, { expired: [], urgent: [], soon: [], ok: [], none: [] });
  assert.deepEqual(getRescueIngredients(report), []);
  assert.deepEqual(getRescueRecipes([makeRecipe('a', ['Jitomate'])], report), []);
});

test('getRescueIngredients incluye urgente y pronto, y nunca lo caducado', () => {
  const dates = { a: '2026-11-20', b: '2026-11-24', c: '2026-11-27', d: '2026-12-30' };
  const report = buildExpiryReport(['A', 'B', 'C', 'D', 'E'], dates, TODAY);
  assert.deepEqual(getRescueIngredients(report), ['B', 'C']);
});

test('setExpiryDate guarda, reemplaza y quita sin modificar el original', () => {
  const original = { jitomate: '2026-11-24' };
  const withNew = setExpiryDate(original, 'Cebolla Morada', '2026-12-01');
  assert.deepEqual(original, { jitomate: '2026-11-24' });
  assert.deepEqual(withNew, { jitomate: '2026-11-24', 'cebolla morada': '2026-12-01' });
  assert.equal(setExpiryDate(withNew, 'JITOMATE', '2026-11-30').jitomate, '2026-11-30');
  assert.deepEqual(setExpiryDate(withNew, 'Jitomate', null), { 'cebolla morada': '2026-12-01' });
  assert.deepEqual(setExpiryDate(withNew, 'Jitomate', 'fecha rara').jitomate, undefined);
  assert.equal(setExpiryDate(original, '   ', '2026-12-01'), original);
});

test('guardar y recargar: las fechas siguen ahí', () => {
  const storage = fakeStorage();
  const dates = { jitomate: '2026-11-24', leche: '2026-12-01' };
  assert.equal(saveExpiryDates(dates, storage), true);
  assert.ok(PANTRY_EXPIRY_STORAGE_KEY in storage.data);
  assert.deepEqual(loadExpiryDates(storage), dates);
});

test('loadExpiryDates tolera almacenamiento vacío, dañado, raro o ausente', () => {
  assert.deepEqual(loadExpiryDates(fakeStorage()), {});
  assert.deepEqual(loadExpiryDates(null), {});
  assert.deepEqual(loadExpiryDates(fakeStorage({ [PANTRY_EXPIRY_STORAGE_KEY]: '{no es json' })), {});
  assert.deepEqual(loadExpiryDates(fakeStorage({ [PANTRY_EXPIRY_STORAGE_KEY]: '[1,2]' })), {});
  assert.deepEqual(loadExpiryDates(fakeStorage({ [PANTRY_EXPIRY_STORAGE_KEY]: 'null' })), {});
  assert.deepEqual(
    loadExpiryDates(
      fakeStorage({
        [PANTRY_EXPIRY_STORAGE_KEY]: JSON.stringify({ bien: '2026-11-24', mal: 'ayer', num: 5 }),
      })
    ),
    { bien: '2026-11-24' }
  );
  const broken = {
    getItem: () => {
      throw new Error('bloqueado');
    },
    setItem: () => {
      throw new Error('bloqueado');
    },
  };
  assert.deepEqual(loadExpiryDates(broken), {});
  assert.equal(saveExpiryDates({ a: '2026-11-24' }, broken), false);
  assert.equal(saveExpiryDates({ a: '2026-11-24' }, null), false);
});

test('getRescueRecipes: primero la que salva más ingredientes y no propone con lo caducado', () => {
  const recipes = [
    makeRecipe('solo-tomate', ['Jitomate', 'Sal']),
    makeRecipe('tomate-cebolla', ['Jitomate', 'Cebolla', 'Huevos']),
    makeRecipe('sin-relacion', ['Arroz', 'Pollo']),
    makeRecipe('con-pollo', ['Pollo', 'Jitomate']),
  ];
  const dates = { jitomate: '2026-11-24', cebolla: '2026-11-26', pollo: '2026-11-20' };
  const report = buildExpiryReport(['Jitomate', 'Cebolla', 'Pollo', 'Sal'], dates, TODAY);
  const result = getRescueRecipes(recipes, report, 5);

  assert.deepEqual(result.map((r) => r.recipe.id), ['tomate-cebolla', 'solo-tomate', 'con-pollo']);
  assert.deepEqual(result[0].rescued, ['Jitomate', 'Cebolla']);
  assert.ok(!result.some((r) => r.rescued.includes('Pollo')));
  // El pollo caducado no cuenta como disponible: le "falta" a la receta que lo usa
  const withChicken = result.find((r) => r.recipe.id === 'con-pollo');
  assert.deepEqual(withChicken?.missingIngredients.map((i) => i.name), ['Pollo']);
  assert.equal(withChicken?.matchPercentage, 50);
  // Sin relación con lo que caduca: no aparece
  assert.ok(!result.some((r) => r.recipe.id === 'sin-relacion'));
});

test('getRescueRecipes respeta el límite y no propone nada si no hay urgencias', () => {
  const recipes = [makeRecipe('a', ['Jitomate']), makeRecipe('b', ['Jitomate']), makeRecipe('c', ['Jitomate'])];
  const urgent = buildExpiryReport(['Jitomate'], { jitomate: '2026-11-24' }, TODAY);
  assert.equal(getRescueRecipes(recipes, urgent, 2).length, 2);
  assert.equal(getRescueRecipes(recipes, urgent, 0).length, 0);

  const fine = buildExpiryReport(['Jitomate'], { jitomate: '2026-12-24' }, TODAY);
  assert.deepEqual(getRescueRecipes(recipes, fine), []);

  const onlyExpired = buildExpiryReport(['Jitomate'], { jitomate: '2026-11-01' }, TODAY);
  assert.deepEqual(getRescueRecipes(recipes, onlyExpired), []);
});

test('getMissingForShopping manda solo lo que falta y no repite lo que ya está en Mandado', () => {
  const missing = [
    { name: 'Jitomate', amount: '2', unit: 'piezas', essential: true },
    { name: 'Cebolla', amount: '1', unit: 'pieza', essential: true },
    { name: 'Limón', amount: '3', unit: 'piezas', essential: false },
    { name: 'cebolla', amount: '1', unit: 'pieza', essential: false },
  ];
  assert.deepEqual(getMissingForShopping(missing, ['jitomate', 'Pan']), ['Cebolla', 'Limón']);
  assert.deepEqual(getMissingForShopping(missing, ['LIMON', 'JITOMATE', 'cebolla']), []);
  assert.deepEqual(getMissingForShopping([], ['Pan']), []);
  assert.deepEqual(getMissingForShopping(missing, []), ['Jitomate', 'Cebolla', 'Limón']);
});
