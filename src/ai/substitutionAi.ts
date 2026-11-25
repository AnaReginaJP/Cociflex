// Apoyo opcional de IA para la sustitución de ingredientes.
// Solo se usa cuando la base de equivalencias no cubre un faltante o cuando se quiere explicar
// mejor la función de un ingrediente. La respuesta se valida contra la despensa: la IA no puede
// recomendar nada que la persona no tenga. Si falla, la app sigue con la base y las reglas.
import { isIngredientMatched, normalizeText } from '../utils/recipeMatcher.ts';
import {
  LlmError,
  requestJson,
  type ChatMessage,
  type JsonFormat,
  type LlmConfig,
} from './localLlm.ts';

export interface AiMissingIngredient {
  name: string;
  amount: string;
  unit: string;
}

export interface SubstitutionAiRequest {
  recipeTitle: string;
  missing: AiMissingIngredient[];
  pantry: string[];
}

export interface AiSubstitutionSuggestion {
  missing: string;
  substitute: string;
  amount: string;
  note: string;
  allergens: string[];
}

export type ParseSubstitutionResult =
  | { ok: true; value: SubstitutionAiRequest }
  | { ok: false; error: string };

const MAX_MISSING = 8;
const MAX_PANTRY = 100;

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/** Valida el cuerpo de POST /api/ai/sustitutos antes de llamar al modelo. */
export function parseSubstitutionRequest(body: unknown): ParseSubstitutionResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'La solicitud no es válida.' };
  }
  const data = body as Record<string, unknown>;
  const recipeTitle = text(data.recipeTitle, 200);
  if (!recipeTitle) {
    return { ok: false, error: 'Falta el nombre de la receta.' };
  }

  if (!Array.isArray(data.missing) || data.missing.length === 0) {
    return { ok: false, error: 'Falta la lista de ingredientes faltantes.' };
  }
  if (data.missing.length > MAX_MISSING) {
    return { ok: false, error: 'Hay demasiados ingredientes faltantes para consultar a la IA.' };
  }

  const missing: AiMissingIngredient[] = [];
  for (const item of data.missing) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Un ingrediente faltante no es válido.' };
    }
    const row = item as Record<string, unknown>;
    const name = text(row.name, 120);
    if (!name) {
      return { ok: false, error: 'Cada ingrediente faltante necesita un nombre.' };
    }
    missing.push({ name, amount: text(row.amount, 40), unit: text(row.unit, 40) });
  }

  if (!Array.isArray(data.pantry)) {
    return { ok: false, error: 'Falta la lista de la despensa.' };
  }
  if (data.pantry.length > MAX_PANTRY) {
    return { ok: false, error: 'La despensa tiene demasiados ingredientes para consultar a la IA.' };
  }
  const pantry: string[] = [];
  for (const item of data.pantry) {
    if (typeof item !== 'string') {
      return { ok: false, error: 'La despensa solo puede tener nombres de ingredientes.' };
    }
    const name = item.trim().slice(0, 80);
    if (name) pantry.push(name);
  }

  return { ok: true, value: { recipeTitle, missing, pantry } };
}

