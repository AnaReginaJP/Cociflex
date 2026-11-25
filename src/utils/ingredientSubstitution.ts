// Motor de sustitución de ingredientes: cruza los faltantes de una receta con la base de
// equivalencias y con lo que la persona tiene en su despensa. Es lógica pura, sin React,
// para poder probarla con node:test y para que funcione sin IA.
import {
  isIngredientMatched,
  normalizeText,
  type MatchResult,
  type RecipeIngredient,
} from './recipeMatcher.ts';
import { parseAmount, prettyAmount } from './recipePartition.ts';
import {
  INGREDIENT_SUBSTITUTES,
  type IngredientFunction,
  type SubstituteEntry,
  type SubstituteOption,
} from '../data/ingredientSubstitutes.ts';

export interface SubstitutionSuggestion {
  /** Ingrediente de la receta que falta. */
  missing: string;
  /** Ingrediente de la despensa que lo reemplaza. */
  substitute: string;
  /** Cantidad ya ajustada, sin unidad. */
  amount: string;
  unit: string;
  /** Cambio de sabor o textura. */
  note: string;
  /** Función del ingrediente original en el platillo. */
  explanation: string;
  allergens: string[];
  /** Cuándo no conviene usar esta sustitución. */
  caution?: string;
  source: 'base' | 'ia';
}

export interface SubstitutionMatch {
  /** Porcentaje contando los faltantes que tienen sustituto disponible. */
  matchPercentage: number;
  /** Porcentaje original, para mostrar la comparación. */
  originalPercentage: number;
  /** Nombres de los faltantes que quedaron cubiertos. */
  covered: string[];
  suggestions: SubstitutionSuggestion[];
}

const FUNCTION_LABELS: Record<IngredientFunction, string> = {
  liquido: 'líquido',
  grasa: 'grasa',
  aglutinante: 'aglutinante',
  leudante: 'leudante',
  acido: 'acidez',
  dulzor: 'dulzor',
  sabor: 'sabor',
  espesante: 'espesor',
};

function joinLabels(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}

/** Busca la entrada de la base para un ingrediente; primero exacta y luego por nombre contenido. */
export function findSubstituteEntry(ingredient: string): SubstituteEntry | undefined {
  const target = normalizeText(ingredient);
  if (!target) return undefined;
  const exact = INGREDIENT_SUBSTITUTES.find((entry) => normalizeText(entry.ingredient) === target);
  if (exact) return exact;
  return INGREDIENT_SUBSTITUTES.find((entry) => {
    const name = normalizeText(entry.ingredient);
    return target.includes(name) || name.includes(target);
  });
}

function buildExplanation(ingredient: string, functions: IngredientFunction[]): string {
  const labels = functions.map((fn) => FUNCTION_LABELS[fn]).filter(Boolean);
  if (labels.length === 0) return `En esta receta, ${ingredient} cumple una función importante.`;
  return `${ingredient} aporta ${joinLabels(labels)} en esta receta.`;
}

const UNIT_PLURALS: Record<string, string> = {
  taza: 'tazas',
  cucharada: 'cucharadas',
  cucharadita: 'cucharaditas',
  pieza: 'piezas',
  rebanada: 'rebanadas',
  diente: 'dientes',
};

function unitFor(unit: string, amount: string): string {
  const value = parseAmount(amount);
  if (value == null || value <= 1) return unit;
  return UNIT_PLURALS[unit] ?? unit;
}

/** Ajusta la cantidad del ingrediente faltante a la proporción del sustituto. */
export function substitutionAmount(
  ingredient: RecipeIngredient,
  option: SubstituteOption
): { amount: string; unit: string } {
  const value = parseAmount(ingredient.amount);
  if (value == null || value <= 0) return { amount: 'Al gusto', unit: '' };
  const result = Math.round(value * option.ratio * 100) / 100;
  if (!Number.isFinite(result) || result <= 0) return { amount: 'Al gusto', unit: '' };
  const amount = prettyAmount(String(result));
  return { amount, unit: unitFor(option.unit, amount) };
}

function suggestionFor(ingredient: RecipeIngredient, entry: SubstituteEntry, option: SubstituteOption): SubstitutionSuggestion {
  const { amount, unit } = substitutionAmount(ingredient, option);
  return {
    missing: ingredient.name,
    substitute: option.name,
    amount,
    unit,
    note: option.note,
    explanation: buildExplanation(ingredient.name, entry.functions),
    allergens: option.allergens ?? [],
    ...(entry.avoidWhen ? { caution: entry.avoidWhen } : {}),
    source: 'base',
  };
}

/**
 * Devuelve, para cada faltante, el sustituto mejor rankeado que la persona sí tiene.
 * No recomienda nada fuera de la despensa y no inventa cuando no hay equivalencia.
 */
export function findSubstitutions(
  missing: RecipeIngredient[],
  pantry: string[]
): SubstitutionSuggestion[] {
  const suggestions: SubstitutionSuggestion[] = [];
  const seen = new Set<string>();
  const available = Array.isArray(pantry) ? pantry : [];

  for (const ingredient of missing) {
    const key = normalizeText(ingredient.name);
    if (!key || seen.has(key)) continue;
    const entry = findSubstituteEntry(ingredient.name);
    if (!entry || entry.substitutes.length === 0) continue;
    const option = entry.substitutes.find((candidate) => isIngredientMatched(candidate.name, available));
    if (!option) continue;
    seen.add(key);
    suggestions.push(suggestionFor(ingredient, entry, option));
  }

  return suggestions;
}

/**
 * Recalcula el porcentaje de coincidencia contando como cubierto solo el faltante que tiene
 * un sustituto disponible. Nunca pasa de 100 ni sube si no hubo sustitución.
 */
export function matchWithSubstitutions(result: MatchResult, pantry: string[]): SubstitutionMatch {
  const suggestions = findSubstitutions(result.missingIngredients, pantry);
  const covered = new Set(suggestions.map((suggestion) => normalizeText(suggestion.missing)));
  const total = result.recipe.ingredients.length;
  const matched = result.matchedIngredients.length + covered.size;
  const matchPercentage = total === 0 ? 0 : Math.min(100, Math.round((matched / total) * 100));

  return {
    matchPercentage: Math.max(result.matchPercentage, matchPercentage),
    originalPercentage: result.matchPercentage,
    covered: suggestions.map((suggestion) => suggestion.missing),
    suggestions,
  };
}

/** Faltantes que la base no pudo cubrir; son los candidatos para consultar a la IA. */
export function missingWithoutSubstitute(
  missing: RecipeIngredient[],
  pantry: string[]
): RecipeIngredient[] {
  const covered = new Set(findSubstitutions(missing, pantry).map((s) => normalizeText(s.missing)));
  return missing.filter((ingredient) => !covered.has(normalizeText(ingredient.name)));
}
