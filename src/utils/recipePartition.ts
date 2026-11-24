// "Receta a tu medida": reduces a recipe to the ingredients you actually have.
// Rule-based, no language model: the ingredient that runs out first sets the proportion for the
// whole recipe, and kitchen rules turn each amount into something you can measure at home.
import { normalizeText } from './recipeMatcher.ts';
import type { Recipe, RecipeIngredient, RecipeStep } from './recipeMatcher.ts';

// ---------- Units ----------

type UnitFamily = 'volume' | 'mass' | 'count';

interface UnitDef {
  key: string;
  family: UnitFamily;
  /** Size in ml (volume) or g (mass). Count units only convert to themselves. */
  size: number;
  singular: string;
  plural: string;
  aliases: string[];
}

const countUnit = (singular: string, plural: string, extra: string[] = []): UnitDef => ({
  key: singular,
  family: 'count',
  size: 1,
  singular,
  plural,
  aliases: [singular, plural, ...extra],
});

const UNIT_DEFS: UnitDef[] = [
  { key: 'taza', family: 'volume', size: 240, singular: 'taza', plural: 'tazas', aliases: ['taza', 'tazas'] },
  { key: 'cucharada', family: 'volume', size: 15, singular: 'cucharada', plural: 'cucharadas', aliases: ['cucharada', 'cucharadas', 'cda', 'cdas'] },
  { key: 'cucharadita', family: 'volume', size: 5, singular: 'cucharadita', plural: 'cucharaditas', aliases: ['cucharadita', 'cucharaditas', 'cdta', 'cdtas', 'cdita', 'cditas'] },
  { key: 'ml', family: 'volume', size: 1, singular: 'ml', plural: 'ml', aliases: ['ml', 'mililitro', 'mililitros'] },
  { key: 'l', family: 'volume', size: 1000, singular: 'litro', plural: 'litros', aliases: ['l', 'lt', 'lts', 'litro', 'litros'] },
  { key: 'g', family: 'mass', size: 1, singular: 'g', plural: 'g', aliases: ['g', 'gr', 'grs', 'gramo', 'gramos'] },
  { key: 'kg', family: 'mass', size: 1000, singular: 'kg', plural: 'kg', aliases: ['kg', 'kgs', 'kilo', 'kilos', 'kilogramo', 'kilogramos'] },
  countUnit('pieza', 'piezas', ['pza', 'pzas', 'pz', 'unidad', 'unidades']),
  countUnit('diente', 'dientes'),
  countUnit('rebanada', 'rebanadas'),
  countUnit('ramita', 'ramitas'),
  countUnit('rama', 'ramas'),
  countUnit('pastilla', 'pastillas'),
  countUnit('hoja', 'hojas'),
  countUnit('lata', 'latas'),
  countUnit('rodaja', 'rodajas'),
  countUnit('sobre', 'sobres'),
  countUnit('filete', 'filetes'),
  countUnit('trozo', 'trozos'),
  countUnit('manojo', 'manojos'),
];

/** Ingredients measured without a number: they stay the same in a smaller recipe. */
const UNMEASURED_UNITS = ['pizca', 'pizcas', 'al gusto', 'gusto', 'c/s', 'cantidad suficiente', 'chorrito', 'chorritos', 'chorro', 'punado', 'punados'];

/** Ingredient amount written without a unit, e.g. "2" huevos. */
const NO_UNIT: UnitDef = { key: '', family: 'count', size: 1, singular: '', plural: '', aliases: [] };

const unitByKey = (key: string) => UNIT_DEFS.find((d) => d.key === key);

interface ParsedUnit {
  /** null for a unit we don't know; it can still be scaled, but only compared with itself. */
  def: UnitDef | null;
  /** Words after the unit, e.g. "grandes" in "piezas grandes". */
  descriptor: string;
  measured: boolean;
  raw: string;
}

function parseUnit(raw: string): ParsedUnit {
  const text = String(raw ?? '').trim();
  const norm = normalizeText(text).replace(/\.$/, '');
  if (!norm) return { def: NO_UNIT, descriptor: '', measured: true, raw: text };
  if (UNMEASURED_UNITS.some((u) => norm === u || norm.startsWith(`${u} `))) {
    return { def: null, descriptor: '', measured: false, raw: text };
  }
  const words = text.split(/\s+/);
  const first = normalizeText(words[0]).replace(/\.$/, '');
  const def = UNIT_DEFS.find((d) => d.aliases.includes(first)) ?? null;
  return def
    ? { def, descriptor: words.slice(1).join(' '), measured: true, raw: text }
    : { def: null, descriptor: '', measured: true, raw: text };
}

