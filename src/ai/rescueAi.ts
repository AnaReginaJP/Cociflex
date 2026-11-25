// Local AI step of "Modo Salvavidas": the person says what went wrong while cooking and what
// they have at hand; the local model suggests a short rescue plan. The rules in
// src/utils/cookingRescue.ts always work without it, and its food-safety rules run first.
import { LlmError, requestJson, type ChatMessage, type LlmConfig } from './localLlm.ts';
import {
  MAX_RESCUE_DESCRIPTION,
  assessSafety,
  isIngredientKnown,
  isRescueProblemId,
  rescueProblemLabel,
  type RescueProblemId,
} from '../utils/cookingRescue.ts';
import { normalizeText } from '../utils/recipeMatcher.ts';

export interface RescueRequest {
  title: string;
  problem: RescueProblemId;
  problemLabel: string;
  description: string;
  /** Step the person is on, if they said. */
  currentStep?: { stepNumber: number; title: string; instruction: string };
  /** Ingredients the person has at hand. */
  available: string[];
  ingredients: { name: string; amount: string; unit: string }[];
  steps: { title: string; instruction: string }[];
}

export interface RescueAiStep {
  instruction: string;
  /** Ingredients this step uses, as the model named them. */
  uses: string[];
}

export interface RescueAnswer {
  diagnosis: string;
  steps: RescueAiStep[];
  warnings: string[];
  /** True when the food-safety rules answered and the model was not asked. */
  blocked?: boolean;
}

const MAX_STEPS = 20;
const MAX_INGREDIENTS = 40;
const MAX_AVAILABLE = 40;
const MAX_ANSWER_STEPS = 5;
const MAX_WARNINGS = 3;

const text = (value: unknown, max: number): string =>
  (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '').trim().slice(0, max);

/** Validates the request body sent by the browser. */
export function parseRescueRequest(
  body: any
): { ok: true; value: RescueRequest } | { ok: false; error: string } {
  const title = text(body?.title, 120);
  const rawIngredients = Array.isArray(body?.ingredients) ? body.ingredients : [];
  const rawSteps = Array.isArray(body?.steps) ? body.steps : [];
  const rawAvailable = Array.isArray(body?.available) ? body.available : [];

  if (!title) return { ok: false, error: 'Falta el nombre de la receta.' };
  if (!isRescueProblemId(body?.problem)) return { ok: false, error: 'Elige qué salió mal con el platillo.' };
  const problem: RescueProblemId = body.problem;

  const rawDescription = typeof body?.description === 'string' ? body.description.trim() : '';
  if (rawDescription.length > MAX_RESCUE_DESCRIPTION) {
    return { ok: false, error: `La descripción es muy larga (máximo ${MAX_RESCUE_DESCRIPTION} caracteres).` };
  }
  if (problem === 'otro' && !rawDescription) {
    return { ok: false, error: 'Cuenta qué pasó para poder ayudarte.' };
  }
  if (rawIngredients.length === 0 || rawIngredients.length > MAX_INGREDIENTS) {
    return { ok: false, error: 'La lista de ingredientes no es válida.' };
  }
  if (rawSteps.length === 0 || rawSteps.length > MAX_STEPS) {
    return { ok: false, error: 'La lista de pasos no es válida.' };
  }

  const ingredients = rawIngredients
    .map((i: any) => ({ name: text(i?.name, 80), amount: text(i?.amount, 20), unit: text(i?.unit, 40) }))
    .filter((i: { name: string }) => i.name);
  const steps = rawSteps
    .map((s: any) => ({ title: text(s?.title, 120), instruction: text(s?.instruction, 800) }))
    .filter((s: { instruction: string }) => s.instruction);
  if (ingredients.length === 0 || steps.length === 0) {
    return { ok: false, error: 'La receta no tiene ingredientes o pasos.' };
  }

  const available = [...new Set(rawAvailable.map((a: unknown) => text(a, 60)).filter(Boolean))].slice(
    0,
    MAX_AVAILABLE
  ) as string[];

  const stepNumber = Math.round(Number(body?.currentStep?.stepNumber));
  const instruction = text(body?.currentStep?.instruction, 800);
  const currentStep =
    Number.isFinite(stepNumber) && stepNumber >= 1 && instruction
      ? { stepNumber, title: text(body.currentStep.title, 120), instruction }
      : undefined;

  return {
    ok: true,
    value: {
      title,
      problem,
      problemLabel: rescueProblemLabel(problem),
      description: rawDescription,
      currentStep,
      available,
      ingredients,
      steps,
    },
  };
}

/**
 * Food-safety rules run before the model. If they answer (spoiled, burned black, raw meat),
 * this is the final answer and the model is never asked.
 */
export function blockedRescueAnswer(req: RescueRequest): RescueAnswer | null {
  const verdict = assessSafety({
    problem: req.problem,
    text: req.description,
    recipeIngredients: req.ingredients.map((i) => i.name),
  });
  if (!verdict) return null;
  return { diagnosis: verdict.message, steps: [], warnings: [], blocked: true };
}

