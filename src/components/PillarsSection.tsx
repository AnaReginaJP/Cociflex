import React from 'react';
import { Cpu, FlaskConical, Users2, ArrowUpRight } from 'lucide-react';

interface PillarsSectionProps {
  onSelectPillar: (sectionId: string) => void;
}

export const PillarsSection: React.FC<PillarsSectionProps> = ({ onSelectPillar }) => {
  return (
    <section id="pilares" className="py-16 px-4 sm:px-6 lg:px-8 border-t border-pink-950/40 relative">
      <div className="max-w-7xl mx-auto text-center">
        {/* Category Header */}
        <span className="text-[11px] font-bold tracking-widest uppercase text-pink-400 bg-pink-950/60 border border-pink-800/30 px-3.5 py-1 rounded-full">
          Propuesta de Valor Integral
        </span>

        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mt-4 mb-3">
          Tres Pilares para Transformar tu Manera de Cocinar
        </h2>

        <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl mx-auto mb-12">
          CociFlex no es solo un recetario, es un ecosistema que combina algoritmos inteligentes de coincidencia, 
          rigor científico en bioartesanía y la fuerza de la comunidad colaborativa.
        </p>

        {/* The 3 Cards matching video design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {/* Pilar 1 */}
          <div 
            onClick={() => onSelectPillar('asistente')}
            className="cursor-pointer group relative bg-[#1c0c22]/90 border border-pink-900/40 hover:border-pink-500/60 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-pink-950/60"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-pink-400">
                Pilar 1
              </span>
              <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 group-hover:bg-pink-500 group-hover:text-white transition-all">
                <Cpu className="w-5 h-5" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-2.5 group-hover:text-pink-300 transition-colors">
              Cero Desperdicio con IA Culinaria
            </h3>

            <p className="text-xs text-zinc-300 leading-relaxed mb-6">
              Diles adiós a las sobras innecesarias. Registra tus insumos, selecciona el tiempo disponible, el número de personas y tus preferencias gastronómicas. Nuestro motor te dará platillos ordenados por porcentaje de coincidencia exacta, detectando si te falta algo.
            </p>

            <div className="flex items-center gap-1.5 text-xs font-bold text-pink-400 group-hover:text-pink-300">
              <span>Matching de Insumos</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>

          {/* Pilar 2 */}
          <div 
            onClick={() => onSelectPillar('fermentacion')}
            className="cursor-pointer group relative bg-[#1c0c22]/90 border border-pink-900/40 hover:border-pink-500/60 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-pink-950/60"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-pink-400">
                Pilar 2
              </span>
              <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 group-hover:bg-pink-500 group-hover:text-white transition-all">
                <FlaskConical className="w-5 h-5" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-2.5 group-hover:text-pink-300 transition-colors">
              El Arte de la Fermentación Artesanal
            </h3>

            <p className="text-xs text-zinc-300 leading-relaxed mb-6">
              Conviértete en un productor bioartesanal. Accede a guías estandarizadas con rigor científico y factores de inocuidad para crear tu propio yogur, kéfir o quesos en casa con total seguridad alimentaria y control de variables.
            </p>

            <div className="flex items-center gap-1.5 text-xs font-bold text-pink-400 group-hover:text-pink-300">
              <span>Rigor Microbiológico Seguro</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>

          {/* Pilar 3 */}
          <div 
            onClick={() => onSelectPillar('comunidad')}
            className="cursor-pointer group relative bg-[#1c0c22]/90 border border-pink-900/40 hover:border-pink-500/60 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-pink-950/60"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-pink-400">
                Pilar 3
              </span>
              <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 group-hover:bg-pink-500 group-hover:text-white transition-all">
                <Users2 className="w-5 h-5" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-2.5 group-hover:text-pink-300 transition-colors">
              Comunidad Colaborativa y Retos
            </h3>

            <p className="text-xs text-zinc-300 leading-relaxed mb-6">
              Cocina, comparte y gana. Participa en retos patrocinados por grandes marcas de alimentos, pon a prueba tus habilidades de innovación culinaria abierta y colabora con estudiantes foráneos y cocineros en nuestro feed interactivo.
            </p>

            <div className="flex items-center gap-1.5 text-xs font-bold text-pink-400 group-hover:text-pink-300">
              <span>Innovación Abierta & Patrocinios</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
