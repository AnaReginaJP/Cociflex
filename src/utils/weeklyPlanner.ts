// Weekly menu planner: picks one main dish per day from the recipes, reuses ingredients between
// days, adds up the shopping list and estimates the cost. Rule-based, no language model.
import { normalizeText } from './recipeMatcher.ts';
import type { Recipe } from './recipeMatcher.ts';
import { parseAmount, formatKitchenNumber, roundToKitchenFraction } from './recipePartition.ts';
import { getUnitPrice } from '../data/ingredientPrices.ts';

export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export type Diet = 'Todas' | 'Vegetariano' | 'Vegano';

export interface PlannerInput {
  personas: number;
  /** Weekly budget in MXN. */
  presupuesto: number;
  /** Maximum minutes (preparation + cooking) for the dish of each day. */
  minutosPorDia: number;
  dieta: Diet;
}

export interface PlannedIngredient {
  name: string;
  /** Unit as written in the recipe ("piezas", "g", "tazas"...). */
  unit: string;
  /** Amount already scaled to the number of people. null when the recipe has no number ("al gusto"). */
  amount: number | null;
  /** Estimated cost in MXN, or null when there is no price for this ingredient. */
  cost: number | null;
}

export interface PlannedDay {
  day: string;
  recipeId: string;
  title: string;
  minutes: number;
  cost: number;
  ingredients: PlannedIngredient[];
}

export interface ShoppingLine {
  name: string;
  quantity: string;
  cost: number | null;
  days: string[];
}

export interface WeeklyPlan {
  input: PlannerInput;
  days: PlannedDay[];
  shopping: ShoppingLine[];
  totalCost: number;
  /** Ingredients that have no price, so the total is partial. */
  unpricedCount: number;
  warnings: string[];
}

export type InputResult = { ok: true; input: PlannerInput } | { ok: false; errors: string[] };

export const LIMITS = {
  personas: { min: 1, max: 20 },
  presupuesto: { min: 50, max: 20000 },
  minutosPorDia: { min: 10, max: 240 },
};

// ---------- Input ----------

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value.replace(',', '.'));
  return NaN;
};

/** Checks the form values. Returns clear messages in Spanish when something is wrong. */
export function validatePlannerInput(raw: {
  personas: unknown;
  presupuesto: unknown;
  minutosPorDia: unknown;
  dieta?: unknown;
}): InputResult {
  const errors: string[] = [];
  const personas = toNumber(raw.personas);
  const presupuesto = toNumber(raw.presupuesto);
  const minutosPorDia = toNumber(raw.minutosPorDia);

  if (!Number.isInteger(personas) || personas < LIMITS.personas.min || personas > LIMITS.personas.max) {
    errors.push(`Escribe cuántas personas son, un número entero entre ${LIMITS.personas.min} y ${LIMITS.personas.max}.`);
  }
  if (!Number.isFinite(presupuesto) || presupuesto < LIMITS.presupuesto.min || presupuesto > LIMITS.presupuesto.max) {
    errors.push(`Escribe tu presupuesto semanal en pesos, entre $${LIMITS.presupuesto.min} y $${LIMITS.presupuesto.max}.`);
  }
  if (
    !Number.isInteger(minutosPorDia) ||
    minutosPorDia < LIMITS.minutosPorDia.min ||
    minutosPorDia > LIMITS.minutosPorDia.max
  ) {
    errors.push(`Escribe los minutos que tienes para cocinar cada día, entre ${LIMITS.minutosPorDia.min} y ${LIMITS.minutosPorDia.max}.`);
  }
  if (errors.length > 0) return { ok: false, errors };

  const dieta: Diet = raw.dieta === 'Vegetariano' || raw.dieta === 'Vegano' ? raw.dieta : 'Todas';
  return { ok: true, input: { personas, presupuesto, minutosPorDia, dieta } };
}

// ---------- Diet and eligibility ----------

const MEAT_WORDS = ['pollo', 'pechuga', 'carne', 'res', 'cerdo', 'puerco', 'jamon', 'atun', 'pescado', 'camaron', 'chorizo', 'tocino', 'salchicha'];
const ANIMAL_WORDS = ['huevo', 'huevos', 'leche', 'queso', 'crema', 'mantequilla', 'miel', 'yogur', 'yogurt', 'cuajo'];

// "Caldo de pollo o verduras" can be made with vegetable stock; the plan says so.
const VEGETABLE_OPTION = /\bverduras?\b/;

const words = (name: string): string[] => normalizeText(name).split(/[^a-z0-9ñ]+/).filter(Boolean);
const hasAny = (name: string, list: string[]): boolean => words(name).some((w) => list.includes(w));
const hasVegetableOption = (name: string): boolean => VEGETABLE_OPTION.test(normalizeText(name));