// Adjectives that follow the unit ("piezas grandes") must agree in number with it.
const DESCRIPTOR_PLURALS: Record<string, string> = {
  grande: 'grandes', mediano: 'medianos', mediana: 'medianas', pequeño: 'pequeños', pequeña: 'pequeñas',
  chico: 'chicos', chica: 'chicas', sopera: 'soperas', cafetera: 'cafeteras', rasa: 'rasas',
  copeteada: 'copeteadas', colmada: 'colmadas', entero: 'enteros', entera: 'enteras', madura: 'maduras', maduro: 'maduros',
};
const DESCRIPTOR_SINGULARS = Object.fromEntries(Object.entries(DESCRIPTOR_PLURALS).map(([s, p]) => [p, s]));

function unitLabel(def: UnitDef, value: number, descriptor = ''): string {
  const plural = value > 1;
  const word = plural ? def.plural : def.singular;
  if (!descriptor) return word;
  const metric = def.singular === def.plural;
  const agreed = metric
    ? descriptor
    : descriptor
        .split(' ')
        .map((w) => (plural ? DESCRIPTOR_PLURALS[w] : DESCRIPTOR_SINGULARS[w]) ?? w)
        .join(' ');
  return word ? `${word} ${agreed}` : agreed;
}

export interface UnitOption {
  value: string;
  label: string;
}

/** Units the user can type their amount in: the recipe's own unit first, then its equivalents. */
export function compatibleUnits(recipeUnit: string): UnitOption[] {
  const unit = parseUnit(recipeUnit);
  if (!unit.measured) return [];
  if (!unit.def) return [{ value: `otra:${normalizeText(unit.raw)}`, label: unit.raw }];
  const own = { value: unit.def.key, label: unitLabel(unit.def, 2, unit.descriptor) || 'piezas' };
  if (unit.def.family === 'count') return [own];
  const equivalents = UNIT_DEFS.filter((d) => d.family === unit.def!.family && d.key !== unit.def!.key);
  return [own, ...equivalents.map((d) => ({ value: d.key, label: d.plural }))];
}

// ---------- Amounts ----------

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
};
const WORD_NUMBERS: Record<string, number> = {
  un: 1, una: 1, uno: 1, medio: 0.5, media: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12,
};

function parseSingle(text: string): number | null {
  let match = text.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)/);
  if (match) return Number(match[1]) + Number(match[2]) / Number(match[3]);
  match = text.match(/^(\d+)\/(\d+)/);
  if (match) return Number(match[2]) > 0 ? Number(match[1]) / Number(match[2]) : null;
  match = text.match(/^\d+(?:\.\d+)?/);
  if (match) return Number(match[0]);
  match = text.match(/^([a-z]+)(?:\s+(cuartos?|tercios?|medios?))?/);
  if (match && match[1] in WORD_NUMBERS) {
    const base = WORD_NUMBERS[match[1]];
    const part = match[2] ?? '';
    if (part.startsWith('cuarto')) return base / 4;
    if (part.startsWith('tercio')) return base / 3;
    if (part.startsWith('medio')) return base / 2;
    return base;
  }
  return null;
}

/** Reads amounts like "2", "0.5", "1/2", "1 1/2", "1½", "media" or "1-2" (uses the middle). */
export function parseAmount(text: string): number | null {
  let s = normalizeText(String(text ?? '')).replace(/,/g, '.');
  s = s.replace(/(\d?)\s*([½¼¾⅓⅔⅛⅜⅝⅞])/g, (_m, whole: string, glyph: string) =>
    `${whole ? `${whole} ` : ''}${UNICODE_FRACTIONS[glyph]}`
  );
  s = s.replace(/^(\d+)\s+y\s+medi[oa]\b/, '$1 1/2').trim();
  if (!s) return null;

  const range = s.match(/^(.+?)\s*(?:-|–|\ba\b)\s*(.+)$/);
  if (range) {
    const low = parseSingle(range[1]);
    const high = parseSingle(range[2]);
    if (low != null && high != null) return (low + high) / 2;
  }
  const value = parseSingle(s);
  return value != null && Number.isFinite(value) && value >= 0 ? value : null;
}

type Rounding = 'nearest' | 'down' | 'up';

