import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_RESCUE_DESCRIPTION,
  RESCUE_PROBLEMS,
  assessSafety,
  buildRescueAdvice,
  checkRescueInput,
  findIngredient,
  isIngredientKnown,
  isRescueProblemId,
  type RescueProblemId,
} from './cookingRescue.ts';

const SAFE_PROBLEMS = RESCUE_PROBLEMS.map((p) => p.id);

test('the list has the ten problems from the design and every id is valid', () => {
  assert.equal(RESCUE_PROBLEMS.length, 10);
  assert.equal(new Set(SAFE_PROBLEMS).size, 10);
  assert.ok(SAFE_PROBLEMS.every(isRescueProblemId));
  assert.equal(isRescueProblemId('inventado'), false);
  assert.equal(isRescueProblemId(undefined), false);
});

test('every problem gives at least two fixes that work with nothing special', () => {
  for (const id of SAFE_PROBLEMS) {
    const advice = buildRescueAdvice({ problem: id });
    assert.equal(advice.safety, null, id);
    assert.ok(advice.fixes.length >= 2, `${id} has fixes`);
    assert.ok(advice.fixes.some((f) => f.needs.length === 0), `${id} has a fix that needs no ingredient`);
    assert.ok(advice.fixes.every((f) => f.title && f.instruction), `${id} fixes are complete`);
    assert.ok(advice.warnings.length >= 1, `${id} has a warning`);
  }
});

test('fixes the person can do now come first and show what they use', () => {
  const advice = buildRescueAdvice({ problem: 'muy-salado', available: ['Limones', 'Crema ácida'] });
  const firstUnavailable = advice.fixes.findIndex((f) => !f.available);
  assert.ok(firstUnavailable > 0);
  assert.ok(advice.fixes.slice(0, firstUnavailable).every((f) => f.available));
  assert.ok(advice.fixes.slice(firstUnavailable).every((f) => !f.available));

  const lemon = advice.fixes.find((f) => f.title === 'Equilíbralo con algo ácido');
  assert.ok(lemon);
  assert.deepEqual(lemon.have, ['Limones']);
  assert.equal(lemon.available, true);

  const cream = advice.fixes.find((f) => f.title === 'Suavízalo con algo cremoso');
  assert.ok(cream);
  assert.deepEqual(cream.have, ['Crema ácida']);

  // Without anything at hand, fixes that need an ingredient are marked as missing it.
  const empty = buildRescueAdvice({ problem: 'muy-salado', available: [] });
  const acid = empty.fixes.find((f) => f.title === 'Equilíbralo con algo ácido');
  assert.ok(acid);
  assert.equal(acid.available, false);
  assert.deepEqual(acid.have, []);
});

test('ingredient names match without accents, in singular or plural, and not by prefix', () => {
  assert.deepEqual(findIngredient('limon', ['Limones', 'Papaya']), ['Limones']);
  assert.deepEqual(findIngredient('papa', ['Papas', 'Papaya']), ['Papas']);
  assert.deepEqual(findIngredient('azucar', ['Azúcar']), ['Azúcar']);
  assert.deepEqual(findIngredient('queso', ['Queso Fresco o Parmesano', 'Leche']), ['Queso Fresco o Parmesano']);
  assert.deepEqual(findIngredient('', ['Sal']), []);
});

test('isIngredientKnown accepts what the person has and rejects what they do not', () => {
  const known = ['Crema ácida', 'Queso Fresco o Parmesano', 'Jitomate'];
  assert.equal(isIngredientKnown('crema', known), true);
  assert.equal(isIngredientKnown('Queso fresco', known), true);
  assert.equal(isIngredientKnown('jitomates', known), true);
  assert.equal(isIngredientKnown('agua', known), true);
  assert.equal(isIngredientKnown('agua caliente', known), true);
  assert.equal(isIngredientKnown('leche de coco', known), false);
  assert.equal(isIngredientKnown('miel', known), false);
  assert.equal(isIngredientKnown('de la', known), false);
  assert.equal(isIngredientKnown('', known), false);
});

