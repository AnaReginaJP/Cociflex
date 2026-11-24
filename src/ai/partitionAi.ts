// Local AI step of "Receta a tu medida": the rules engine already reduced the ingredients;
// the local model rewrites the steps so their amounts, times and pans match the smaller batch.
import { LlmError, requestJson, type ChatMessage, type LlmConfig } from './localLlm.ts';

export interface PartitionStepsRequest {
  title: string;
  /** Share of the original recipe being made, 1–99. */
  percent: number;
  servingsLabel: string;
  originalServings: number;
  limitingIngredient: string;
  /** Ingredients already reduced by the rules engine. */
  ingredients: { name: string; amount: string; unit: string; omitted: boolean }[];
  /** Steps of the original recipe. */
  steps: { title: string; instruction: string; timeMinutes?: number; tip?: string }[];
}

export interface AdaptedStep {
  stepNumber: number;
  title: string;
  instruction: string;
  timeMinutes?: number;
  tip?: string;
}

export interface AdaptedSteps {
  steps: AdaptedStep[];
  note: string;
}

const MAX_STEPS = 20;
const MAX_INGREDIENTS = 40;

const text = (value: unknown, max: number): string =>
  (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '').trim().slice(0, max);

const minutes = (value: unknown): number | undefined => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 && n <= 600 ? n : undefined;
};

/** Validates the request body sent by the browser. */
export function parsePartitionStepsRequest(
  body: any
): { ok: true; value: PartitionStepsRequest } | { ok: false; error: string } {
  const title = text(body?.title, 120);
  const percent = Math.round(Number(body?.percent));
  const rawIngredients = Array.isArray(body?.ingredients) ? body.ingredients : [];
  const rawSteps = Array.isArray(body?.steps) ? body.steps : [];

  if (!title) return { ok: false, error: 'Falta el nombre de la receta.' };
  if (!Number.isFinite(percent) || percent < 1 || percent > 99) {
    return { ok: false, error: 'La proporción de la receta debe estar entre 1 y 99 %.' };
  }
  if (rawIngredients.length === 0 || rawIngredients.length > MAX_INGREDIENTS) {
    return { ok: false, error: 'La lista de ingredientes no es válida.' };
  }
  if (rawSteps.length === 0 || rawSteps.length > MAX_STEPS) {
    return { ok: false, error: 'La lista de pasos no es válida.' };
  }

  const ingredients = rawIngredients
    .map((i: any) => ({
      name: text(i?.name, 80),
      amount: text(i?.amount, 20),
      unit: text(i?.unit, 40),
      omitted: i?.omitted === true,
    }))
    .filter((i: { name: string }) => i.name);
  const steps = rawSteps
    .map((s: any) => ({
      title: text(s?.title, 120),
      instruction: text(s?.instruction, 800),
      timeMinutes: minutes(s?.timeMinutes),
      tip: text(s?.tip, 300) || undefined,
    }))
    .filter((s: { instruction: string }) => s.instruction);
  if (ingredients.length === 0 || steps.length === 0) {
    return { ok: false, error: 'La receta no tiene ingredientes o pasos.' };
  }

  return {
    ok: true,
    value: {
      title,
      percent,
      servingsLabel: text(body?.servingsLabel, 30),
      originalServings: Math.max(1, Math.round(Number(body?.originalServings)) || 1),
      limitingIngredient: text(body?.limitingIngredient, 80),
      ingredients,
      steps,
    },
  };
}

const ADAPTED_STEPS_SCHEMA = {
  type: 'object',
  properties: {
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
    note: { type: 'string' },
  },
  required: ['steps', 'note'],
};

export function buildPartitionMessages(req: PartitionStepsRequest): ChatMessage[] {
  const used = req.ingredients
    .filter((i) => !i.omitted)
    .map((i) => `- ${i.amount} ${i.unit ? `${i.unit} de ` : ''}${i.name}`.replace(/\s+/g, ' '));
  const omitted = req.ingredients.filter((i) => i.omitted).map((i) => i.name);
  const steps = req.steps.map((s, i) => {
    const time = s.timeMinutes ? ` (${s.timeMinutes} min)` : '';
    const tip = s.tip ? `\n   Consejo: ${s.tip}` : '';
    return `${i + 1}. ${s.title || `Paso ${i + 1}`}${time}: ${s.instruction}${tip}`;
  });

  const system =
    'Eres CociFlex, un chef de cocina mexicana casera. Adaptas recetas para prepararlas en menor cantidad. Respondes SOLO con un objeto JSON válido, en español, sin texto antes ni después.';
  const user = `Receta: ${req.title}
La persona solo puede preparar el ${req.percent} % de la receta${req.limitingIngredient ? ` porque no le alcanza ${req.limitingIngredient}` : ''}.
Ahora rinde ${req.servingsLabel || `${req.percent} % de las porciones`} (la receta original rinde ${req.originalServings}).

Ingredientes de la versión reducida (ya están calculados, no los cambies):
${used.join('\n')}${omitted.length ? `\nNo usará: ${omitted.join(', ')} (es opcional).` : ''}

Pasos de la receta original:
${steps.join('\n')}

Reescribe los pasos para la versión reducida:
- Cambia toda cantidad que aparezca en los pasos para que coincida con los ingredientes de arriba.
- Cambia un tiempo solo si de verdad cambia con menos cantidad (por ejemplo, hervir menos agua tarda menos). El tiempo por pieza (voltear un hotcake, dorar una tortilla) y la temperatura no cambian.
- Si conviene, sugiere una olla, sartén o molde más pequeño.
- No agregues ingredientes nuevos ni quites pasos importantes. Usa el mismo número de pasos.
- Cada instrucción tiene una o dos oraciones. Usa "tip" solo si es útil; si no, déjalo vacío.
- En "note" escribe en una oración el ajuste más importante.

Estructura del JSON:
{"steps":[{"stepNumber":1,"title":"","instruction":"","timeMinutes":0,"tip":""}],"note":""}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** Keeps only well-formed steps from the model's answer. */
export function normalizeAdaptedSteps(raw: unknown, req: PartitionStepsRequest): AdaptedSteps {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const steps = (Array.isArray(r.steps) ? r.steps : [])
    .map((s: any, i: number) => ({
      title: text(s?.title, 120) || req.steps[i]?.title || `Paso ${i + 1}`,
      instruction: text(s?.instruction ?? (typeof s === 'string' ? s : ''), 800),
      timeMinutes: minutes(s?.timeMinutes),
      tip: text(s?.tip, 300) || undefined,
    }))
    .filter((s: { instruction: string }) => s.instruction)
    .slice(0, req.steps.length + 2)
    .map((s: Omit<AdaptedStep, 'stepNumber'>, i: number) => ({ stepNumber: i + 1, ...s }));

  if (steps.length === 0) {
    throw new LlmError('bad_response', 'La IA local no devolvió los pasos ajustados. Intenta de nuevo.');
  }
  return { steps, note: text(r.note, 300) };
}

export async function adaptStepsWithLocalAi(
  cfg: LlmConfig,
  req: PartitionStepsRequest,
  clientSignal?: AbortSignal
): Promise<AdaptedSteps> {
  const raw = await requestJson(
    cfg,
    buildPartitionMessages(req),
    { name: 'pasos_ajustados', schema: ADAPTED_STEPS_SCHEMA },
    clientSignal,
    0.3
  );
  return normalizeAdaptedSteps(raw, req);
}
