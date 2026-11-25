import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock, ShoppingCart, Sparkles, X } from 'lucide-react';
import type { Recipe } from '../utils/recipeMatcher.ts';
import {
  QUICK_EXPIRY_OPTIONS,
  addDaysToKey,
  buildExpiryReport,
  describeExpiry,
  expiryKey,
  getMissingForShopping,
  getRescueIngredients,
  getRescueRecipes,
  loadExpiryDates,
  saveExpiryDates,
  setExpiryDate,
} from '../utils/pantryExpiry.ts';
import type { ExpiryItem, ExpiryStatus } from '../utils/pantryExpiry.ts';

interface PantryExpiryPanelProps {
  /** Ingredientes marcados en la alacena de Mi Cocina. */
  selectedIngredients: string[];
  /** Catálogo completo de recetas (guardadas + iniciales). */
  recipes: Recipe[];
  shoppingList: string[];
  /** Agrega el artículo a Mandado si no está (y lo quita si ya está: se revisa antes de llamarlo). */
  onToggleShoppingItem: (item: string) => void;
  onOpenRecipeModal: (recipe: Recipe) => void;
  /** Abre "Crear con IA" con estos ingredientes. */
  onCreateWithAi: (ingredients: string[]) => void;
}

const STATUS_STYLES: Record<ExpiryStatus, { badge: string; row: string }> = {
  urgent: {
    badge: 'bg-[#FDE8E8] text-[#B42318] border-[#F9B4B4]',
    row: 'border-[#F9B4B4] bg-[#FFF5F5]',
  },
  soon: {
    badge: 'bg-[#FFF4DB] text-[#9A6200] border-[#FDE2A0]',
    row: 'border-[#FDE2A0] bg-[#FFFBF0]',
  },
  ok: {
    badge: 'bg-[#E8F8F0] text-[#1E7E50] border-[#A7F3D0]',
    row: 'border-[#FED7CD]/80 bg-white',
  },
  none: {
    badge: 'bg-[#F4EFF1] text-[#7D6F76] border-[#E5DADF]',
    row: 'border-[#FED7CD]/80 bg-white',
  },
  expired: {
    badge: 'bg-[#EDE7EA] text-[#5C4A51] border-[#CFC3C9]',
    row: 'border-[#CFC3C9] bg-[#F7F3F5]',
  },
};

