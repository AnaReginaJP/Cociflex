import { calculateRecipeMatch, isIngredientMatched, normalizeText } from './recipeMatcher.ts';
import type { Recipe, RecipeIngredient } from './recipeMatcher.ts';

/**
 * Despensa con caducidad ("cero desperdicio").
 * Todo vive en el navegador: las fechas se guardan en localStorage, sin base de datos.
 * Una fecha es un texto "AAAA-MM-DD" en la hora local de la persona.
 */

export const PANTRY_EXPIRY_STORAGE_KEY = 'cociflex_pantry_expiry_v1';

/** Fechas de caducidad por ingrediente. La llave es el nombre sin acentos ni mayúsculas. */
export type ExpiryDates = Record<string, string>;

export type ExpiryStatus = 'expired' | 'urgent' | 'soon' | 'ok' | 'none';

export interface ExpiryItem {
  name: string;
  dateKey: string | null;
  /** Días que faltan (0 = hoy, negativo = ya caducó). null si no tiene fecha. */
  daysLeft: number | null;
  status: ExpiryStatus;
}

export interface ExpiryReport {
  expired: ExpiryItem[];
  urgent: ExpiryItem[];
  soon: ExpiryItem[];
  ok: ExpiryItem[];
  none: ExpiryItem[];
}

export interface RescueRecipe {
  recipe: Recipe;
  /** Ingredientes por caducar que esta receta aprovecha. */
  rescued: string[];
  matchPercentage: number;
  missingIngredients: RecipeIngredient[];
}

/** Atajos del registro rápido: "caduca en...". */
export const QUICK_EXPIRY_OPTIONS: { label: string; days: number }[] = [
  { label: 'Hoy', days: 0 },
  { label: '3 días', days: 3 },
  { label: '1 semana', days: 7 },
  { label: '2 semanas', days: 14 },
];

export function expiryKey(name: string): string {
  return normalizeText(name);
}

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Convierte una fecha a "AAAA-MM-DD" con la hora local (no UTC, para no adelantar el día). */
export function toDateKey(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Fecha de hoy más N días, como "AAAA-MM-DD". */
export function addDaysToKey(today: Date, days: number): string {
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  return toDateKey(next);
}

/** ¿Es un texto "AAAA-MM-DD" con una fecha real (no 2026-02-31)? */
export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Días completos entre hoy y la fecha. 0 = hoy, -1 = caducó ayer. null si la fecha no es válida. */
export function daysUntil(dateKey: string | null | undefined, today: Date = new Date()): number | null {
  if (!isValidDateKey(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - start) / 86_400_000);
}

/**
 * Semáforo: ya caducó (<0), hoy o mañana (0-1), en 3 días o menos (2-3),
 * bien (4 o más) o sin fecha.
 */
export function getExpiryStatus(daysLeft: number | null): ExpiryStatus {
  if (daysLeft === null) return 'none';
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 1) return 'urgent';
  if (daysLeft <= 3) return 'soon';
  return 'ok';
}

/** Mensaje corto para mostrar junto al ingrediente. */
export function describeExpiry(daysLeft: number | null): string {
  if (daysLeft === null) return 'Sin fecha';
  if (daysLeft < -1) return `Caducó hace ${-daysLeft} días`;
  if (daysLeft === -1) return 'Caducó ayer';
  if (daysLeft === 0) return 'Caduca hoy';
  if (daysLeft === 1) return 'Caduca mañana';
  return `Caduca en ${daysLeft} días`;
}

/** Guarda o quita (con null) la fecha de un ingrediente, sin modificar el objeto original. */
export function setExpiryDate(dates: ExpiryDates, name: string, dateKey: string | null): ExpiryDates {
  const key = expiryKey(name);
  if (!key) return dates;
  const next = { ...dates };
  if (dateKey === null || !isValidDateKey(dateKey)) {
    delete next[key];
  } else {
    next[key] = dateKey;
  }
  return next;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Lee las fechas guardadas. Si algo falla o está dañado, regresa {} y la app sigue normal. */
export function loadExpiryDates(storage: StorageLike | null = getBrowserStorage()): ExpiryDates {
  if (!storage) return {};
  try {
    const raw = storage.getItem(PANTRY_EXPIRY_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const clean: ExpiryDates = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key && isValidDateKey(value)) clean[key] = value;
    }
    return clean;
  } catch {
    return {};
  }
}