export function isVegetarian(recipe: Recipe): boolean {
  return recipe.ingredients.every((ing) => !hasAny(ing.name, MEAT_WORDS) || hasVegetableOption(ing.name));
}

export function isVegan(recipe: Recipe): boolean {
  return (
    isVegetarian(recipe) &&
    recipe.ingredients.every((ing) => !hasAny(ing.name, ANIMAL_WORDS) || hasVegetableOption(ing.name))
  );
}

/** True when the recipe only fits the diet thanks to "caldo de verduras" instead of the meat one. */
export function needsVegetableSubstitute(recipe: Recipe, diet: Diet): boolean {
  if (diet === 'Todas') return false;
  return recipe.ingredients.some((ing) => hasAny(ing.name, MEAT_WORDS) && hasVegetableOption(ing.name));
}

const NOT_A_MAIN_MEAL_CATEGORIES = ['Postres', 'Fermentación y Bioartesanal'];

/** One main dish a day: no desserts and no fermentation recipes. */
export function isMainMeal(recipe: Recipe): boolean {
  return recipe.mealType !== 'Postre' && !NOT_A_MAIN_MEAL_CATEGORIES.includes(recipe.category);
}

export function totalMinutes(recipe: Recipe): number {
  return recipe.prepTimeMinutes + recipe.cookTimeMinutes;
}

export function isPlannable(recipe: Recipe, input: PlannerInput): boolean {
  if (!isMainMeal(recipe)) return false;
  if (recipe.ingredients.length === 0) return false;
  if (totalMinutes(recipe) > input.minutosPorDia) return false;
  if (input.dieta === 'Vegetariano' && !isVegetarian(recipe)) return false;
  if (input.dieta === 'Vegano' && !isVegan(recipe)) return false;
  return true;
}

// ---------- Units, scaling and cost ----------

/** "piezas grandes" → "pieza", "cucharada sopera" → "cucharada", "g cocido" → "g". */
export function unitKey(unit: string): string {
  const first = normalizeText(unit).split(/\s+/)[0] ?? '';
  if (first.length <= 2) return first;
  return first.endsWith('s') ? first.slice(0, -1) : first;
}

const INVARIABLE_UNITS = ['g', 'kg', 'ml', 'l'];

function unitLabel(key: string, total: number): string {
  if (!key) return '';
  if (INVARIABLE_UNITS.includes(key) || total <= 1) return key;
  return /[aeiou]$/.test(key) ? `${key}s` : `${key}es`;
}

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

/** Amount for the screen: grams and ml as whole numbers, the rest as kitchen fractions (4.83 → 4¾). */
export function displayAmount(value: number, unit: string): string {
  if (!Number.isFinite(value) || value <= 0) return formatKitchenNumber(Math.max(0, value || 0));
  if (INVARIABLE_UNITS.includes(unitKey(unit))) return String(Math.max(1, Math.round(value)));
  const rounded = roundToKitchenFraction(value, 'nearest');
  return formatKitchenNumber(rounded > 0 ? rounded : value);
}

function scaleRecipe(recipe: Recipe, personas: number): PlannedIngredient[] {
  const factor = recipe.servings > 0 ? personas / recipe.servings : 1;
  return recipe.ingredients.map((ing) => {
    const parsed = parseAmount(ing.amount);
    const amount = parsed == null ? null : parsed * factor;
    const price = getUnitPrice(ing.name, unitKey(ing.unit));
    return {
      name: ing.name,
      unit: ing.unit,
      amount,
      cost: amount != null && price != null ? roundMoney(amount * price) : null,
    };
  });
}

function toPlannedDay(recipe: Recipe, day: string, personas: number): PlannedDay {
  const ingredients = scaleRecipe(recipe, personas);
  return {
    day,
    recipeId: recipe.id,
    title: recipe.title,
    minutes: totalMinutes(recipe),
    cost: roundMoney(ingredients.reduce((sum, ing) => sum + (ing.cost ?? 0), 0)),
    ingredients,
  };
}

// ---------- Shopping list ----------

/** "Pollo / Pechuga" → "pollo", "Chile chipotle o pasilla" → "chile chipotle". */
function baseName(name: string): string {
  return normalizeText(name).split(/\s\/\s|\so\s/)[0].trim();
}