test('dangerous cases are not rescued', () => {
  const discard = [
    'huele raro',
    'huele muy mal desde ayer',
    'tiene moho',
    'el pollo estuvo 4 horas fuera del refri',
    'dejé la sopa toda la noche en la estufa',
    'la leche estaba caducada',
    'olor feo en la salsa',
    'tiene manchas verdes',
  ];
  for (const text of discard) {
    const verdict = assessSafety({ problem: 'muy-salado', text });
    assert.equal(verdict?.level, 'discard', text);
  }
  const advice = buildRescueAdvice({ problem: 'muy-salado', text: 'huele raro' });
  assert.equal(advice.safety?.level, 'discard');
  assert.deepEqual(advice.fixes, []);
  assert.match(advice.safety.message, /no se rescata/);
});

test('raw meat, poultry or egg only get "keep cooking"', () => {
  for (const text of ['el pollo quedó crudo por dentro', 'la carne sigue rosada', 'el huevo está crudo']) {
    const verdict = assessSafety({ problem: 'quedo-crudo', text });
    assert.equal(verdict?.level, 'keep-cooking', text);
  }
  // Said under another problem, the answer is the same.
  assert.equal(assessSafety({ problem: 'muy-salado', text: 'el pollo está crudo y salado' })?.level, 'keep-cooking');
  // A recipe with chicken and "quedó crudo" with no text.
  assert.equal(
    assessSafety({ problem: 'quedo-crudo', recipeIngredients: ['Arroz', 'Pollo / Pechuga'] })?.level,
    'keep-cooking'
  );

  const advice = buildRescueAdvice({ problem: 'quedo-crudo', text: 'el pollo quedó crudo por dentro' });
  assert.equal(advice.safety?.level, 'keep-cooking');
  assert.match(advice.safety.message, /sigue cocinando/);
  assert.ok(advice.fixes.length > 0);
  assert.ok(advice.fixes.every((f) => !/agrega.*sal\b/i.test(f.instruction)));
});

test('a very burned dish is not rescued, a slightly burned one is', () => {
  assert.equal(assessSafety({ problem: 'se-quemo', text: 'se quemó todo y quedó negro' })?.level, 'discard');
  assert.equal(assessSafety({ problem: 'se-quemo', text: 'está carbonizado' })?.level, 'discard');
  assert.equal(assessSafety({ problem: 'se-quemo', text: 'se pegó un poquito en el fondo' }), null);
  // Black beans are an ingredient, not a burned dish.
  assert.equal(assessSafety({ problem: 'se-quemo', text: 'los frijoles negros se pegaron un poco' }), null);
  assert.equal(assessSafety({ problem: 'muy-salado', text: 'los frijoles negros quedaron salados' }), null);
});

test('normal cooking talk does not trigger the safety rules', () => {
  const fine = [
    'le puse demasiada sal',
    'usé mucho chile serrano',
    'dejé el pollo marinando toda la noche',
    'cocí los frijoles 3 horas en la estufa',
    'quedó muy agrio de tanto limón',
    '',
  ];
  for (const text of fine) {
    assert.equal(assessSafety({ problem: 'muy-salado', text }), null, text);
  }
});

test('checkRescueInput handles empty, long and normal input', () => {
  assert.deepEqual(checkRescueInput('muy-salado', '  '), { ok: true, problem: 'muy-salado', description: '' });
  assert.deepEqual(checkRescueInput(null, 'se me cayó el pastel'), {
    ok: true,
    problem: 'otro',
    description: 'se me cayó el pastel',
  });

  const empty = checkRescueInput(null, '   ');
  assert.equal(empty.ok, false);
  assert.match(empty.ok ? '' : empty.error, /Elige qué pasó/);

  const otherEmpty = checkRescueInput('otro', '');
  assert.equal(otherEmpty.ok, false);
  assert.match(otherEmpty.ok ? '' : otherEmpty.error, /Cuéntanos qué pasó/);

  const long = checkRescueInput('muy-salado', 'a'.repeat(MAX_RESCUE_DESCRIPTION + 1));
  assert.equal(long.ok, false);
  assert.match(long.ok ? '' : long.error, /muy larga/);
  assert.equal(checkRescueInput('muy-salado', 'a'.repeat(MAX_RESCUE_DESCRIPTION)).ok, true);
});

test('a strange problem id never crashes the advice', () => {
  const advice = buildRescueAdvice({ problem: 'otro' as RescueProblemId, text: undefined, available: undefined });
  assert.ok(advice.fixes.length >= 2);
});
