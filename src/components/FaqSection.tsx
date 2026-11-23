import React, { useState } from 'react';
import { HelpCircle, ChevronDown, Sparkles } from 'lucide-react';
import { FAQS } from '../data/communityData.ts';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleAccordion = (index: number) => {
    setOpenIndex(prev => (prev === index ? null : index));
  };

  return (
    <section id="preguntas" className="py-16 px-4 sm:px-6 lg:px-8 border-t border-pink-950/40 relative">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-[11px] font-bold tracking-widest uppercase text-pink-400 bg-pink-950/80 border border-pink-800/40 px-3.5 py-1 rounded-full">
            Resolvemos tus Dudas
          </span>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mt-4 mb-3">
            Preguntas Frecuentes
          </h2>

          <p className="text-xs sm:text-sm text-zinc-300">
            Todo lo que necesitas saber antes de comenzar a cocinar con CociFlex.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={idx}
                className="bg-[#18081e] border border-pink-950 rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleAccordion(idx)}
                  className="cursor-pointer w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 text-white hover:text-pink-300 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-bold flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-pink-400 shrink-0" />
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-pink-400 shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-white' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-zinc-300 leading-relaxed border-t border-pink-950/60 pt-3 animate-in fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
