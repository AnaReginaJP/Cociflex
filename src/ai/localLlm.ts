// Recipe generation with a local model (Ollama or LM Studio) through its OpenAI-compatible API.

export type LlmErrorCode = 'unreachable' | 'timeout' | 'aborted' | 'http' | 'bad_response';

export class LlmError extends Error {
  constructor(
    public code: LlmErrorCode,
    message: string
  ) {
    super(message);
  }
}

export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs: number;
  maxTokens: number;
}

export interface RecipeRequest {
  ingredients: string[];
  timeAvailable: number;
  servings: number;
  preference: string;
  extraNotes?: string;
}

export function getLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig | null {
  const baseUrl = env.LLM_BASE_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) return null;
  return {
    baseUrl,
    model: env.LLM_MODEL?.trim() || 'qwen2.5:7b',
    apiKey: env.LLM_API_KEY?.trim() || undefined,
    timeoutMs: Number(env.LLM_TIMEOUT_MS) || 600000,
    maxTokens: Number(env.LLM_MAX_TOKENS) || 1100,
  };
}

const MEAL_TYPES = ['Desayuno', 'Comida', 'Cena', 'Plato Fuerte', 'Sopa y Caldo', 'Postre'];
const DIFFICULTIES = ['Fácil', 'Media', 'Avanzada'];

const RECIPE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    category: { type: 'string' },
    mealType: { type: 'string', enum: MEAL_TYPES },
    description: { type: 'string' },
    prepTimeMinutes: { type: 'integer' },
    cookTimeMinutes: { type: 'integer' },
    servings: { type: 'integer' },
    difficulty: { type: 'string', enum: DIFFICULTIES },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'string' },
          unit: { type: 'string' },
          essential: { type: 'boolean' },
        },
        required: ['name', 'amount', 'unit', 'essential'],
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stepNumber: { type: 'integer' },
          title: { type: 'string' },
          instruction: { type: 'string' },
          timeMinutes: { type: 'integer' },
          tip: { type: 'string' },
        },
        required: ['stepNumber', 'title', 'instruction'],
      },
    },
    wasteReductionTip: { type: 'string' },
    caloriesApprox: { type: 'integer' },
  },
  required: ['title', 'mealType', 'description', 'ingredients', 'steps', 'wasteReductionTip'],
};

