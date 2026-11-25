import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Sparkles, Wand2, X } from 'lucide-react';
import type { RecipeIngredient } from '../utils/recipeMatcher.ts';
import type { SubstitutionSuggestion } from '../utils/ingredientSubstitution.ts';

interface SubstitutionHintProps {
  suggestion: SubstitutionSuggestion;
  compact?: boolean;
}

/** Aviso "puedes sustituir X por Y" que se usa en Mi Cocina y en el detalle de receta. */
export const SubstitutionHint: React.FC<SubstitutionHintProps> = ({ suggestion, compact = false }) => {
  const amount =
    suggestion.amount && suggestion.unit
      ? `${suggestion.amount} ${suggestion.unit}`
      : suggestion.amount;

  return (
    <span
      className={`block rounded-xl border border-[#BFE8D5] bg-[#F1FBF6] ${compact ? 'p-2' : 'p-2.5'} space-y-1`}
      onClick={(event: React.MouseEvent) => event.stopPropagation()}
    >
      <span className="flex items-start gap-1.5 text-[11px] leading-snug text-[#33252A]">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#1E7E50]" />
        <span>
          <span className="font-bold text-[#1E7E50]">Puedes sustituir</span> {suggestion.missing} por{' '}
          <span className="font-extrabold">{suggestion.substitute}</span>
        </span>
      </span>

      {amount && (
        <span className="block text-[10px] font-semibold text-[#3F6B57]">Usa {amount}</span>
      )}

      <span className="block text-[10px] leading-snug text-[#6E5E65]">{suggestion.explanation}</span>

      {suggestion.note && (
        <span className="block text-[10px] leading-snug text-[#6E5E65]">{suggestion.note}</span>
      )}

      {suggestion.allergens.length > 0 && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-[#B45309]">
          <AlertTriangle className="h-3 w-3" />
          Contiene: {suggestion.allergens.join(', ')}
        </span>
      )}

      {suggestion.caution && (
        <span className="block text-[10px] italic leading-snug text-[#8C7E85]">{suggestion.caution}</span>
      )}
    </span>
  );
};

interface AiSuggestion {
  missing: string;
  substitute: string;
  amount: string;
  note: string;
  allergens: string[];
}

interface SubstitutionAiPanelProps {
  recipeTitle: string;
  missing: RecipeIngredient[];
  pantry: string[];
}

/**
 * Apoyo opcional con la IA local: solo aparece para faltantes que la base no cubre.
 * El servidor vuelve a validar que el sustituto exista en la despensa antes de responder.
 */
export const SubstitutionAiPanel: React.FC<SubstitutionAiPanelProps> = ({
  recipeTitle,
  missing,
  pantry,
}) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [message, setMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (missing.length === 0) return null;

  const ask = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setMessage('');
    try {
      const response = await fetch('/api/ai/sustitutos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeTitle,
          missing: missing.map((ingredient) => ({
            name: ingredient.name,
            amount: ingredient.amount,
            unit: ingredient.unit,
          })),
          pantry,
        }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.error) {
        throw new Error(data?.error || 'No se pudo consultar la IA.');
      }
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      setStatus('done');
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      setMessage(error?.message || 'No se pudo consultar la IA.');
      setStatus('error');
    }
  };

  return (
    <span className="block pt-1">
      {status === 'idle' && (
        <button
          type="button"
          onClick={ask}
          className="cursor-pointer inline-flex items-center gap-1 rounded-full border border-[#D9C7CE] bg-white px-2.5 py-1 text-[10px] font-bold text-[#7A2E3A] hover:border-[#FF7262] transition-colors"
          title="La IA solo puede proponer ingredientes de tu despensa"
        >
          <Wand2 className="h-3 w-3" />
          Buscar más opciones con IA
        </button>
      )}

      {status === 'loading' && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#7A6B72]">
          <Loader2 className="h-3 w-3 animate-spin" />
          Consultando la IA…
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="cursor-pointer ml-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-[#B03A48] hover:underline"
          >
            <X className="h-3 w-3" /> Cancelar
          </button>
        </span>
      )}

      {status === 'done' && suggestions.length === 0 && (
        <span className="block text-[10px] leading-snug text-[#7A6B72]">
          La IA no encontró un sustituto con lo que tienes. El ingrediente sigue en tu lista.
        </span>
      )}

      {status === 'done' && suggestions.length > 0 && (
        <span className="block space-y-1.5">
          {suggestions.map((suggestion) => (
            <span
              key={`${suggestion.missing}-${suggestion.substitute}`}
              className="block rounded-xl border border-[#E4D5DB] bg-white p-2 space-y-0.5"
            >
              <span className="block text-[11px] leading-snug text-[#33252A]">
                <span className="font-bold text-[#7A2E3A]">La IA propone</span> {suggestion.substitute} en lugar de{' '}
                {suggestion.missing}
              </span>
              {suggestion.amount && (
                <span className="block text-[10px] font-semibold text-[#3F6B57]">
                  Cantidad: {suggestion.amount}
                </span>
              )}
              {suggestion.note && (
                <span className="block text-[10px] leading-snug text-[#6E5E65]">{suggestion.note}</span>
              )}
              {suggestion.allergens.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#B45309]">
                  <AlertTriangle className="h-3 w-3" /> Contiene: {suggestion.allergens.join(', ')}
                </span>
              )}
            </span>
          ))}
        </span>
      )}

      {status === 'error' && (
        <span className="block space-y-1">
          <span className="block text-[10px] leading-snug text-[#9A3B45]">{message}</span>
          <button
            type="button"
            onClick={ask}
            className="cursor-pointer text-[10px] font-bold text-[#7A2E3A] hover:underline"
          >
            Intentar de nuevo
          </button>
        </span>
      )}
    </span>
  );
};
