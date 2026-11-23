import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Clock, 
  Users, 
  ChefHat, 
  Check, 
  Sparkles, 
  Play, 
  Pause, 
  RotateCcw, 
  ShoppingCart,
  Lightbulb,
  CheckCircle2
} from 'lucide-react';
import { Recipe, scaleIngredientAmount } from '../utils/recipeMatcher.ts';

interface RecipeModalProps {
  recipe: Recipe | null;
  onClose: () => void;
  shoppingList: string[];
  onToggleShoppingItem: (item: string) => void;
}

export const RecipeModal: React.FC<RecipeModalProps> = ({
  recipe,
  onClose,
  shoppingList,
  onToggleShoppingItem,
}) => {
  const [currentServings, setCurrentServings] = useState<number>(recipe?.servings ?? 2);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [checkedIngredients, setCheckedIngredients] = useState<string[]>([]);

  // Kitchen Timer state
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (recipe) {
      setCurrentServings(recipe.servings);
      setCompletedSteps([]);
      setCheckedIngredients([]);
      setIsTimerRunning(false);
      setTimerSeconds(0);
    }
  }, [recipe]);

  // Timer tick
  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsTimerRunning(false);
            playBeep();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timerSeconds]);

  // Safe Web Audio chime beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch {
      // Audio context might be restricted before gesture
    }
  };

  const startTimer = (minutes: number) => {
    setTimerSeconds(minutes * 60);
    setIsTimerRunning(true);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps(prev =>
      prev.includes(stepNumber) ? prev.filter(s => s !== stepNumber) : [...prev, stepNumber]
    );
  };

  const toggleIngredientCheck = (name: string) => {
    setCheckedIngredients(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    );
  };

  if (!recipe) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#FFF8F6] border border-[#FED7CD] rounded-[32px] shadow-2xl overflow-hidden my-4 max-h-[92vh] flex flex-col text-[#33252A]">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#FED7CD] bg-[#FFF0EB] sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FFEAE4] text-[#FF7262] border border-[#FED7CD]">
              {recipe.mealType}
            </span>
            <span className="text-[#A6979D]">•</span>
            <span className="text-xs text-[#7D6F76] font-medium">Modo Cocina Paso a Paso</span>
          </div>

          <button
            onClick={onClose}
            className="cursor-pointer p-1.5 rounded-full bg-[#FFEAE4] hover:bg-[#FED7CD] text-[#7D6F76] hover:text-[#33252A] transition-colors"
            aria-label="Cerrar receta"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1">
          {/* Header Title & Details */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#33252A] tracking-tight mb-1.5">
              {recipe.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#7D6F76] leading-relaxed mb-3">
              {recipe.description}
            </p>

            {/* Badges / Metrics */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#5C4A51] bg-white p-3 rounded-2xl border border-[#FED7CD]">
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4 text-[#FF7262]" />
                <span>
                  Prep: {recipe.prepTimeMinutes}m | Cocción: {recipe.cookTimeMinutes}m
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FF7262]" />
                <span className="font-semibold">Porciones:</span>
                <div className="flex items-center gap-1.5 bg-[#FFF8F6] px-2 py-0.5 rounded-xl border border-[#FED7CD]">
                  <button
                    onClick={() => setCurrentServings(prev => Math.max(1, prev - 1))}
                    className="cursor-pointer text-[#FF7262] hover:text-[#FA7268] font-black px-1"
                    title="Menos porciones"
                  >
                    -
                  </button>
                  <span className="font-bold text-[#33252A] min-w-[1.2rem] text-center">
                    {currentServings}
                  </span>
                  <button
                    onClick={() => setCurrentServings(prev => prev + 1)}
                    className="cursor-pointer text-[#FF7262] hover:text-[#FA7268] font-black px-1"
                    title="Más porciones"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 ml-auto text-[#FF7262] font-semibold text-xs">
                <ChefHat className="w-4 h-4 text-[#FF7262]" />
                <span>Por: {recipe.author}</span>
              </div>
            </div>
          </div>

          {/* Zero Waste Tip Callout */}
          <div className="bg-[#E8F8F0] border border-[#A7F3D0] rounded-2xl p-3.5 flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black text-[#1E7E50] uppercase tracking-wider mb-0.5">
                Aprovechamiento Cero Desperdicio Cociflex
              </h4>
              <p className="text-xs text-[#264E36] leading-relaxed">
                {recipe.wasteReductionTip}
              </p>
            </div>
          </div>

          {/* Cooking Interactive Timer widget */}
          <div className="bg-white border border-[#FED7CD] rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFEFEA] border border-[#FED7CD] flex items-center justify-center text-[#FF7262] font-mono font-bold text-lg">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#FF7262] uppercase tracking-wider block">
                  Temporizador Integrado
                </span>
                <span className="text-xl font-mono font-bold text-[#33252A] tracking-widest">
                  {formatTimer(timerSeconds)}
                </span>
              </div>
            </div>

            {/* Timer quick preset buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => startTimer(5)}
                className="cursor-pointer px-2.5 py-1 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-xs text-[#5C4A51] hover:text-[#FF7262] hover:border-[#FF8A80]"
              >
                +5m
              </button>
              <button
                onClick={() => startTimer(10)}
                className="cursor-pointer px-2.5 py-1 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-xs text-[#5C4A51] hover:text-[#FF7262] hover:border-[#FF8A80]"
              >
                +10m
              </button>
              <button
                onClick={() => startTimer(15)}
                className="cursor-pointer px-2.5 py-1 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-xs text-[#5C4A51] hover:text-[#FF7262] hover:border-[#FF8A80]"
              >
                +15m
              </button>

              {timerSeconds > 0 && (
                <>
                  <button
                    onClick={() => setIsTimerRunning(prev => !prev)}
                    className="cursor-pointer p-2 rounded-xl bg-[#FF7262] hover:bg-[#FA7268] text-white transition-colors"
                    title={isTimerRunning ? 'Pausar' : 'Reanudar'}
                  >
                    {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      setIsTimerRunning(false);
                      setTimerSeconds(0);
                    }}
                    className="cursor-pointer p-2 rounded-xl bg-[#FFEAE4] hover:bg-[#FED7CD] text-[#7D6F76] transition-colors"
                    title="Restablecer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Ingredients list with checkboxes & scaled amounts */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-black text-[#33252A] uppercase tracking-wider flex items-center gap-1.5">
                <ChefHat className="w-4 h-4 text-[#FF7262]" />
                Ingredientes necesarios (calculados para {currentServings} porciones):
              </h3>
              <span className="text-[11px] text-[#8C7E85]">
                {checkedIngredients.length}/{recipe.ingredients.length} listos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recipe.ingredients.map(ing => {
                const scaledAmount = scaleIngredientAmount(ing.amount, recipe.servings, currentServings);
                const isChecked = checkedIngredients.includes(ing.name);
                const inShopping = shoppingList.includes(ing.name);

                return (
                  <div
                    key={ing.name}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                      isChecked
                        ? 'bg-[#E8F8F0] border-[#A7F3D0] text-[#7D6F76]'
                        : 'bg-white border-[#FED7CD] text-[#33252A]'
                    }`}
                  >
                    <button
                      onClick={() => toggleIngredientCheck(ing.name)}
                      className="cursor-pointer flex items-center gap-2 text-left flex-1"
                    >
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                          isChecked
                            ? 'bg-[#10B981] border-[#10B981] text-white'
                            : 'border-[#FED7CD] hover:border-[#FF7262]'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className={`text-xs ${isChecked ? 'line-through text-[#8C7E85]' : 'font-medium'}`}>
                        {ing.name}
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#FF7262]">
                        {scaledAmount} {ing.unit}
                      </span>
                      <button
                        onClick={() => onToggleShoppingItem(ing.name)}
                        className={`p-1 rounded-lg text-xs transition-colors ${
                          inShopping
                            ? 'bg-[#FF7262] text-white'
                            : 'text-[#A6979D] hover:text-[#FF7262]'
                        }`}
                        title={inShopping ? 'En lista de mandado' : 'Añadir a lista de mandado'}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Procedure Steps */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-black text-[#33252A] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#FF7262]" />
                Procedimiento Paso a Paso:
              </h3>
              <span className="text-[11px] text-[#8C7E85]">
                {completedSteps.length}/{recipe.steps.length} completados
              </span>
            </div>

            <div className="space-y-2.5">
              {recipe.steps.map(step => {
                const isStepDone = completedSteps.includes(step.stepNumber);

                return (
                  <div
                    key={step.stepNumber}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isStepDone
                        ? 'bg-[#E8F8F0] border-[#A7F3D0] opacity-80'
                        : 'bg-white border-[#FED7CD] hover:border-[#FF8A80]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleStep(step.stepNumber)}
                          className={`cursor-pointer w-5 h-5 rounded-full border flex items-center justify-center font-bold text-xs transition-all ${
                            isStepDone
                              ? 'bg-[#10B981] border-[#10B981] text-white'
                              : 'border-[#FED7CD] text-[#FF7262] hover:bg-[#FF7262] hover:text-white'
                          }`}
                        >
                          {isStepDone ? <Check className="w-3 h-3" /> : step.stepNumber}
                        </button>
                        <h4 className="text-xs font-black text-[#33252A]">{step.title}</h4>
                      </div>

                      {step.timeMinutes && (
                        <button
                          onClick={() => startTimer(step.timeMinutes!)}
                          className="cursor-pointer px-2 py-0.5 rounded-full bg-[#FFEAE4] text-[#FF7262] border border-[#FED7CD] text-[10px] font-bold flex items-center gap-1 hover:bg-[#FED7CD]"
                          title="Iniciar temporizador para este paso"
                        >
                          <Clock className="w-3 h-3 text-[#FF7262]" />
                          <span>{step.timeMinutes} min</span>
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-[#5C4A51] leading-relaxed ml-7">
                      {step.instruction}
                    </p>

                    {step.tip && (
                      <div className="mt-2 ml-7 p-2 rounded-xl bg-[#FFEFEA] border border-[#FED7CD] text-[11px] text-[#A66F7B] flex items-start gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#FF7262] shrink-0 mt-0.5" />
                        <span><strong>Tip del Chef:</strong> {step.tip}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-[#FED7CD] bg-[#FFF0EB] flex items-center justify-between">
          <div className="text-xs text-[#7D6F76]">
            {completedSteps.length === recipe.steps.length ? (
              <span className="text-[#10B981] font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> ¡Platillo listo para disfrutar!
              </span>
            ) : (
              <span>Marca cada paso conforme avances en la cocina.</span>
            )}
          </div>

          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-2 rounded-2xl text-xs font-bold text-white bg-[#FF7262] hover:bg-[#FA7268] transition-colors shadow-xs"
          >
            Cerrar Modo Cocina
          </button>
        </div>
      </div>
    </div>
  );
};
