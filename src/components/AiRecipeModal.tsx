import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  Clock, 
  Users, 
  ChefHat, 
  Check, 
  Play, 
  AlertCircle, 
  Lightbulb, 
  Loader2 
} from 'lucide-react';
import { Recipe } from '../utils/recipeMatcher.ts';
import { buildRecipeFromAi } from '../utils/aiRecipe.ts';

interface AiRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: string[];
  initialTime: number;
  initialServings: number;
  initialPreference: string;
  onGeneratedSuccess: (recipe: Recipe) => void;
}

export const AiRecipeModal: React.FC<AiRecipeModalProps> = ({
  isOpen,
  onClose,
  ingredients,
  initialTime,
  initialServings,
  initialPreference,
  onGeneratedSuccess,
}) => {
  const [time, setTime] = useState(initialTime || 25);
  const [servings, setServings] = useState(initialServings || 2);
  const [preference, setPreference] = useState(initialPreference || 'Tradicional Mexicana');
  const [extraNotes, setExtraNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // The session cookie (when signed in) lets the server save this request in the user's history.
      const response = await fetch('/api/generate-recipe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients,
          timeAvailable: time,
          servings,
          preference,
          extraNotes,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Error al conectar con el asistente de IA.');
      }

      if (data.recipe) {
        const fullRecipe: Recipe = buildRecipeFromAi(data.recipe, { preference, servings });

        onGeneratedSuccess(fullRecipe);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Hubo un inconveniente al generar la receta. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#FFF8F6] border border-[#FED7CD] rounded-[32px] shadow-2xl overflow-hidden flex flex-col text-[#33252A]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#FED7CD] bg-[#FFF0EB]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FF7262]" />
            <h3 className="text-xs font-black text-[#33252A] uppercase tracking-wider">
              Generar Receta con IA
            </h3>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer p-1.5 rounded-full bg-[#FFEAE4] text-[#7D6F76] hover:text-[#33252A] hover:bg-[#FED7CD]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleGenerate} className="p-5 sm:p-6 space-y-4 text-xs">
          <p className="text-[#5C4A51] leading-relaxed text-xs">
            Cociflex analizará tus <strong>{ingredients.length} ingredientes seleccionados</strong> y creará una receta casera adaptada a tu tiempo exacto y comensales, priorizando el aprovechamiento y cero desperdicio.
          </p>

          {/* Selected Ingredients Recap */}
          <div className="p-3 rounded-2xl bg-white border border-[#FED7CD]">
            <span className="text-[10px] font-bold text-[#FF7262] uppercase tracking-wider block mb-2">
              Ingredientes base que tienes:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {ingredients.map(ing => (
                <span
                  key={ing}
                  className="px-2 py-0.5 rounded-full bg-[#FFEFEA] text-[#FF7262] border border-[#FED7CD] text-[11px] font-semibold"
                >
                  {ing}
                </span>
              ))}
            </div>
          </div>

          {/* Adjust Time and Servings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#5C4A51] uppercase mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#FF7262]" />
                Tiempo Disponible (minutos)
              </label>
              <input
                type="number"
                min="10"
                max="90"
                value={time}
                onChange={(e) => setTime(Number(e.target.value))}
                className="w-full bg-white border border-[#FED7CD] focus:border-[#FF7262] rounded-2xl p-2.5 text-xs text-[#33252A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5C4A51] uppercase mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#FF7262]" />
                Comensales (personas)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                className="w-full bg-white border border-[#FED7CD] focus:border-[#FF7262] rounded-2xl p-2.5 text-xs text-[#33252A] focus:outline-none"
              />
            </div>
          </div>

          {/* Extra Notes */}
          <div>
            <label className="block text-[11px] font-bold text-[#5C4A51] uppercase mb-1">
              Indicaciones adicionales (opcional)
            </label>
            <input
              type="text"
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              placeholder="Ej. Sin picante para niños, o salsa extra cremosa..."
              className="w-full bg-white border border-[#FED7CD] focus:border-[#FF7262] rounded-2xl p-2.5 text-xs text-[#33252A] placeholder-[#B5A7AC] focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-[#FFF2EE] border border-[#FECDD3] text-[#E11D48] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#E11D48] shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action */}
          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="cursor-pointer px-4 py-2 text-[#7D6F76] hover:text-[#33252A] text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="cursor-pointer px-5 py-2.5 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-[#FF7B72] to-[#FA7268] hover:brightness-105 shadow-md shadow-[#FF7B72]/30 flex items-center gap-2 active:scale-95 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creando receta (la IA local puede tardar varios minutos)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Crear Receta Cero Desperdicio</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
