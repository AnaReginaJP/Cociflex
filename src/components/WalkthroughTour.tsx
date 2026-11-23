import React, { useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Lightbulb,
  Sparkles,
  X,
  CheckCircle2,
} from 'lucide-react';
import {
  WALKTHROUGH_STEPS,
  WorkspaceTab,
  getNextWalkthroughIndex,
  getPrevWalkthroughIndex,
  getWalkthroughProgressPercent,
} from '../utils/walkthroughSteps.ts';

interface WalkthroughTourProps {
  isOpen: boolean;
  currentStepIndex: number;
  onChangeStep: (nextIndex: number) => void;
  onSwitchTab: (tab: WorkspaceTab) => void;
  onClose: (completed: boolean) => void;
}

export const WalkthroughTour: React.FC<WalkthroughTourProps> = ({
  isOpen,
  currentStepIndex,
  onChangeStep,
  onSwitchTab,
  onClose,
}) => {
  const step = WALKTHROUGH_STEPS[currentStepIndex] || WALKTHROUGH_STEPS[0];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === WALKTHROUGH_STEPS.length - 1;
  const progressPercent = getWalkthroughProgressPercent(currentStepIndex);

  // Sync active tab and highlight DOM target element without blocking interaction
  useEffect(() => {
    if (!isOpen) {
      document.querySelectorAll('[data-tour-active="true"]').forEach((el) => {
        el.removeAttribute('data-tour-active');
      });
      return;
    }

    onSwitchTab(step.targetTab);

    const timer = window.setTimeout(() => {
      document.querySelectorAll('[data-tour-active="true"]').forEach((el) => {
        el.removeAttribute('data-tour-active');
      });

      const targetEl = document.querySelector(step.targetSelector);
      if (targetEl) {
        targetEl.setAttribute('data-tour-active', 'true');
        if (step.stepNumber === 1) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen, step, onSwitchTab]);

  // Clean up highlight attributes when unmounting
  useEffect(() => {
    return () => {
      document.querySelectorAll('[data-tour-active="true"]').forEach((el) => {
        el.removeAttribute('data-tour-active');
      });
    };
  }, []);

  // Keyboard support (ArrowRight, ArrowLeft, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';

      if (e.key === 'Escape') {
        onClose(false);
        return;
      }

      if (isInputFocused) return;

      if (e.key === 'ArrowRight') {
        if (isLast) {
          onClose(true);
        } else {
          onChangeStep(getNextWalkthroughIndex(currentStepIndex));
        }
      } else if (e.key === 'ArrowLeft') {
        onChangeStep(getPrevWalkthroughIndex(currentStepIndex));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, isLast, onChangeStep, onClose]);

  if (!isOpen) return null;

  return (
    <aside
      role="dialog"
      aria-label="Guía interactiva de CociFlex"
      aria-live="polite"
      data-testid="walkthrough-card"
      className="fixed bottom-20 md:bottom-6 right-3 left-3 md:left-auto md:right-6 md:w-[400px] z-50 bg-white/95 backdrop-blur-lg border border-[#FED7CD] rounded-3xl shadow-[0_20px_50px_rgba(51,37,42,0.16)] p-5 text-[#33252A]"
    >
      {/* Top Progress Strip */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-[#FFEFEA] border border-[#FED7CD] flex items-center justify-center text-[#FF7262]">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF7262] block tabular-nums">
              Guía Interactiva · Paso {step.stepNumber} de {WALKTHROUGH_STEPS.length}
            </span>
            <span className="text-xs font-semibold text-[#7D6F76]">{step.subtitle}</span>
          </div>
        </div>

        <button
          onClick={() => onClose(false)}
          aria-label="Saltar guía interactiva"
          title="Saltar guía"
          className="cursor-pointer p-1.5 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-[#8C7E85] hover:text-[#33252A] hover:border-[#FF8A80] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-[#FFF0EB] rounded-full overflow-hidden mb-3.5">
        <div
          className="h-full bg-[#FF7262] rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step Content */}
      <div className="space-y-2.5">
        <h3 className="text-base font-extrabold text-[#33252A] leading-snug font-display">
          {step.title}
        </h3>
        <p className="text-xs sm:text-[13px] text-[#5C4A51] leading-relaxed">
          {step.description}
        </p>

        <div className="p-3 rounded-2xl bg-[#E8F8F0] border border-[#A7F3D0] text-xs text-[#1E7E50] flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            <strong className="font-bold">Tip práctico:</strong> {step.actionTip}
          </span>
        </div>
      </div>

      {/* Step Dots */}
      <div className="flex items-center justify-center gap-1.5 my-3.5">
        {WALKTHROUGH_STEPS.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => onChangeStep(idx)}
            aria-label={`Ir al paso ${s.stepNumber}: ${s.title}`}
            className={`cursor-pointer h-2 rounded-full transition-all ${
              idx === currentStepIndex
                ? 'w-6 bg-[#FF7262]'
                : 'w-2 bg-[#FED7CD] hover:bg-[#FF8A80]'
            }`}
          />
        ))}
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#FED7CD]/70">
        <button
          onClick={() => onClose(false)}
          className="cursor-pointer text-xs font-semibold text-[#8C7E85] hover:text-[#33252A] px-2 py-1.5"
        >
          Saltar guía
        </button>

        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              onClick={() => onChangeStep(getPrevWalkthroughIndex(currentStepIndex))}
              aria-label="Paso anterior"
              className="cursor-pointer px-3 py-2 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-xs font-bold text-[#5C4A51] hover:border-[#FF8A80] flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
          )}

          {isLast ? (
            <button
              onClick={() => onClose(true)}
              aria-label="Finalizar guía interactiva"
              className="cursor-pointer px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>¡Entendido, a cocinar!</span>
            </button>
          ) : (
            <button
              onClick={() => onChangeStep(getNextWalkthroughIndex(currentStepIndex))}
              aria-label="Siguiente paso"
              className="cursor-pointer px-4 py-2 rounded-xl bg-[#FF7262] hover:bg-[#FA7268] text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
