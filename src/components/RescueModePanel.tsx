import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, LifeBuoy, Lightbulb, Loader2, Plus, Sparkles, Undo2 } from 'lucide-react';
import type { Recipe } from '../utils/recipeMatcher.ts';
import { normalizeText } from '../utils/recipeMatcher.ts';
import {
  MAX_RESCUE_DESCRIPTION,
  RESCUE_PROBLEMS,
  buildRescueAdvice,
  checkRescueInput,
  type RescueAdvice,
  type RescueProblemId,
} from '../utils/cookingRescue.ts';

interface RescueModePanelProps {
  recipe: Recipe;
  /** Ingredients the person marked in Mi Cocina. */
  pantryIngredients: string[];
}

interface AiRescueStep {
  instruction: string;
  uses: string[];
}

interface AiRescue {
  diagnosis: string;
  steps: AiRescueStep[];
  warnings: string[];
  blocked: boolean;
  model: string;
}

interface Chip {
  name: string;
  on: boolean;
}

/** What the person asked for when they pressed "Rescatar"; the AI request uses the same data. */
interface Submitted {
  problem: RescueProblemId;
  description: string;
  available: string[];
  stepIndex: number | null;
}

type AiStatus = { state: 'idle' } | { state: 'loading'; startedAt: number } | { state: 'error'; message: string };

const MAX_CHIPS = 60;
const MAX_AVAILABLE_SENT = 40;