export function buildShoppingList(days: PlannedDay[]): ShoppingLine[] {
  interface Group {
    name: string;
    totals: Map<string, number>;
    withoutAmount: boolean;
    cost: number;
    hasCost: boolean;
    days: string[];
  }
  const groups = new Map<string, Group>();

  for (const day of days) {
    for (const ing of day.ingredients) {
      const key = normalizeText(ing.name);
      const group = groups.get(key) ?? {
        name: ing.name,
        totals: new Map<string, number>(),
        withoutAmount: false,
        cost: 0,
        hasCost: false,
        days: [],
      };
      if (ing.amount == null) {
        group.withoutAmount = true;
      } else {
        const unit = unitKey(ing.unit);
        group.totals.set(unit, (group.totals.get(unit) ?? 0) + ing.amount);
      }
      if (ing.cost != null) {
        group.cost += ing.cost;
        group.hasCost = true;
      }
      if (!group.days.includes(day.day)) group.days.push(day.day);
      groups.set(key, group);
    }
  }

  return Array.from(groups.values())
    .map((group) => {
      const parts = Array.from(group.totals.entries()).map(([unit, total]) => {
        const label = unitLabel(unit, total);
        return `${displayAmount(total, unit)}${label ? ` ${label}` : ''}`;
      });
      if (group.withoutAmount) parts.push('al gusto');
      return {
        name: group.name,
        quantity: parts.join(' + '),
        cost: group.hasCost ? roundMoney(group.cost) : null,
        days: group.days,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** Ingredient names (no amounts) that are not yet in the Mandado list. */
export function namesForMandado(plan: WeeklyPlan, currentList: string[]): string[] {
  const existing = new Set(currentList.map((item) => normalizeText(item)));
  const result: string[] = [];
  for (const line of plan.shopping) {
    const key = normalizeText(line.name);
    if (existing.has(key)) continue;
    existing.add(key);
    result.push(line.name);
  }
  return result;
}

// ---------- Picking the recipes ----------

const STAPLES = ['aceite', 'sal', 'pimienta', 'agua'];

/** Ingredients that make two dishes "share" shopping (staples such as oil or salt do not count). */
function sharedKeys(recipe: Recipe): Set<string> {
  const keys = new Set<string>();
  for (const ing of recipe.ingredients) {
    const key = baseName(ing.name);
    if (words(key).some((w) => STAPLES.includes(w))) continue;
    keys.add(key);
  }
  return keys;
}

function overlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const key of a) if (b.has(key)) count++;
  return count;
}

interface PickContext {
  /** Recipes already in the plan (the other days). */
  chosen: Recipe[];
  /** Recipes of the day before and after, to avoid the same dish on consecutive days. */
  neighbours: Recipe[];
  /** Every recipe that could be picked, used to start the week with a well connected dish. */
  pool: Recipe[];
  input: PlannerInput;
}

function scoreRecipe(recipe: Recipe, ctx: PickContext): number {
  const keys = sharedKeys(recipe);
  let score = 0;

  // Reusing ingredients saves money: reward what is shared with the dishes already chosen.
  if (ctx.chosen.length > 0) {
    for (const other of ctx.chosen) score += 10 * overlap(keys, sharedKeys(other));
  } else {
    for (const other of ctx.pool) if (other.id !== recipe.id) score += overlap(keys, sharedKeys(other));
  }

  // Variety: repeating a dish is the last resort, and never on consecutive days.
  const timesUsed = ctx.chosen.filter((r) => r.id === recipe.id).length;
  score -= 1000 * timesUsed;
  if (ctx.neighbours.some((r) => r.id === recipe.id)) score -= 5000;
  if (ctx.neighbours.some((r) => r.mealType === recipe.mealType)) score -= 3;

  // Budget: dishes above the daily budget lose points; cheaper dishes win ties.
  const cost = toPlannedDay(recipe, '', ctx.input.personas).cost;
  const dailyBudget = ctx.input.presupuesto / 7;
  if (cost > dailyBudget) score -= ((cost - dailyBudget) / dailyBudget) * 20;
  score -= cost * 0.05;
  return score;
}

function pickBest(candidates: Recipe[], ctx: PickContext): Recipe | null {
  let best: Recipe | null = null;
  let bestScore = -Infinity;
  for (const recipe of candidates) {
    const score = scoreRecipe(recipe, ctx);
    if (score > bestScore) {
      best = recipe;
      bestScore = score;
    }
  }
  return best;
}

function pickWeek(pool: Recipe[], input: PlannerInput): Recipe[] {
  const week: Recipe[] = [];
  for (let i = 0; i < 7; i++) {
    const previous = week[i - 1];
    const best = pickBest(pool, { chosen: week, neighbours: previous ? [previous] : [], pool, input });
    if (!best) break;
    week.push(best);
  }
  return week;
}

// ---------- The plan ----------

function assemblePlan(recipes: Recipe[], input: PlannerInput, pool: Recipe[]): WeeklyPlan {
  const days = recipes.map((recipe, i) => toPlannedDay(recipe, DAY_NAMES[i], input.personas));
  const shopping = buildShoppingList(days);
  const totalCost = roundMoney(days.reduce((sum, day) => sum + day.cost, 0));
  const unpricedCount = shopping.filter((line) => line.cost == null).length;
  const warnings: string[] = [];

  if (days.length === 0) {
    const reasons = [`${input.minutosPorDia} minutos por día`];
    if (input.dieta !== 'Todas') reasons.push(`dieta ${input.dieta.toLowerCase()}`);
    warnings.push(
      `Ninguna receta del catálogo cumple con ${reasons.join(' y ')}. Prueba con más minutos o con otra dieta.`
    );
    return { input, days, shopping, totalCost, unpricedCount, warnings };
  }

  const distinct = new Set(recipes.map((r) => r.id)).size;
  if (distinct < 7) {
    warnings.push(
      `Con tus filtros solo hay ${pool.length} ${pool.length === 1 ? 'receta' : 'recetas'} distintas, así que algunos platillos se repiten durante la semana.`
    );
  }
  if (totalCost > input.presupuesto) {
    warnings.push(
      `El menú cuesta aproximadamente $${Math.round(totalCost)}, unos $${Math.round(totalCost - input.presupuesto)} más que tu presupuesto. Prueba con menos personas, más presupuesto o menos minutos por día.`
    );
  }
  if (unpricedCount > 0) {
    warnings.push(
      `${unpricedCount} ${unpricedCount === 1 ? 'ingrediente no tiene' : 'ingredientes no tienen'} precio, así que el costo es parcial.`
    );
  }
  const substituted = recipes.filter((r, i) => recipes.findIndex((x) => x.id === r.id) === i && needsVegetableSubstitute(r, input.dieta));
  for (const recipe of substituted) {
    warnings.push(`En "${recipe.title}" usa caldo de verduras en lugar del de pollo.`);
  }
  return { input, days, shopping, totalCost, unpricedCount, warnings };
}

function plannablePool(recipes: Recipe[], input: PlannerInput): Recipe[] {
  const seen = new Set<string>();
  return recipes.filter((recipe) => {
    if (seen.has(recipe.id) || !isPlannable(recipe, input)) return false;
    seen.add(recipe.id);
    return true;
  });
}

/** Builds the 7-day menu. With no recipes that fit, it returns an empty plan with a warning. */
export function buildWeeklyPlan(recipes: Recipe[], input: PlannerInput): WeeklyPlan {
  const pool = plannablePool(recipes, input);
  return assemblePlan(pickWeek(pool, input), input, pool);
}

/** Rebuilds a saved plan from the ids of its recipes. Returns null if one of them no longer exists. */
export function rebuildWeeklyPlan(recipes: Recipe[], input: PlannerInput, recipeIds: string[]): WeeklyPlan | null {
  if (recipeIds.length === 0 || recipeIds.length > 7) return null;
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const picked: Recipe[] = [];
  for (const id of recipeIds) {
    const recipe = byId.get(id);
    if (!recipe) return null;
    picked.push(recipe);
  }
  return assemblePlan(picked, input, plannablePool(recipes, input));
}

export interface ReplaceResult {
  plan: WeeklyPlan;
  changed: boolean;
  message?: string;
}

/** "Cambiar este día": replaces only that day; the other six stay exactly the same. */
export function replaceDay(recipes: Recipe[], plan: WeeklyPlan, dayIndex: number): ReplaceResult {
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= plan.days.length) {
    return { plan, changed: false, message: 'Ese día no está en el menú.' };
  }
  const input = plan.input;
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const current = plan.days.map((d) => byId.get(d.recipeId));
  if (current.some((r) => !r)) {
    return { plan, changed: false, message: 'Una receta del menú ya no está disponible. Arma el menú de nuevo.' };
  }
  const week = current as Recipe[];
  const pool = plannablePool(recipes, input);
  const others = week.filter((_, i) => i !== dayIndex);
  const neighbours = [week[dayIndex - 1], week[dayIndex + 1]].filter((r): r is Recipe => Boolean(r));

  const candidates = pool.filter((r) => r.id !== week[dayIndex].id);
  const best = pickBest(candidates, { chosen: others, neighbours, pool, input });
  if (!best) {
    return {
      plan,
      changed: false,
      message: 'No hay otra receta que cumpla con tus filtros para cambiar este día.',
    };
  }
  const next = week.slice();
  next[dayIndex] = best;
  return { plan: assemblePlan(next, input, pool), changed: true };
}

/** Text for the cost bar: how much of the budget the menu uses. */
export function budgetUsage(plan: WeeklyPlan): { percent: number; over: boolean } {
  if (plan.input.presupuesto <= 0) return { percent: 0, over: false };
  const percent = Math.round((plan.totalCost / plan.input.presupuesto) * 100);
  return { percent, over: plan.totalCost > plan.input.presupuesto };
}
