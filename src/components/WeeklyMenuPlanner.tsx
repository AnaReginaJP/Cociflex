import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, Clock, RefreshCw, ShoppingCart, Users, Wallet, AlertCircle, ChefHat } from 'lucide-react';
import type { Recipe } from '../utils/recipeMatcher.ts';
import {
  budgetUsage,
  buildWeeklyPlan,
  displayAmount,
  namesForMandado,
  rebuildWeeklyPlan,
  replaceDay,
  validatePlannerInput,
} from '../utils/weeklyPlanner.ts';
import type { Diet, PlannerInput, WeeklyPlan } from '../utils/weeklyPlanner.ts';
import { PRICES_INFO } from '../data/ingredientPrices.ts';

const STORAGE_KEY = 'cociflex_weekly_menu_v1';

interface WeeklyMenuPlannerProps {
  /** Catalog plus the recipes the person created with AI. */
  recipes: Recipe[];
  shoppingList: string[];
  onToggleShoppingItem: (item: string) => void;
  onOpenRecipeModal: (recipe: Recipe) => void;
  /** Diet chosen in the profile ("Omnívoro", "Vegetariano" or "Vegano"). */
  defaultDiet?: string;
}

interface SavedMenu {
  input: PlannerInput;
  recipeIds: string[];
}

const money = (value: number): string => `$${Math.round(value).toLocaleString('es-MX')}`;

function dietFromProfile(value?: string): Diet {
  return value === 'Vegetariano' || value === 'Vegano' ? value : 'Todas';
}

function readSavedMenu(): SavedMenu | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const checked = validatePlannerInput(data?.input ?? {});
    if (!checked.ok || !Array.isArray(data?.recipeIds)) return null;
    return { input: checked.input, recipeIds: data.recipeIds.filter((id: unknown) => typeof id === 'string') };
  } catch {
    return null;
  }
}