const formatElapsed = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** "Modo Salvavidas": something went wrong while cooking; fixes by rules now, the local AI if you want. */
export const RescueModePanel: React.FC<RescueModePanelProps> = ({ recipe, pantryIngredients }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [problem, setProblem] = useState<RescueProblemId | null>(null);
  const [description, setDescription] = useState('');
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [chips, setChips] = useState<Chip[]>(() => pantryIngredients.map((name) => ({ name, on: true })));
  const [extra, setExtra] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<RescueAdvice | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus>({ state: 'idle' });
  const [aiResult, setAiResult] = useState<AiRescue | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const aiRequest = useRef<AbortController | null>(null);

  useEffect(() => () => aiRequest.current?.abort(), []);

  useEffect(() => {
    if (aiStatus.state !== 'loading') return;
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - aiStatus.startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [aiStatus]);

  // Any change to what the person told us clears the previous result and cancels a pending AI request.
  const invalidate = () => {
    aiRequest.current?.abort();
    setAiStatus({ state: 'idle' });
    setAiResult(null);
    setAdvice(null);
    setSubmitted(null);
    setError(null);
  };

  const chooseProblem = (id: RescueProblemId) => {
    invalidate();
    setProblem((current) => (current === id ? null : id));
  };

  const toggleChip = (name: string) => {
    invalidate();
    setChips((prev) => prev.map((c) => (c.name === name ? { ...c, on: !c.on } : c)));
  };

  const addExtra = () => {
    const name = extra.trim();
    if (!name) return;
    invalidate();
    setChips((prev) => {
      const existing = prev.find((c) => normalizeText(c.name) === normalizeText(name));
      if (existing) return prev.map((c) => (c === existing ? { ...c, on: true } : c));
      if (prev.length >= MAX_CHIPS) return prev;
      return [...prev, { name, on: true }];
    });
    setExtra('');
  };

  const close = () => {
    invalidate();
    setIsOpen(false);
  };

  const rescue = () => {
    const checked = checkRescueInput(problem, description);
    if (!checked.ok) {
      invalidate();
      setError(checked.error);
      return;
    }
    invalidate();
    const available = chips.filter((c) => c.on).map((c) => c.name);
    setSubmitted({ problem: checked.problem, description: checked.description, available, stepIndex });
    setAdvice(
      buildRescueAdvice({
        problem: checked.problem,
        text: checked.description,
        available,
        recipeIngredients: recipe.ingredients.map((i) => i.name),
      })
    );
  };

  const askLocalAi = async () => {
    if (!submitted) return;
    const controller = new AbortController();
    aiRequest.current = controller;
    setElapsed(0);
    setAiStatus({ state: 'loading', startedAt: Date.now() });
    const step = submitted.stepIndex !== null ? recipe.steps[submitted.stepIndex] : undefined;
    try {
      const response = await fetch('/api/ai/salvavidas', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          title: recipe.title,
          problem: submitted.problem,
          description: submitted.description,
          currentStep: step
            ? { stepNumber: submitted.stepIndex! + 1, title: step.title, instruction: step.instruction }
            : undefined,
          available: submitted.available.slice(0, MAX_AVAILABLE_SENT),
          ingredients: recipe.ingredients
            .slice(0, 40)
            .map(({ name, amount, unit }) => ({ name, amount, unit })),
          steps: recipe.steps.slice(0, 20).map(({ title, instruction }) => ({ title, instruction })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error || !Array.isArray(data.steps)) {
        throw new Error(data.error || 'No se pudo consultar a la IA local.');
      }
      setAiResult({
        diagnosis: data.diagnosis || '',
        steps: data.steps,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
        blocked: data.blocked === true,
        model: data.model || 'IA local',
      });
      setAiStatus({ state: 'idle' });
    } catch (e: any) {
      if (controller.signal.aborted) return;
      setAiStatus({ state: 'error', message: e?.message || 'No se pudo conectar con la IA local.' });
    }
  };

  const cancelAi = () => {
    aiRequest.current?.abort();
    setAiStatus({ state: 'idle' });
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="cursor-pointer w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-dashed border-[#FF8A80] hover:bg-[#FFF0EB] text-left transition-colors"
      >
        <div className="w-9 h-9 rounded-2xl bg-[#FFEFEA] border border-[#FED7CD] flex items-center justify-center shrink-0">
          <LifeBuoy className="w-4 h-4 text-[#FF7262]" />
        </div>
        <div>
          <span className="block text-xs font-black text-[#33252A]">Modo Salvavidas</span>
          <span className="block text-[11px] text-[#7D6F76]">
            ¿Algo salió mal al cocinar? Cuéntanos qué pasó y rescatamos el platillo.
          </span>
        </div>
      </button>
    );
  }

  const aiIsBlocked = aiResult?.blocked === true;

  return (
    <section className="bg-white border border-[#FED7CD] rounded-2xl p-3.5 space-y-3" aria-label="Modo Salvavidas">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <LifeBuoy className="w-4 h-4 text-[#FF7262] shrink-0" />
          <div>
            <h3 className="text-xs font-black text-[#33252A] uppercase tracking-wider">Modo Salvavidas</h3>
            <p className="text-[11px] text-[#7D6F76] leading-relaxed">
              Para corregir el sabor o la textura de comida que está en buen estado.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="cursor-pointer shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-[11px] font-semibold text-[#7D6F76] hover:text-[#FF7262]"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Cerrar
        </button>
      </div>

      {/* What happened */}
      <div>
        <p className="text-[11px] font-bold text-[#33252A] mb-1.5">¿Qué pasó?</p>
        <div className="flex flex-wrap gap-1.5">
          {RESCUE_PROBLEMS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={problem === p.id}
              onClick={() => chooseProblem(p.id)}
              className={`cursor-pointer px-2.5 py-1.5 rounded-full border text-[11px] font-semibold transition-colors ${
                problem === p.id
                  ? 'bg-[#FF7262] border-[#FF7262] text-white'
                  : 'bg-white border-[#FED7CD] text-[#5C4A51] hover:border-[#FF7262]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="rescue-description" className="block text-[11px] font-bold text-[#33252A] mb-1.5">
          Cuéntanos más <span className="font-normal text-[#8C7E85]">(opcional, salvo en "Otro")</span>
        </label>
        <textarea
          id="rescue-description"
          value={description}
          maxLength={MAX_RESCUE_DESCRIPTION}
          rows={2}
          onChange={(e) => {
            invalidate();
            setDescription(e.target.value);
          }}
          placeholder="Por ejemplo: le eché dos cucharadas de sal en lugar de una."
          className="w-full px-2.5 py-2 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-xs text-[#33252A] focus:outline-none focus:border-[#FF7262] resize-none"
        />
        <p className="text-right text-[10px] text-[#A6979D] tabular-nums">
          {description.length}/{MAX_RESCUE_DESCRIPTION}
        </p>
      </div>

      <div>
        <label htmlFor="rescue-step" className="block text-[11px] font-bold text-[#33252A] mb-1.5">
          ¿En qué paso vas?
        </label>
        <select
          id="rescue-step"
          value={stepIndex === null ? '' : String(stepIndex)}
          onChange={(e) => {
            invalidate();
            setStepIndex(e.target.value === '' ? null : Number(e.target.value));
          }}
          className="w-full px-2.5 py-2 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-xs text-[#33252A] focus:outline-none focus:border-[#FF7262]"
        >
          <option value="">No sé / prefiero no decirlo</option>
          {recipe.steps.map((s, i) => (
            <option key={i} value={i}>
              Paso {i + 1}: {s.title || s.instruction.slice(0, 40)}
            </option>
          ))}
        </select>
      </div>

      {/* What the person has at hand */}
      <div>
        <p className="text-[11px] font-bold text-[#33252A] mb-1.5">¿Qué tienes a la mano?</p>
        {chips.length === 0 && (
          <p className="text-[11px] text-[#8C7E85] mb-1.5">
            Nada marcado todavía: escribe abajo lo que tengas. Si no tienes nada, te damos arreglos solo con agua.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.name}
              type="button"
              aria-pressed={c.on}
              onClick={() => toggleChip(c.name)}
              className={`cursor-pointer flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
                c.on
                  ? 'bg-[#E8F8F0] border-[#A7F3D0] text-[#1E7E50]'
                  : 'bg-white border-[#E5DADE] text-[#A6979D] line-through'
              }`}
            >
              {c.on && <Check className="w-3 h-3" />}
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input
            aria-label="Otro ingrediente que tienes a la mano"
            value={extra}
            maxLength={60}
            onChange={(e) => setExtra(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addExtra();
              }
            }}
            placeholder="Otro ingrediente…"
            className="flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-xs text-[#33252A] focus:outline-none focus:border-[#FF7262]"
          />
          <button
            type="button"
            onClick={addExtra}
            disabled={!extra.trim()}
            className="cursor-pointer flex items-center gap-1 px-2.5 py-2 rounded-xl border border-[#FED7CD] text-[11px] font-bold text-[#FF7262] hover:bg-[#FFF0EB] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={rescue}
        className="cursor-pointer w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-[#FF7B72] to-[#FA7268] hover:brightness-105 shadow-sm"
      >
        <LifeBuoy className="w-4 h-4" />
        Rescatar mi platillo
      </button>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-1.5 text-[11px] text-[#B42318] bg-[#FEF3F2] border border-[#FECDCA] rounded-xl p-2.5"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      {/* Result by rules: instant, works without AI */}
      {advice && (
        <div className="space-y-2.5 pt-2 border-t border-[#FED7CD]">
          {advice.safety && (
            <p
              role="alert"
              className={`flex items-start gap-1.5 text-xs rounded-xl p-3 border ${
                advice.safety.level === 'discard'
                  ? 'text-[#B42318] bg-[#FEF3F2] border-[#FECDCA]'
                  : 'text-[#7A5A10] bg-[#FFF8E6] border-[#FBE3A8]'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>{advice.safety.level === 'discard' ? 'No se rescata. ' : 'Sigue cocinando. '}</strong>
                {advice.safety.message}
              </span>
            </p>
          )}

          {advice.fixes.length > 0 && (
            <div>
              <h4 className="text-[11px] font-black text-[#33252A] uppercase tracking-wider mb-2">
                Qué puedes hacer ahora ({advice.problem.label})
              </h4>
              <ol className="space-y-2">
                {advice.fixes.map((fix, i) => (
                  <li key={fix.title} className="flex gap-2.5 p-3 rounded-2xl bg-[#FFF8F6] border border-[#FED7CD]">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-[#FF7262] text-white text-[11px] font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-[#33252A]">{fix.title}</p>
                      <p className="text-[11px] text-[#5C4A51] leading-relaxed">{fix.instruction}</p>
                      {fix.have.length > 0 && (
                        <p className="text-[11px] font-semibold text-[#1E7E50]">Con lo que tienes: {fix.have.join(', ')}</p>
                      )}
                      {fix.needs.length > 0 && fix.have.length === 0 && (
                        <p className="text-[11px] text-[#8C7E85]">Necesitas: {fix.needs.join(' o ')}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[11px] text-[#8C7E85]">Prueba poco a poco: haz un ajuste, mezcla y vuelve a probar.</p>
            </div>
          )}

          {advice.warnings.length > 0 &&
            advice.warnings.map((w) => (
              <p
                key={w}
                className="flex items-start gap-1.5 text-[11px] text-[#7A5A10] bg-[#FFF8E6] border border-[#FBE3A8] rounded-xl p-2.5"
              >
                <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {w}
              </p>
            ))}

          {/* Local AI: optional, only when there is something to rescue */}
          {!advice.safety && (
            <div className="pt-2 border-t border-[#FED7CD]">
              {aiStatus.state === 'loading' ? (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5C4A51]" role="status">
                  <Loader2 className="w-4 h-4 animate-spin text-[#FF7262]" />
                  <span>
                    La IA local está pensando cómo rescatarlo… <span className="tabular-nums">{formatElapsed(elapsed)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={cancelAi}
                    className="cursor-pointer ml-auto px-2.5 py-1 rounded-xl border border-[#FED7CD] text-[#7D6F76] hover:text-[#33252A]"
                  >
                    Cancelar
                  </button>
                </div>
              ) : aiResult ? (
                <div className="space-y-2">
                  {aiIsBlocked ? (
                    <p
                      role="alert"
                      className="flex items-start gap-1.5 text-xs rounded-xl p-3 border text-[#B42318] bg-[#FEF3F2] border-[#FECDCA]"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      {aiResult.diagnosis}
                    </p>
                  ) : (
                    <>
                      <h4 className="flex items-center gap-1.5 text-[11px] font-black text-[#33252A] uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5 text-[#FF7262]" />
                        Sugerencia de la IA local
                      </h4>
                      {aiResult.diagnosis && (
                        <p className="text-[11px] text-[#5C4A51] leading-relaxed">{aiResult.diagnosis}</p>
                      )}
                      <ol className="space-y-1.5">
                        {aiResult.steps.map((s, i) => (
                          <li key={i} className="flex gap-2 text-[11px] text-[#33252A] leading-relaxed">
                            <span className="font-black text-[#FF7262] shrink-0">{i + 1}.</span>
                            <span>
                              {s.instruction}
                              {s.uses.length > 0 && <span className="text-[#1E7E50] font-semibold"> (usa: {s.uses.join(', ')})</span>}
                            </span>
                          </li>
                        ))}
                      </ol>
                      {aiResult.warnings.map((w) => (
                        <p key={w} className="flex items-start gap-1.5 text-[11px] text-[#7A5A10]">
                          <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          {w}
                        </p>
                      ))}
                      <p className="text-[10px] text-[#A6979D]">Respuesta de {aiResult.model}. Revísala antes de usarla.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={askLocalAi}
                    className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black text-white bg-gradient-to-r from-[#FF7B72] to-[#FA7268] hover:brightness-105 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Pedir ayuda a la IA local
                  </button>
                  <span className="text-[11px] text-[#8C7E85] flex-1 min-w-[12rem]">
                    Analiza esta receta y lo que tienes a la mano. Puede tardar unos minutos.
                  </span>
                </div>
              )}
              {aiStatus.state === 'error' && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-[#B42318]">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {aiStatus.message} Los arreglos de arriba siguen siendo válidos.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