const EPS = 1e-9;
const FRACTION_GLYPHS: [number, string][] = [
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'],
];

/** Rounds to a whole number plus ¼, ⅓, ½, ⅔ or ¾ (and ⅛ when allowed). */
export function roundToKitchenFraction(value: number, rounding: Rounding = 'nearest', allowEighth = false): number {
  const whole = Math.floor(value + EPS);
  const frac = value - whole;
  const steps = [0, ...(allowEighth ? [1 / 8] : []), 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];
  let chosen: number;
  if (rounding === 'down') chosen = Math.max(...steps.filter((s) => s <= frac + EPS));
  else if (rounding === 'up') chosen = Math.min(...steps.filter((s) => s >= frac - EPS));
  else chosen = steps.reduce((best, s) => (Math.abs(s - frac) < Math.abs(best - frac) ? s : best), 0);
  return whole + chosen;
}

/** 1.5 → "1½", 0.25 → "¼", 3 → "3", 0.9 → "0.9". */
export function formatKitchenNumber(value: number): string {
  const whole = Math.floor(value + EPS);
  const frac = value - whole;
  if (frac < 0.005) return String(whole);
  if (frac > 0.995) return String(whole + 1);
  const glyph = FRACTION_GLYPHS.find(([v]) => Math.abs(v - frac) < 0.01)?.[1];
  if (glyph) return whole > 0 ? `${whole}${glyph}` : glyph;
  return String(Math.round(value * 100) / 100);
}

/** Recipe amount for display: "0.5" → "½"; text that isn't a number stays as it is. */
export function prettyAmount(text: string): string {
  const value = parseAmount(text);
  return value == null || value === 0 ? text : formatKitchenNumber(value);
}

function roundMetric(value: number, rounding: Rounding): number {
  if (value < 1) return Math.max(0.1, Math.round(value * 10) / 10);
  const step = value < 20 ? 1 : value < 100 ? 5 : 10;
  const round = rounding === 'down' ? Math.floor : rounding === 'up' ? Math.ceil : Math.round;
  return Math.max(step, round(value / step) * step);
}

// Household volumes from largest to smallest: we step down when a fraction would be too inexact.
const HOUSEHOLD_VOLUMES = ['taza', 'cucharada', 'cucharadita'];
const MAX_ROUNDING_ERROR = 0.1;

interface Quantity {
  amount: string;
  unit: string;
  note?: string;
}

const isEgg = (name: string) => /\bhuevos?\b/.test(normalizeText(name));

function formatVolume(valueMl: number, def: UnitDef, descriptor: string, rounding: Rounding): Quantity {
  if (def.key === 'ml' || (def.key === 'l' && valueMl < 1000)) {
    return { amount: String(roundMetric(valueMl, rounding)), unit: 'ml' };
  }
  if (def.key === 'l') {
    const liters = roundToKitchenFraction(valueMl / 1000, rounding);
    if (Math.abs(liters * 1000 - valueMl) / valueMl <= MAX_ROUNDING_ERROR) {
      return { amount: formatKitchenNumber(liters), unit: unitLabel(def, liters, descriptor) };
    }
    return { amount: String(roundMetric(valueMl, rounding)), unit: 'ml' };
  }

  // Start at the recipe's unit and move to smaller spoons until the amount is easy and exact enough.
  const start = HOUSEHOLD_VOLUMES.indexOf(def.key);
  for (let i = start; i < HOUSEHOLD_VOLUMES.length; i++) {
    const unit = unitByKey(HOUSEHOLD_VOLUMES[i])!;
    const value = valueMl / unit.size;
    const isLast = i === HOUSEHOLD_VOLUMES.length - 1;
    if (isLast && value < 1 / 8) {
      return { amount: '1', unit: 'pizca', note: 'Es muy poquito: basta con una pizca.' };
    }
    const minimum = unit.key === 'taza' ? 1 / 4 : unit.key === 'cucharada' ? 1 / 2 : 0;
    if (value < minimum - EPS && !isLast) continue;
    const rounded = roundToKitchenFraction(value, rounding, unit.key === 'cucharadita');
    const error = rounded > 0 ? Math.abs(rounded - value) / value : 1;
    if (error <= MAX_ROUNDING_ERROR || isLast) {
      const keepDescriptor = i === start ? descriptor : '';
      return {
        amount: formatKitchenNumber(rounded > 0 ? rounded : value),
        unit: unitLabel(unit, rounded, keepDescriptor),
      };
    }
  }
  return { amount: formatKitchenNumber(valueMl / def.size), unit: unitLabel(def, valueMl / def.size, descriptor) };
}