function writeSavedMenu(plan: WeeklyPlan | null) {
  try {
    if (!plan || plan.days.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const data: SavedMenu = { input: plan.input, recipeIds: plan.days.map((d) => d.recipeId) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Saving is optional: the menu still works without it.
  }
}

export const WeeklyMenuPlanner: React.FC<WeeklyMenuPlannerProps> = ({
  recipes,
  shoppingList,
  onToggleShoppingItem,
  onOpenRecipeModal,
  defaultDiet,
}) => {
  const [personas, setPersonas] = useState('2');
  const [presupuesto, setPresupuesto] = useState('800');
  const [minutos, setMinutos] = useState('45');
  const [dieta, setDieta] = useState<Diet>(dietFromProfile(defaultDiet));
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Bring back the last menu this browser saved.
  useEffect(() => {
    const saved = readSavedMenu();
    if (!saved) return;
    const restored = rebuildWeeklyPlan(recipes, saved.input, saved.recipeIds);
    if (!restored) return;
    setPlan(restored);
    setPersonas(String(saved.input.personas));
    setPresupuesto(String(saved.input.presupuesto));
    setMinutos(String(saved.input.minutosPorDia));
    setDieta(saved.input.dieta);
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usage = useMemo(() => (plan ? budgetUsage(plan) : null), [plan]);

  const updatePlan = (next: WeeklyPlan | null) => {
    setPlan(next);
    writeSavedMenu(next);
  };

  const handleBuild = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    const checked = validatePlannerInput({ personas, presupuesto, minutosPorDia: minutos, dieta });
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors([]);
    updatePlan(buildWeeklyPlan(recipes, checked.input));
  };

  const handleChangeDay = (index: number) => {
    if (!plan) return;
    const result = replaceDay(recipes, plan, index);
    if (!result.changed) {
      setNotice(result.message ?? 'No se pudo cambiar este día.');
      return;
    }
    setNotice(`Cambié el ${plan.days[index].day}. Los demás días siguen igual.`);
    updatePlan(result.plan);
  };

  const handleSendToMandado = () => {
    if (!plan) return;
    const names = namesForMandado(plan, shoppingList);
    if (names.length === 0) {
      setNotice('Todos los ingredientes del menú ya estaban en tu lista de Mandado.');
      return;
    }
    names.forEach((name) => onToggleShoppingItem(name));
    setNotice(
      `Agregué ${names.length} ${names.length === 1 ? 'ingrediente' : 'ingredientes'} a tu lista de Mandado. Los que ya tenías no se tocaron.`
    );
  };

  const handleOpenRecipe = (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (recipe) onOpenRecipeModal(recipe);
  };

  const inputClass =
    'w-full bg-[#FFF8F6] border border-[#FED7CD] focus:border-[#FF7262] rounded-2xl px-3 py-2 text-xs md:text-sm text-[#33252A] focus:outline-none';
  const labelClass = 'flex items-center gap-1 text-[11px] font-bold text-[#5C4A51] uppercase mb-1';

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#FED7CD] rounded-3xl p-4 md:p-5 shadow-xs space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFEFEA] border border-[#FED7CD] flex items-center justify-center text-[#FF7262] shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#FF7262] uppercase tracking-wider block">
              Planificador semanal
            </span>
            <h2 className="font-display text-lg md:text-xl font-extrabold text-[#33252A]">
              Tu menú de 7 días con presupuesto
            </h2>
            <p className="text-xs md:text-sm text-[#6E5E65] mt-0.5 leading-relaxed">
              Una comida principal por día. Reutiliza ingredientes entre platillos para gastar menos y te arma la lista
              de compras de toda la semana.
            </p>
          </div>
        </div>

        <form onSubmit={handleBuild} className="space-y-3" noValidate>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="menu-personas" className={labelClass}>
                <Users className="w-3.5 h-3.5 text-[#FF7262]" />
                Personas
              </label>
              <input
                id="menu-personas"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={personas}
                onChange={(e) => setPersonas(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="menu-presupuesto" className={labelClass}>
                <Wallet className="w-3.5 h-3.5 text-[#FF7262]" />
                Presupuesto semanal ($)
              </label>
              <input
                id="menu-presupuesto"
                type="number"
                inputMode="decimal"
                min={50}
                value={presupuesto}
                onChange={(e) => setPresupuesto(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="menu-minutos" className={labelClass}>
                <Clock className="w-3.5 h-3.5 text-[#FF7262]" />
                Minutos por día
              </label>
              <input
                id="menu-minutos"
                type="number"
                inputMode="numeric"
                min={10}
                max={240}
                value={minutos}
                onChange={(e) => setMinutos(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="menu-dieta" className={labelClass}>
                <ChefHat className="w-3.5 h-3.5 text-[#FF7262]" />
                Preferencia
              </label>
              <select
                id="menu-dieta"
                value={dieta}
                onChange={(e) => setDieta(e.target.value as Diet)}
                className={inputClass}
              >
                <option value="Todas">Como de todo</option>
                <option value="Vegetariano">Vegetariano</option>
                <option value="Vegano">Vegano</option>
              </select>
            </div>
          </div>

          {errors.length > 0 && (
            <div role="alert" className="bg-[#FFF2EE] border border-[#FED7CD] rounded-2xl p-3 text-xs text-[#9A3B2E] space-y-1">
              {errors.map((message) => (
                <p key={message} className="flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{message}</span>
                </p>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="cursor-pointer w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-[#FF7262] hover:bg-[#FA7268] text-white text-xs md:text-sm font-bold transition-colors"
          >
            {plan ? 'Armar el menú de nuevo' : 'Armar mi menú'}
          </button>
        </form>
      </div>

      {notice && (
        <div role="status" className="bg-[#EAF8F2] border border-[#C2EED9] rounded-2xl px-4 py-2.5 text-xs text-[#264E36]">
          {notice}
        </div>
      )}

      {plan && plan.warnings.length > 0 && (
        <div className="bg-[#FFF8E6] border border-[#F6DFA4] rounded-2xl p-3.5 text-xs text-[#6B4E00] space-y-1.5">
          {plan.warnings.map((message) => (
            <p key={message} className="flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{message}</span>
            </p>
          ))}
        </div>
      )}

      {plan && plan.days.length > 0 && usage && (
        <>
          <div className="bg-white border border-[#FED7CD] rounded-3xl p-4 shadow-xs space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-extrabold text-[#33252A]">
                Costo estimado: {money(plan.totalCost)}{' '}
                <span className="font-medium text-[#6E5E65]">de {money(plan.input.presupuesto)}</span>
              </p>
              <p className={`text-xs font-bold ${usage.over ? 'text-[#C0392B]' : 'text-[#10B981]'}`}>
                {usage.over ? `Te pasas ${money(plan.totalCost - plan.input.presupuesto)}` : `Te sobran ${money(plan.input.presupuesto - plan.totalCost)}`}
              </p>
            </div>
            <div
              className="h-2.5 w-full rounded-full bg-[#FFEFEA] overflow-hidden"
              role="progressbar"
              aria-label="Parte del presupuesto que usa el menú"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(usage.percent, 100)}
            >
              <div
                className={`h-full rounded-full ${usage.over ? 'bg-[#E5534B]' : 'bg-[#34D399]'}`}
                style={{ width: `${Math.min(usage.percent, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-[#7D6F76] leading-relaxed">
              Costo estimado con precios aproximados de {PRICES_INFO.fecha}
              {PRICES_INFO.revisados ? '' : ' (todavía por revisar)'}. Es lo que usas de cada ingrediente para{' '}
              {plan.input.personas} {plan.input.personas === 1 ? 'persona' : 'personas'}; en el súper revisa el precio
              real.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plan.days.map((day, index) => (
              <div key={day.day} className="bg-white border border-[#FED7CD] rounded-3xl p-4 shadow-xs flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-[#FF7262] uppercase tracking-wider">{day.day}</span>
                  <span className="text-[11px] font-semibold text-[#7D6F76] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {day.minutes} min · {money(day.cost)}
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-[#33252A] leading-snug">{day.title}</h3>

                <details className="group text-xs text-[#5C4A51]">
                  <summary className="cursor-pointer list-none flex items-center gap-1 font-bold text-[#FF7262]">
                    <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                    Ingredientes para {plan.input.personas} {plan.input.personas === 1 ? 'persona' : 'personas'}
                  </summary>
                  <ul className="mt-2 space-y-0.5">
                    {day.ingredients.map((ingredient) => (
                      <li key={ingredient.name}>
                        {ingredient.amount == null ? '' : `${displayAmount(ingredient.amount, ingredient.unit)} `}
                        {ingredient.unit ? `${ingredient.unit} ` : ''}
                        {ingredient.amount == null ? `${ingredient.name} (al gusto)` : `de ${ingredient.name}`}
                      </li>
                    ))}
                  </ul>
                </details>

                <div className="flex flex-wrap gap-2 pt-1 mt-auto">
                  <button
                    type="button"
                    onClick={() => handleChangeDay(index)}
                    className="cursor-pointer px-3 py-1.5 rounded-2xl bg-[#FFEFEA] border border-[#FED7CD] text-[11px] font-bold text-[#FF7262] hover:border-[#FF8A80] flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Cambiar este día
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenRecipe(day.recipeId)}
                    className="cursor-pointer px-3 py-1.5 rounded-2xl bg-white border border-[#FED7CD] text-[11px] font-bold text-[#5C4A51] hover:border-[#FF8A80]"
                  >
                    Ver receta
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-[#FED7CD] rounded-3xl p-4 md:p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-[#33252A] flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#FF7262]" />
                Lista de compras de la semana ({plan.shopping.length})
              </h3>
              <button
                type="button"
                onClick={handleSendToMandado}
                className="cursor-pointer px-3.5 py-2 rounded-2xl bg-[#FF7262] hover:bg-[#FA7268] text-white text-xs font-bold transition-colors"
              >
                Mandar a Mandado
              </button>
            </div>
            <ul className="divide-y divide-[#FFE4DC]">
              {plan.shopping.map((line) => (
                <li key={line.name} className="py-2 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-[#33252A]">{line.name}</p>
                    <p className="text-[#7D6F76]">
                      {line.quantity}
                      {line.days.length > 1 ? ` · se usa ${line.days.length} días` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-[#5C4A51]">
                    {line.cost == null ? 'sin precio' : money(line.cost)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-[#7D6F76]">
              A Mandado solo se mandan los nombres de los ingredientes, sin repetir los que ya tienes en la lista.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