const RESCUE_SCHEMA = {
  type: 'object',
  properties: {
    diagnosis: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          instruction: { type: 'string' },
          uses: { type: 'array', items: { type: 'string' } },
        },
        required: ['instruction', 'uses'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['diagnosis', 'steps', 'warnings'],
};

export function buildRescueMessages(req: RescueRequest): ChatMessage[] {
  const ingredients = req.ingredients.map((i) =>
    `- ${i.amount} ${i.unit ? `${i.unit} de ` : ''}${i.name}`.replace(/\s+/g, ' ')
  );
  const steps = req.steps.map((s, i) => `${i + 1}. ${s.title || `Paso ${i + 1}`}: ${s.instruction}`);
  const where = req.currentStep
    ? `Va en el paso ${req.currentStep.stepNumber}${req.currentStep.title ? ` (${req.currentStep.title})` : ''}: ${req.currentStep.instruction}`
    : 'No dijo en qué paso va.';
  const told = req.description ? `Lo que cuenta la persona: "${req.description}"` : 'No dio más detalles.';
  const atHand = req.available.length ? req.available.join(', ') : 'ninguno (solo agua)';

  const system =
    'Eres CociFlex, un chef de cocina mexicana casera. Ayudas a rescatar un platillo al que le salió mal el sabor o la textura mientras cocina. Respondes SOLO con un objeto JSON válido, en español, sin texto antes ni después.';
  const user = `Receta: ${req.title}

Ingredientes de la receta:
${ingredients.join('\n')}

Pasos de la receta:
${steps.join('\n')}

Lo que salió mal: ${req.problemLabel}
${where}
${told}
Ingredientes que tiene a la mano: ${atHand}

Da un plan de rescate:
- "diagnosis": una o dos oraciones que expliquen qué pasó y por qué.
- "steps": de 3 a 5 pasos inmediatos y prácticos, en orden, de una o dos oraciones cada uno. Cantidades pequeñas y probar después de cada ajuste.
- Usa SOLO los ingredientes que tiene a la mano, los de la receta y agua. No inventes ingredientes ni propongas comprar nada.
- En "uses" de cada paso escribe los ingredientes que usa, con el mismo nombre de esas listas, o [] si no usa ninguno.
- Esto es solo para el sabor y la textura de comida en buen estado. Nunca propongas comer comida con moho, que huele mal o que estuvo horas fuera del refri, ni carne, pollo, pescado o huevo crudos, ni partes quemadas. En esos casos di que no se rescata o que siga cocinando.
- "warnings": de 0 a 3 avisos cortos.

Estructura del JSON:
{"diagnosis":"","steps":[{"instruction":"","uses":[""]}],"warnings":[""]}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** Advice that would put someone at risk, whatever the model was asked. */
const UNSAFE_ADVICE: RegExp[] = [
  /\bmoho\w*/,
  /\bpodrid\w*/,
  /echad[oa]s?\s+a\s+perder/,
  /raspa\w*\s+(el\s+)?(fondo|lo\s+quemado)/,
  /\b(come|comer|comerlo|sirve|servirlo)\b.*\b(crud[oa]s?|quemad[oa]s?)\b/,
];

const isUnsafeAdvice = (value: string): boolean => {
  const t = normalizeText(value);
  return UNSAFE_ADVICE.some((p) => p.test(t));
};

/**
 * Keeps only what can be used: steps that name ingredients the person does not have,
 * and steps or warnings with unsafe advice, are dropped.
 */
export function normalizeRescueAnswer(raw: unknown, req: RescueRequest): RescueAnswer {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const known = [...req.available, ...req.ingredients.map((i) => i.name)];

  const steps: RescueAiStep[] = (Array.isArray(r.steps) ? r.steps : [])
    .map((s: any) => ({
      instruction: text(s?.instruction ?? (typeof s === 'string' ? s : ''), 600),
      uses: (Array.isArray(s?.uses) ? s.uses : []).map((u: unknown) => text(u, 80)).filter(Boolean) as string[],
    }))
    .filter((s: RescueAiStep) => s.instruction)
    .filter((s: RescueAiStep) => !isUnsafeAdvice(s.instruction))
    .filter((s: RescueAiStep) => s.uses.every((name) => isIngredientKnown(name, known)))
    .slice(0, MAX_ANSWER_STEPS);

  if (steps.length === 0) {
    throw new LlmError(
      'bad_response',
      'La IA local no dio una respuesta que se pueda usar con tus ingredientes. Intenta de nuevo.'
    );
  }

  const warnings = (Array.isArray(r.warnings) ? r.warnings : [])
    .map((w: unknown) => text(w, 200))
    .filter((w: string) => w && !isUnsafeAdvice(w))
    .slice(0, MAX_WARNINGS) as string[];

  return { diagnosis: text(r.diagnosis, 400), steps, warnings };
}

export async function rescueWithLocalAi(
  cfg: LlmConfig,
  req: RescueRequest,
  clientSignal?: AbortSignal
): Promise<RescueAnswer> {
  const raw = await requestJson(
    cfg,
    buildRescueMessages(req),
    { name: 'plan_de_rescate', schema: RESCUE_SCHEMA },
    clientSignal,
    0.3
  );
  return normalizeRescueAnswer(raw, req);
}