function buildMessages(req: RecipeRequest) {
  const system =
    'Eres CociFlex, un chef de cocina mexicana casera enfocado en cero desperdicio de alimentos. Respondes SOLO con un objeto JSON válido, en español, sin texto antes ni después.';
  const user = `Crea UNA receta que use principalmente estos ingredientes que el usuario tiene en casa:
${req.ingredients.join(', ')}

Tiempo máximo: ${req.timeAvailable} minutos.
Comensales: ${req.servings} personas.
Preferencia culinaria: ${req.preference}.
Notas adicionales: ${req.extraNotes || 'Ninguna'}.

Reglas:
- Adapta las cantidades al número de personas y al tiempo indicado.
- Aprovecha ingredientes viejos o sobrantes (cero desperdicio).
- Cantidades exactas en tazas, gramos o piezas.
- Entre 4 y 6 pasos, de una o dos oraciones cada uno. Usa "tip" solo si es importante; si no, déjalo vacío.
- La descripción es una sola oración.

Estructura del JSON:
{"title":"","category":"","mealType":"Desayuno|Comida|Cena|Plato Fuerte|Sopa y Caldo|Postre","description":"","prepTimeMinutes":0,"cookTimeMinutes":0,"servings":0,"difficulty":"Fácil|Media|Avanzada","ingredients":[{"name":"","amount":"","unit":"","essential":true}],"steps":[{"stepNumber":1,"title":"","instruction":"","timeMinutes":0,"tip":""}],"wasteReductionTip":"","caloriesApprox":0}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new LlmError('bad_response', 'La IA local no devolvió una receta en formato JSON.');
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new LlmError('bad_response', 'La IA local devolvió un JSON incompleto. Intenta de nuevo.');
  }
}

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : fallback;

const posInt = (value: unknown, fallback: number): number => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

function normalizeRecipe(raw: unknown, req: RecipeRequest) {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const title = str(r.title);
  if (!title) throw new LlmError('bad_response', 'La receta generada no tiene título. Intenta de nuevo.');

  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : [])
    .map((item: any) => ({
      name: str(item?.name ?? (typeof item === 'string' ? item : '')),
      amount: str(item?.amount, '1'),
      unit: str(item?.unit),
      essential: typeof item?.essential === 'boolean' ? item.essential : true,
    }))
    .filter((item: { name: string }) => item.name);

  const steps = (Array.isArray(r.steps) ? r.steps : [])
    .map((item: any) => ({
      title: str(item?.title),
      instruction: str(item?.instruction ?? (typeof item === 'string' ? item : '')),
      timeMinutes: item?.timeMinutes ? posInt(item.timeMinutes, 0) || undefined : undefined,
      tip: str(item?.tip) || undefined,
    }))
    .filter((item: { instruction: string }) => item.instruction)
    .map((item: { title: string }, index: number) => ({
      stepNumber: index + 1,
      ...item,
      title: item.title || `Paso ${index + 1}`,
    }));

  if (ingredients.length === 0 || steps.length === 0) {
    throw new LlmError('bad_response', 'La receta generada quedó incompleta. Intenta de nuevo.');
  }

  const meal = str(r.mealType);
  const difficulty = str(r.difficulty);
  return {
    title,
    category: str(r.category, req.preference) || req.preference,
    mealType: MEAL_TYPES.includes(meal) ? meal : 'Comida',
    description: str(r.description),
    prepTimeMinutes: posInt(r.prepTimeMinutes, 10),
    cookTimeMinutes: posInt(r.cookTimeMinutes, 15),
    servings: posInt(r.servings, req.servings),
    difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 'Fácil',
    ingredients,
    steps,
    wasteReductionTip:
      str(r.wasteReductionTip) || 'Aprovecha todos los ingredientes al 100%.',
    ...(posInt(r.caloriesApprox, 0) ? { caloriesApprox: posInt(r.caloriesApprox, 0) } : {}),
  };
}

export type GeneratedRecipe = ReturnType<typeof normalizeRecipe>;

async function chat(cfg: LlmConfig, body: unknown, signal: AbortSignal) {
  return fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
}

export async function generateRecipe(
  cfg: LlmConfig,
  req: RecipeRequest,
  clientSignal?: AbortSignal
): Promise<GeneratedRecipe> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, cfg.timeoutMs);
  const onClientAbort = () => controller.abort();
  clientSignal?.addEventListener('abort', onClientAbort, { once: true });
  if (clientSignal?.aborted) controller.abort();

  const base = {
    model: cfg.model,
    messages: buildMessages(req),
    stream: false,
    temperature: 0.4,
    max_tokens: cfg.maxTokens,
  };

  try {
    let response = await chat(
      cfg,
      {
        ...base,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'receta', schema: RECIPE_JSON_SCHEMA },
        },
      },
      controller.signal
    );
    // Older servers reject json_schema: retry with plain JSON mode.
    if (response.status === 400 || response.status === 422) {
      response = await chat(cfg, { ...base, response_format: { type: 'json_object' } }, controller.signal);
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      throw new LlmError(
        'http',
        response.status === 404
          ? `El modelo "${cfg.model}" no está disponible en la IA local.`
          : `La IA local respondió con error ${response.status}. ${detail}`.trim()
      );
    }
    const data: any = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new LlmError('bad_response', 'La IA local devolvió una respuesta vacía.');
    }
    return normalizeRecipe(extractJson(content), req);
  } catch (error: any) {
    if (error instanceof LlmError) throw error;
    if (timedOut) {
      throw new LlmError('timeout', 'La IA local tardó demasiado en responder. Intenta de nuevo.');
    }
    if (error?.name === 'AbortError' || clientSignal?.aborted) {
      throw new LlmError('aborted', 'Solicitud cancelada.');
    }
    throw new LlmError(
      'unreachable',
      'No se pudo conectar con la IA local. Verifica que tu equipo esté encendido y la VPN activa.'
    );
  } finally {
    clearTimeout(timer);
    clientSignal?.removeEventListener('abort', onClientAbort);
  }
}