export const PantryExpiryPanel: React.FC<PantryExpiryPanelProps> = ({
  selectedIngredients,
  recipes,
  shoppingList,
  onToggleShoppingItem,
  onOpenRecipeModal,
  onCreateWithAi,
}) => {
  const [dates, setDates] = useState(() => loadExpiryDates());
  const [saveFailed, setSaveFailed] = useState(false);
  const [sentRecipeId, setSentRecipeId] = useState<string | null>(null);

  const report = useMemo(
    () => buildExpiryReport(selectedIngredients, dates, new Date()),
    [selectedIngredients, dates]
  );
  const rescueNames = useMemo(() => getRescueIngredients(report), [report]);
  const rescueRecipes = useMemo(() => getRescueRecipes(recipes, report, 3), [recipes, report]);

  // Orden: lo más urgente primero
  const orderedItems: ExpiryItem[] = [
    ...report.expired,
    ...report.urgent,
    ...report.soon,
    ...report.ok,
    ...report.none,
  ];

  const updateDate = (name: string, dateKey: string | null) => {
    const next = setExpiryDate(dates, name, dateKey);
    setDates(next);
    setSaveFailed(!saveExpiryDates(next));
  };

  const sendMissingToShopping = (recipeId: string, missing: string[]) => {
    missing.forEach((name) => onToggleShoppingItem(name));
    setSentRecipeId(recipeId);
  };

  return (
    <section className="bg-white border border-[#FED7CD] rounded-3xl p-5 shadow-xs space-y-4">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#FED7CD]/60">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#FF7262] shrink-0" />
          <h2 className="font-display text-sm font-extrabold text-[#33252A] uppercase tracking-wide">
            Cero desperdicio: ¿qué caduca pronto?
          </h2>
        </div>
        {rescueNames.length > 0 && (
          <span className="text-xs font-bold text-[#B42318] bg-[#FDE8E8] px-2.5 py-0.5 rounded-full border border-[#F9B4B4] tabular-nums shrink-0">
            {rescueNames.length} por salvar
          </span>
        )}
      </div>

      <p className="text-xs text-[#7D6F76] leading-relaxed">
        Anota cuándo caduca lo que tienes y CociFlex te avisa qué cocinar primero. Estas fechas
        las pones tú: revisa siempre la fecha de la etiqueta.
      </p>

      {saveFailed && (
        <p className="text-xs text-[#9A6200] bg-[#FFF4DB] border border-[#FDE2A0] rounded-xl px-3 py-2">
          Este navegador no dejó guardar las fechas. Se ven ahora, pero se perderán al recargar.
        </p>
      )}

      {selectedIngredients.length === 0 ? (
        <p className="text-xs text-[#7D6F76] bg-[#FFF8F6] border border-dashed border-[#FED7CD] rounded-2xl px-4 py-5 text-center">
          Marca ingredientes en tu alacena (abajo) para registrar cuándo caducan.
        </p>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {orderedItems.map((item) => {
            const styles = STATUS_STYLES[item.status];
            return (
              <li
                key={expiryKey(item.name)}
                className={`rounded-2xl border px-3 py-2.5 space-y-2 ${styles.row}`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className={`text-sm font-bold text-[#33252A] break-words min-w-0 ${
                      item.status === 'expired' ? 'line-through decoration-[#A6979D]' : ''
                    }`}
                  >
                    {item.name}
                  </span>
                  <span
                    className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${styles.badge}`}
                  >
                    {describeExpiry(item.daysLeft)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-[#7D6F76]">Caduca en:</span>
                  {QUICK_EXPIRY_OPTIONS.map((option) => {
                    const optionKey = addDaysToKey(new Date(), option.days);
                    const isActive = item.dateKey === optionKey;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => updateDate(item.name, optionKey)}
                        aria-pressed={isActive}
                        className={`cursor-pointer px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                          isActive
                            ? 'bg-[#FF7262] text-white border-[#FF7262]'
                            : 'bg-[#FFF8F6] text-[#5C4A51] border-[#FED7CD] hover:border-[#FF7262]'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                  <input
                    type="date"
                    value={item.dateKey ?? ''}
                    onChange={(e) => updateDate(item.name, e.target.value || null)}
                    aria-label={`Fecha de caducidad de ${item.name}`}
                    className="bg-[#FFF8F6] border border-[#FED7CD] rounded-xl px-2 py-1 text-[11px] text-[#33252A] focus:outline-none focus:border-[#FF7262]"
                  />
                  {item.dateKey && (
                    <button
                      type="button"
                      onClick={() => updateDate(item.name, null)}
                      aria-label={`Quitar fecha de ${item.name}`}
                      title="Quitar fecha"
                      className="cursor-pointer p-1 rounded-full text-[#A6979D] hover:text-[#FF7262] hover:bg-[#FFEAE4]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {item.status === 'expired' && (
                  <p className="flex items-start gap-1.5 text-[11px] text-[#5C4A51] leading-relaxed">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B42318] shrink-0 mt-0.5" />
                    <span>
                      Revísalo antes de usarlo. Si huele o se ve mal, tíralo. No lo usamos para
                      proponer recetas.
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {selectedIngredients.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-[#FED7CD]/60">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#33252A]">
            Platillos para salvarlos
          </h3>

          {rescueNames.length === 0 ? (
            <p className="text-xs text-[#7D6F76]">
              Nada caduca en los próximos 3 días. Pon fechas arriba y aquí aparecerán las recetas
              para aprovecharlos a tiempo.
            </p>
          ) : (
            <>
              {rescueRecipes.length === 0 ? (
                <p className="text-xs text-[#7D6F76]">
                  Ninguna receta del catálogo usa {rescueNames.join(', ')}. Prueba con la IA.
                </p>
              ) : (
                <ul className="space-y-2">
                  {rescueRecipes.map((result) => {
                    const toSend = getMissingForShopping(result.missingIngredients, shoppingList);
                    const justSent = sentRecipeId === result.recipe.id && toSend.length === 0;
                    return (
                      <li
                        key={result.recipe.id}
                        className="rounded-2xl border border-[#FED7CD] bg-[#FFF8F6] p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenRecipeModal(result.recipe)}
                            className="cursor-pointer text-left text-sm font-bold text-[#33252A] hover:text-[#FF7262] break-words min-w-0"
                          >
                            {result.recipe.title}
                          </button>
                          <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 tabular-nums bg-[#FFEFEA] text-[#FF7262] border border-[#FED7CD]">
                            {result.matchPercentage}%
                          </span>
                        </div>

                        <p className="text-[11px] text-[#5C4A51]">
                          Salva:{' '}
                          <span className="font-bold text-[#B42318]">
                            {result.rescued.join(', ')}
                          </span>
                        </p>

                        {result.missingIngredients.length === 0 ? (
                          <p className="text-[11px] font-bold text-[#1E7E50]">
                            Ya tienes todo para prepararla.
                          </p>
                        ) : toSend.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => sendMissingToShopping(result.recipe.id, toSend)}
                            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF7262] text-white text-[11px] font-bold hover:bg-[#FA7268]"
                          >
                            <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                            Mandar a Mandado lo que falta ({toSend.length}): {toSend.join(', ')}
                          </button>
                        ) : (
                          <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#1E7E50]">
                            <Check className="w-3.5 h-3.5" />
                            {justSent
                              ? 'Listo: lo que falta ya está en tu Mandado.'
                              : 'Lo que falta ya está en tu Mandado.'}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <button
                type="button"
                onClick={() => onCreateWithAi(rescueNames)}
                className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-[#FF7262] text-[#FF7262] text-xs font-bold hover:bg-[#FFEAE4]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Crear con IA con lo que está por caducar
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
};
