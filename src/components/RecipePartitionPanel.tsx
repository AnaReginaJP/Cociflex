import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Lightbulb,
  Loader2,
  Plus,
  Scale,
  ShoppingCart,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { Recipe, RecipeStep } from '../utils/recipeMatcher.ts';
import {
  compatibleUnits,
  isMeasurable,
  partitionRecipe,
  type PartitionPlan,
} from '../utils/recipePartition.ts';

export interface AiAdaptedSteps {
  steps: RecipeStep[];
  note: string;
  model: string;
}

interface RecipePartitionPanelProps {
  recipe: Recipe;
  onPlanChange: (plan: PartitionPlan | null) => void;
  aiSteps: AiAdaptedSteps | null;
  onAiSteps: (steps: AiAdaptedSteps | null) => void;
  shoppingList: string[];
  onToggleShoppingItem: (item: string) => void;
}

interface LimitRow {
  id: number;
  index: number;
  amount: string;
  unit: string;
}

type AiStatus = { state: 'idle' } | { state: 'loading'; startedAt: number } | { state: 'error'; message: string };

const formatElapsed = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** "Receta a tu medida": the user says what they're short of and the recipe shrinks to fit. */
export const RecipePartitionPanel: React.FC<RecipePartitionPanelProps> = ({
  recipe,
  onPlanChange,
  aiSteps,
  onAiSteps,
  shoppingList,
  onToggleShoppingItem,
}) => {
  const measurable = useMemo(
    () => recipe.ingredients.map((ing, index) => ({ ing, index })).filter(({ ing }) => isMeasurable(ing)),
    [recipe]
  );
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<LimitRow[]>([]);
  const [aiStatus, setAiStatus] = useState<AiStatus>({ state: 'idle' });
  const [elapsed, setElapsed] = useState(0);
  const nextId = useRef(1);
  const aiRequest = useRef<AbortController | null>(null);

  const newRow = (index: number): LimitRow => ({
    id: nextId.current++,
    index,
    amount: '',
    unit: compatibleUnits(recipe.ingredients[index].unit)[0]?.value ?? '',
  });

  const filled = rows.filter((r) => r.amount.trim() !== '');
  // Recalculate only when what the user typed changes, not on every render.
  const filledKey = JSON.stringify(filled);
  const outcome = useMemo(
    () => (filled.length > 0 ? partitionRecipe(recipe, filled) : null),
    [recipe, filledKey]
  );
  const plan = outcome?.ok ? outcome.plan : null;

  // Every new calculation replaces the previous one and cancels a pending AI request.
  useEffect(() => {
    aiRequest.current?.abort();
    setAiStatus({ state: 'idle' });
    onPlanChange(plan);
    onAiSteps(null);
  }, [outcome]);

  useEffect(() => () => aiRequest.current?.abort(), []);

  useEffect(() => {
    if (aiStatus.state !== 'loading') return;
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - aiStatus.startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [aiStatus]);

  if (measurable.length === 0) return null;

  const open = () => {
    setIsOpen(true);
    if (rows.length === 0) setRows([newRow(measurable[0].index)]);
  };

  const reset = () => {
    setRows([]);
    setIsOpen(false);
  };

  const updateRow = (id: number, patch: Partial<LimitRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const usedIndexes = rows.map((r) => r.index);
  const freeIngredients = measurable.filter(({ index }) => !usedIndexes.includes(index));

  const askLocalAi = async () => {
    if (!plan) return;
    const controller = new AbortController();
    aiRequest.current = controller;
    setElapsed(0);
    setAiStatus({ state: 'loading', startedAt: Date.now() });
    try {
      const response = await fetch('/api/recipes/partition-steps', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          title: recipe.title,
          percent: plan.percent,
          servingsLabel: plan.servingsLabel,
          originalServings: recipe.servings,
          limitingIngredient: plan.limitingIngredient,
          ingredients: plan.ingredients.map(({ name, amount, unit, omitted }) => ({ name, amount, unit, omitted })),
          steps: recipe.steps.map(({ title, instruction, timeMinutes, tip }) => ({ title, instruction, timeMinutes, tip })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error || !Array.isArray(data.steps)) {
        throw new Error(data.error || 'No se pudo ajustar la receta con la IA local.');
      }
      onAiSteps({ steps: data.steps, note: data.note || '', model: data.model || 'IA local' });
      setAiStatus({ state: 'idle' });
    } catch (error: any) {
      if (controller.signal.aborted) return;
      setAiStatus({ state: 'error', message: error?.message || 'No se pudo conectar con la IA local.' });
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
        onClick={open}
        className="cursor-pointer w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-dashed border-[#FF8A80] hover:bg-[#FFF0EB] text-left transition-colors"
      >
        <div className="w-9 h-9 rounded-2xl bg-[#FFEFEA] border border-[#FED7CD] flex items-center justify-center shrink-0">
          <Scale className="w-4 h-4 text-[#FF7262]" />
        </div>
        <div>
          <span className="block text-xs font-black text-[#33252A]">¿No te alcanza algún ingrediente?</span>
          <span className="block text-[11px] text-[#7D6F76]">
            Calcula la receta con lo que sí tienes: todo se reduce en la misma proporción.
          </span>
        </div>
      </button>
    );
  }

  return (
    <section className="bg-white border border-[#FED7CD] rounded-2xl p-3.5 space-y-3" aria-label="Receta a tu medida">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-[#FF7262] shrink-0" />
          <div>
            <h3 className="text-xs font-black text-[#33252A] uppercase tracking-wider">Receta a tu medida</h3>
            <p className="text-[11px] text-[#7D6F76] leading-relaxed">
              Elige el ingrediente que no te alcanza y escribe cuánto tienes.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-[11px] font-semibold text-[#7D6F76] hover:text-[#FF7262]"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Receta original
        </button>
      </div>

      {/* What the user has */}
      <div className="space-y-2">
        {rows.map((row) => {
          const ing = recipe.ingredients[row.index];
          const units = compatibleUnits(ing.unit);
          const options = measurable.filter(({ index }) => index === row.index || !usedIndexes.includes(index));
          return (
            <div key={row.id} className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Ingrediente que no te alcanza"
                value={row.index}
                onChange={(e) => {
                  const index = Number(e.target.value);
                  updateRow(row.id, { index, amount: '', unit: compatibleUnits(recipe.ingredients[index].unit)[0]?.value ?? '' });
                }}
                className="flex-1 min-w-[11rem] px-2.5 py-2 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-xs text-[#33252A] focus:outline-none focus:border-[#FF7262]"
              >
                {options.map(({ ing: option, index }) => (
                  <option key={index} value={index}>
                    {option.name} (receta: {option.amount} {option.unit})
                  </option>
                ))}
              </select>
              <input
                aria-label={`Cuánto tienes de ${ing.name}`}
                inputMode="decimal"
                placeholder="Tengo…"
                value={row.amount}
                onChange={(e) => updateRow(row.id, { amount: e.target.value.slice(0, 12) })}
                className="w-20 px-2.5 py-2 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-xs text-[#33252A] focus:outline-none focus:border-[#FF7262]"
              />
              <select
                aria-label={`Unidad de ${ing.name}`}
                value={row.unit}
                onChange={(e) => updateRow(row.id, { unit: e.target.value })}
                className="w-32 px-2 py-2 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-xs text-[#33252A] focus:outline-none focus:border-[#FF7262]"
              >
                {units.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                  className="cursor-pointer p-2 rounded-xl text-[#A6979D] hover:text-[#FF7262] hover:bg-[#FFEFEA]"
                  title="Quitar"
                  aria-label={`Quitar ${ing.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {freeIngredients.length > 0 && (
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, newRow(freeIngredients[0].index)])}
            className="cursor-pointer flex items-center gap-1 text-[11px] font-bold text-[#FF7262] hover:text-[#FA7268]"
          >
            <Plus className="w-3.5 h-3.5" />
            Otro ingrediente que no alcanza
          </button>
        )}
      </div>

      {/* Result */}
      {outcome && !outcome.ok && (
        <p className="flex items-start gap-1.5 text-[11px] text-[#B42318] bg-[#FEF3F2] border border-[#FECDCA] rounded-xl p-2.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {outcome.error}
        </p>
      )}

      {plan && plan.isFullRecipe && (
        <p className="flex items-start gap-1.5 text-[11px] text-[#1E7E50] bg-[#E8F8F0] border border-[#A7F3D0] rounded-xl p-2.5">
          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Te alcanza para la receta completa. {plan.tips.join(' ')}
        </p>
      )}

      {plan && !plan.isFullRecipe && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#FFF0EB] border border-[#FED7CD]">
            <span className="text-2xl font-black text-[#FF7262] tabular-nums">{plan.percent}%</span>
            <p className="text-xs text-[#5C4A51] leading-relaxed">
              Te alcanza para el <strong>{plan.percent} %</strong> de la receta: rinde{' '}
              <strong>{plan.servingsLabel}</strong> (la original rinde {recipe.servings}). Lo que limita es{' '}
              <strong>{plan.limitingIngredient}</strong>.
            </p>
          </div>

          {plan.tips.map((tip) => (
            <p key={tip} className="flex items-start gap-1.5 text-[11px] text-[#7A5A10] bg-[#FFF8E6] border border-[#FBE3A8] rounded-xl p-2.5">
              <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {tip}
            </p>
          ))}

          {plan.missingForFullRecipe.length > 0 && (
            <div className="text-[11px] text-[#7D6F76]">
              <span className="font-semibold">¿Prefieres hacerla completa? Te falta:</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {plan.missingForFullRecipe.map((m) => {
                  const inList = shoppingList.includes(m.name);
                  return (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => onToggleShoppingItem(m.name)}
                      className={`cursor-pointer flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
                        inList
                          ? 'bg-[#FF7262] border-[#FF7262] text-white'
                          : 'bg-white border-[#FED7CD] text-[#5C4A51] hover:border-[#FF7262]'
                      }`}
                      title={inList ? 'Ya está en tu lista de mandado' : 'Agregar a la lista de mandado'}
                    >
                      <ShoppingCart className="w-3 h-3" />
                      {m.amount} {m.unit} de {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Local AI: rewrite the steps for the smaller batch */}
          <div className="pt-2 border-t border-[#FED7CD]">
            {aiStatus.state === 'loading' ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5C4A51]" role="status">
                <Loader2 className="w-4 h-4 animate-spin text-[#FF7262]" />
                <span>
                  La IA local está ajustando los pasos… <span className="tabular-nums">{formatElapsed(elapsed)}</span>
                </span>
                <button
                  type="button"
                  onClick={cancelAi}
                  className="cursor-pointer ml-auto px-2.5 py-1 rounded-xl border border-[#FED7CD] text-[#7D6F76] hover:text-[#33252A]"
                >
                  Cancelar
                </button>
              </div>
            ) : aiSteps ? (
              <p className="flex items-start gap-1.5 text-[11px] text-[#1E7E50]">
                <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Pasos ajustados por la IA local ({aiSteps.model}).
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={askLocalAi}
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black text-white bg-gradient-to-r from-[#FF7B72] to-[#FA7268] hover:brightness-105 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ajustar pasos con IA local
                </button>
                <span className="text-[11px] text-[#8C7E85] flex-1 min-w-[12rem]">
                  Reescribe los pasos con las nuevas cantidades y tiempos. Puede tardar unos minutos.
                </span>
              </div>
            )}
            {aiStatus.state === 'error' && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-[#B42318]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {aiStatus.message} Los pasos de abajo ya están ajustados por reglas.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