function formatMass(valueG: number, def: UnitDef, descriptor: string, rounding: Rounding): Quantity {
  if (def.key === 'kg' && valueG >= 1000) {
    const kilos = roundToKitchenFraction(valueG / 1000, rounding);
    if (Math.abs(kilos * 1000 - valueG) / valueG <= MAX_ROUNDING_ERROR) {
      return { amount: formatKitchenNumber(kilos), unit: unitLabel(def, kilos, descriptor) };
    }
  }
  const grams = roundMetric(valueG, rounding);
  return { amount: String(grams), unit: def.key === 'g' ? unitLabel(def, grams, descriptor) : 'g' };
}

function formatCount(value: number, unit: ParsedUnit, rounding: Rounding, egg: boolean): Quantity {
  const def = unit.def ?? NO_UNIT;
  const label = (v: number) => (unit.def ? unitLabel(def, v, unit.descriptor) : unit.raw);
  if (egg) {
    // Eggs only split in halves: beaten, half an egg is about 1½ tablespoons.
    const round = rounding === 'down' ? Math.floor : rounding === 'up' ? Math.ceil : Math.round;
    const halves = Math.max(1, round(value * 2));
    const eggs = halves / 2;
    return {
      amount: formatKitchenNumber(eggs),
      unit: label(eggs),
      note: halves % 2 === 1 ? 'Para medio huevo: bate uno y usa la mitad (≈ 1½ cucharadas).' : undefined,
    };
  }
  const small = value < 1 / 4;
  let rounded = roundToKitchenFraction(value, rounding, small);
  if (rounded <= 0) rounded = rounding === 'down' ? Math.round(value * 100) / 100 : small ? 1 / 8 : 1 / 4;
  return { amount: formatKitchenNumber(rounded), unit: label(rounded) };
}

/** Formats an amount (in the recipe's unit) the way you'd measure it at home. */
function formatQuantity(value: number, unitRaw: string, rounding: Rounding, ingredientName = ''): Quantity {
  const unit = parseUnit(unitRaw);
  const def = unit.def;
  if (def?.family === 'volume') return formatVolume(value * def.size, def, unit.descriptor, rounding);
  if (def?.family === 'mass') return formatMass(value * def.size, def, unit.descriptor, rounding);
  return formatCount(value, unit, rounding, isEgg(ingredientName));
}

/** Whether a recipe ingredient has an exact amount that can be reduced. */
export function isMeasurable(ingredient: RecipeIngredient): boolean {
  const amount = parseAmount(ingredient.amount);
  return amount != null && amount > 0 && parseUnit(ingredient.unit).measured;
}

/** Converts what the user has into "how many times the recipe amount" (1 = exactly enough). */
function availableRatio(have: number, userUnit: string, required: number, recipeUnit: ParsedUnit): number | null {
  if (!recipeUnit.def) {
    return userUnit === `otra:${normalizeText(recipeUnit.raw)}` ? have / required : null;
  }
  const recipeDef = recipeUnit.def;
  const userDef = recipeDef.key === userUnit ? recipeDef : unitByKey(userUnit);
  if (!userDef || userDef.family !== recipeDef.family) return null;
  if (recipeDef.family === 'count' && userDef.key !== recipeDef.key) return null;
  return (have * userDef.size) / (required * recipeDef.size);
}

// ---------- Steps ----------

const TEXT_QUANTITY =
  /(?<![\p{L}\d])(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛]|media|medio|una|un)\s+(tazas?|cucharadas?|cucharaditas?|ml|mililitros?|litros?|gramos?|g|kg|kilos?)(?![\p{L}])/giu;

// "una cucharada de puré en cada tortilla" is per piece: it stays the same in a smaller recipe.
const PER_PIECE = /\b(cada|por (pieza|persona|porcion|taco|tortilla|rebanada))\b/;

/** Reduces the measured amounts written inside a step ("media taza", "2 cucharadas"); times and temperatures stay. */
export function scaleQuantitiesInText(text: string, factor: number): string {
  if (!text || factor >= 1) return text;
  return text.replace(TEXT_QUANTITY, (match, amountText: string, unitText: string, offset: number) => {
    const rest = text.slice(offset + match.length).split(/[.;:]/)[0];
    if (PER_PIECE.test(normalizeText(rest))) return match;
    const amount = parseAmount(amountText);
    if (amount == null || amount <= 0) return match;
    const q = formatQuantity(amount * factor, unitText, 'nearest');
    return `${q.amount} ${q.unit}`;
  });
}