/** Guarda las fechas. Regresa false si el navegador no lo permitió (modo privado, sin espacio...). */
export function saveExpiryDates(dates: ExpiryDates, storage: StorageLike | null = getBrowserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PANTRY_EXPIRY_STORAGE_KEY, JSON.stringify(dates));
    return true;
  } catch {
    return false;
  }
}

/**
 * Agrupa los ingredientes de la despensa por semáforo.
 * Solo cuenta los que siguen marcados: si la persona quita uno, su alerta desaparece.
 */
export function buildExpiryReport(
  ingredients: string[],
  dates: ExpiryDates,
  today: Date = new Date()
): ExpiryReport {
  const report: ExpiryReport = { expired: [], urgent: [], soon: [], ok: [], none: [] };
  const seen = new Set<string>();
  for (const name of ingredients) {
    const key = expiryKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const dateKey = isValidDateKey(dates[key]) ? dates[key] : null;
    const daysLeft = daysUntil(dateKey, today);
    const status = getExpiryStatus(daysLeft);
    report[status].push({ name, dateKey, daysLeft, status });
  }
  const byDays = (a: ExpiryItem, b: ExpiryItem) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0);
  report.expired.sort(byDays);
  report.urgent.sort(byDays);
  report.soon.sort(byDays);
  report.ok.sort(byDays);
  return report;
}

/** Nombres de lo que conviene cocinar ya: urgente y pronto, lo más cercano primero. Nunca lo caducado. */
export function getRescueIngredients(report: ExpiryReport): string[] {
  return [...report.urgent, ...report.soon].map((item) => item.name);
}

/**
 * Recetas del catálogo que aprovechan lo que está por caducar.
 * Lo ya caducado no cuenta como "lo que tienes". Primero las que salvan más ingredientes,
 * y a igualdad, las que ya tienes más completas.
 */
export function getRescueRecipes(
  recipes: Recipe[],
  report: ExpiryReport,
  limit: number = 3
): RescueRecipe[] {
  const rescueNames = getRescueIngredients(report);
  if (rescueNames.length === 0 || limit <= 0) return [];

  const expiredKeys = new Set(report.expired.map((item) => expiryKey(item.name)));
  const available = [...report.urgent, ...report.soon, ...report.ok, ...report.none]
    .map((item) => item.name)
    .filter((name) => !expiredKeys.has(expiryKey(name)));

  const results: RescueRecipe[] = [];
  for (const recipe of recipes) {
    const rescued = rescueNames.filter((name) =>
      recipe.ingredients.some((ing) => isIngredientMatched(ing.name, [name]))
    );
    if (rescued.length === 0) continue;
    const match = calculateRecipeMatch(recipe, available);
    results.push({
      recipe,
      rescued,
      matchPercentage: match.matchPercentage,
      missingIngredients: match.missingIngredients,
    });
  }

  results.sort(
    (a, b) => b.rescued.length - a.rescued.length || b.matchPercentage - a.matchPercentage
  );
  return results.slice(0, limit);
}

/** Lo que falta de una receta y todavía no está en Mandado (sin importar mayúsculas ni acentos). */
export function getMissingForShopping(
  missing: RecipeIngredient[],
  shoppingList: string[]
): string[] {
  const inList = new Set(shoppingList.map(normalizeText));
  const result: string[] = [];
  for (const ingredient of missing) {
    const key = normalizeText(ingredient.name);
    if (!key || inList.has(key)) continue;
    inList.add(key);
    result.push(ingredient.name);
  }
  return result;
}