export function buildSubstitutionMessages(request: SubstitutionAiRequest): ChatMessage[] {
  const system =
    'Eres CociFlex, un chef de cocina mexicana casera enfocado en cero desperdicio de alimentos. ' +
    'Respondes SOLO con un objeto JSON válido, en español, sin texto antes ni después.';

  const pantryList = request.pantry.length > 0 ? request.pantry.map((item) => `- ${item}`).join('\n') : '- (vacía)';
  const missingList = request.missing
    .map((item) => `- ${item.name}${item.amount ? ` (${item.amount} ${item.unit})`.trimEnd() : ''}`)
    .join('\n');

  const user = `Analiza los ingredientes que le faltan a esta receta y propone sustitutos con lo que la persona ya tiene.

Receta: ${request.recipeTitle}

Ingredientes que faltan:
${missingList}

Despensa de la persona (SOLO puedes recomendar ingredientes de esta lista):
${pantryList}

Reglas:
- Para cada faltante, analiza su función en el platillo: líquido, grasa, aglutinante, leudante, acidez, dulzor, sabor o espesor.
- Recomienda el sustituto más adecuado que aparezca en la despensa y explica en una oración cómo ajustar la cantidad.
- En "amount" escribe solo la cantidad corta, por ejemplo "¼ taza" o "90 g"; no escribas instrucciones ahí.
- Indica el cambio de sabor, textura o consistencia en "note".
- Agrega los alérgenos que aporte el sustituto (por ejemplo "lácteo" o "gluten"); si no tiene, deja la lista vacía.
- Si no hay un sustituto adecuado en la despensa, no lo inventes: simplemente no incluyas ese faltante.
- No propongas yogur, crema ni leche como sustituto del huevo en platillos donde el huevo es el ingrediente principal (por ejemplo huevos a la mexicana o chilaquiles con huevo).
- Máximo 6 sugerencias. No recomiendes ingredientes fuera de la despensa.

Estructura del JSON:
{"suggestions":[{"missing":"","substitute":"","amount":"","note":"","allergens":[]}]}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

const SUBSTITUTION_JSON_SCHEMA: JsonFormat = {
  name: 'sustituciones',
  schema: {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            missing: { type: 'string' },
            substitute: { type: 'string' },
            amount: { type: 'string' },
            note: { type: 'string' },
            allergens: { type: 'array', items: { type: 'string' } },
          },
          required: ['missing', 'substitute', 'amount', 'note'],
        },
      },
    },
    required: ['suggestions'],
  },
};

const listOfText = (value: unknown, max: number): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const clean = item.trim().slice(0, max);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= 5) break;
  }
  return out;
};

/** Deja solo sugerencias que correspondan a un faltante y a un ingrediente de la despensa. */
export function sanitizeSuggestions(raw: unknown, request: SubstitutionAiRequest): AiSubstitutionSuggestion[] {
  const data = (raw ?? {}) as Record<string, unknown>;
  if (!Array.isArray(data.suggestions)) {
    throw new LlmError('bad_response', 'La IA local no devolvió la lista de sustituciones.');
  }

  const suggestions: AiSubstitutionSuggestion[] = [];
  const seen = new Set<string>();

  for (const item of data.suggestions) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const missingName = text(row.missing, 120);
    const substitute = text(row.substitute, 80);
    if (!missingName || !substitute) continue;

    const missing = request.missing.find(
      (candidate) =>
        normalizeText(candidate.name) === normalizeText(missingName) ||
        normalizeText(candidate.name).includes(normalizeText(missingName)) ||
        normalizeText(missingName).includes(normalizeText(candidate.name))
    );
    if (!missing) continue;

    // La regla más importante: solo ingredientes que la persona ya tiene.
    if (!isIngredientMatched(substitute, request.pantry)) continue;

    const key = `${normalizeText(missing.name)}|${normalizeText(substitute)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    suggestions.push({
      missing: missing.name,
      substitute,
      amount: text(row.amount, 100).replace(/^usa\s+/i, '') || 'Al gusto',
      note: text(row.note, 240),
      allergens: listOfText(row.allergens, 30),
    });
    if (suggestions.length >= 6) break;
  }

  return suggestions;
}

/** Pide a la IA local (Ollama o un endpoint compatible) sugerencias para los faltantes. */
export async function requestSubstitutions(
  cfg: LlmConfig,
  request: SubstitutionAiRequest,
  signal?: AbortSignal
): Promise<AiSubstitutionSuggestion[]> {
  if (request.pantry.length === 0) return [];
  const raw = await requestJson(
    cfg,
    buildSubstitutionMessages(request),
    SUBSTITUTION_JSON_SCHEMA,
    signal,
    0.3
  );
  return sanitizeSuggestions(raw, request);
}