/** Steps for the reduced recipe without AI: same steps with their measured amounts reduced. */
export function adaptStepsByRules(steps: RecipeStep[], factor: number): RecipeStep[] {
  return steps.map((step) => ({
    ...step,
    instruction: scaleQuantitiesInText(step.instruction, factor),
    tip: step.tip ? scaleQuantitiesInText(step.tip, factor) : step.tip,
  }));
}

// ---------- Partition ----------

export interface AvailableAmount {
  /** Position of the ingredient in recipe.ingredients. */
  index: number;
  /** What the user typed, e.g. "1/2", "2" or "200". */
  amount: string;
  /** A value from compatibleUnits(). */
  unit: string;
}

export interface PartitionedIngredient extends RecipeIngredient {
  originalAmount: string;
  originalUnit: string;
  /** The user said they are short of it. */
  limited: boolean;
  /** The ingredient that sets the proportion for the whole recipe. */
  limiting: boolean;
  /** Optional ingredient the user doesn't have. */
  omitted: boolean;
  changed: boolean;
  note?: string;
}

export interface PartitionPlan {
  /** Share of the original recipe you can make (0–1). */
  factor: number;
  percent: number;
  limitingIngredient: string;
  servings: number;
  servingsLabel: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  ingredients: PartitionedIngredient[];
  /** Steps with their measured amounts reduced by rules. */
  steps: RecipeStep[];
  missingForFullRecipe: { name: string; amount: string; unit: string }[];
  tips: string[];
  isFullRecipe: boolean;
}

export type PartitionOutcome = { ok: true; plan: PartitionPlan } | { ok: false; error: string };

const fail = (error: string): PartitionOutcome => ({ ok: false, error });

function servingsLabel(servings: number): string {
  if (servings >= 1 - EPS) {
    const rounded = Math.max(1, roundToKitchenFraction(servings));
    return `${formatKitchenNumber(rounded)} ${rounded > 1 ? 'porciones' : 'porción'}`;
  }
  const rounded = roundToKitchenFraction(servings, 'nearest', true) || 1 / 8;
  return `${formatKitchenNumber(rounded)} de porción`;
}

// Baking verbs, not just "en horno": toasting tortillas in the oven is not baking a cake.
const BAKING = /\bhorne(a|ar|ado|alo|ala)\b|\bmolde\b/;

function kitchenTips(recipe: Recipe, factor: number, percent: number, limitingName: string, omittedNames: string[]): string[] {
  const tips: string[] = [];
  if (factor < 1) {
    const text = normalizeText(recipe.steps.map((s) => s.instruction).join(' '));
    if (recipe.mealType === 'Postre' || BAKING.test(text)) {
      tips.push(
        'Usa un molde más pequeño para que la mezcla quede de la misma altura; así el horneado casi no cambia. Revisa con un palillo unos minutos antes.'
      );
    } else {
      tips.push(
        'Usa una olla o sartén más pequeño: con menos cantidad el líquido se evapora más rápido y la cocción puede tardar un poco menos.'
      );
    }
    if (factor < 0.2) {
      tips.push(`Con lo que tienes sale muy poquito (${percent} % de la receta). Si puedes, consigue más ${limitingName}.`);
    }
  }
  if (omittedNames.length > 0) {
    tips.push(`Sin ${omittedNames.join(', ')} la receta sale igual: es opcional.`);
  }
  return tips;
}

/**
 * Plans the recipe with what the user has: the scarcest ingredient sets the factor and the rest
 * of the recipe is reduced in the same proportion.
 */
export function partitionRecipe(recipe: Recipe, available: AvailableAmount[]): PartitionOutcome {
  if (available.length === 0) return fail('Elige el ingrediente que no te alcanza.');

  const limits = new Map<number, { ratio: number; have: number; unit: string }>();
  const omitted = new Set<number>();

  for (const entry of available) {
    const ing = recipe.ingredients[entry.index];
    if (!ing) return fail('Ese ingrediente no está en la receta.');
    const required = parseAmount(ing.amount);
    const recipeUnit = parseUnit(ing.unit);
    if (required == null || required <= 0 || !recipeUnit.measured) {
      return fail(`${ing.name} no tiene una cantidad exacta en la receta, así que no sirve para calcular.`);
    }
    const have = parseAmount(entry.amount);
    if (have == null) return fail(`Escribe cuánto tienes de ${ing.name} (por ejemplo 1, 1/2 o 200).`);
    if (have === 0) {
      if (ing.essential) return fail(`Sin ${ing.name} no se puede preparar esta receta.`);
      omitted.add(entry.index);
      continue;
    }
    const ratio = availableRatio(have, entry.unit, required, recipeUnit);
    if (ratio == null) return fail(`Elige una unidad de la lista para ${ing.name}.`);
    limits.set(entry.index, { ratio, have, unit: entry.unit });
  }

  let factor = 1;
  let limitingIndex = -1;
  for (const [index, limit] of limits) {
    if (limit.ratio < factor) {
      factor = limit.ratio;
      limitingIndex = index;
    }
  }
  const isFullRecipe = factor >= 1 - EPS;
  if (isFullRecipe) factor = 1;
  const percent = isFullRecipe ? 100 : Math.max(1, Math.floor(factor * 100));
  const limitingName = limitingIndex >= 0 ? recipe.ingredients[limitingIndex].name : '';

  const ingredients: PartitionedIngredient[] = recipe.ingredients.map((ing, index) => {
    const base: PartitionedIngredient = {
      ...ing,
      originalAmount: ing.amount,
      originalUnit: ing.unit,
      limited: limits.has(index),
      limiting: index === limitingIndex,
      omitted: omitted.has(index),
      changed: false,
    };
    if (base.omitted) return { ...base, amount: '0', note: 'No lo tienes y es opcional: puedes omitirlo.' };
    if (isFullRecipe) return base;

    if (base.limiting) {
      // Show exactly what the user has, in the unit they typed.
      const limit = limits.get(index)!;
      const parsed = parseUnit(ing.unit);
      const userDef = parsed.def?.key === limit.unit ? parsed.def : unitByKey(limit.unit);
      const descriptor = parsed.def?.key === limit.unit ? parsed.descriptor : '';
      const unit = userDef ? unitLabel(userDef, limit.have, descriptor) : parsed.raw;
      const metric = userDef?.key === 'g' || userDef?.key === 'ml';
      const amount = metric ? String(Math.round(limit.have * 10) / 10) : formatKitchenNumber(limit.have);
      return { ...base, amount, unit, changed: true, note: 'Usa todo lo que tienes.' };
    }

    if (!isMeasurable(ing)) {
      return parseUnit(ing.unit).measured ? { ...base, note: 'Sin medida exacta: ajústalo a la nueva cantidad.' } : base;
    }
    // Ingredients the user is also short of are rounded down so they never ask for more than there is.
    const rounding: Rounding = base.limited ? 'down' : 'nearest';
    const q = formatQuantity(parseAmount(ing.amount)! * factor, ing.unit, rounding, ing.name);
    return { ...base, amount: q.amount, unit: q.unit, changed: true, note: q.note };
  });

  const missingForFullRecipe = [...limits.entries()]
    .filter(([, limit]) => limit.ratio < 1 - EPS)
    .map(([index, limit]) => {
      const ing = recipe.ingredients[index];
      const missing = parseAmount(ing.amount)! * (1 - limit.ratio);
      const q = formatQuantity(missing, ing.unit, 'up', ing.name);
      return { name: ing.name, amount: q.amount, unit: q.unit };
    });

  const servings = recipe.servings * factor;
  const omittedNames = [...omitted].map((i) => recipe.ingredients[i].name);

  return {
    ok: true,
    plan: {
      factor,
      percent,
      limitingIngredient: limitingName,
      servings,
      servingsLabel: servingsLabel(servings),
      // Less to chop and measure; cooking time barely changes with a smaller pot.
      prepTimeMinutes: Math.max(1, Math.round(recipe.prepTimeMinutes * (0.5 + 0.5 * factor))),
      cookTimeMinutes: Math.max(1, Math.round(recipe.cookTimeMinutes * (0.8 + 0.2 * factor))),
      ingredients,
      steps: isFullRecipe ? recipe.steps : adaptStepsByRules(recipe.steps, factor),
      missingForFullRecipe,
      tips: kitchenTips(recipe, factor, percent, limitingName, omittedNames),
      isFullRecipe,
    },
  };
}
