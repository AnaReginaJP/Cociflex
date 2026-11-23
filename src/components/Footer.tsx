import React from 'react';
import { ChefHat, ArrowUp, Heart, ShieldCheck, Mail, Sparkles } from 'lucide-react';

interface FooterProps {
  onOpenPilotModal: () => void;
  onScrollToMatcher: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenPilotModal, onScrollToMatcher }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-pink-950/60 bg-[#0f0412] text-zinc-300">
      {/* Pink Pre-footer CTA matching Video */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="bg-gradient-to-r from-pink-600 via-rose-600 to-pink-500 rounded-3xl p-8 sm:p-12 text-center text-white relative overflow-hidden shadow-2xl shadow-pink-950/80">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          {/* Logo in CTA */}
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center p-1 border border-white/30">
            <ChefHat className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-3">
            ¿Listo para cocinar rico y sin desperdiciar nada?
          </h2>

          <p className="text-xs sm:text-sm text-pink-100 max-w-xl mx-auto mb-8 font-medium">
            Únete a la nueva era de la innovación culinaria colaborativa en México. Regístrate hoy mismo y sé de los primeros en probar CociFlex.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onOpenPilotModal}
              className="cursor-pointer px-6 py-3 rounded-full font-bold text-xs bg-white text-pink-700 hover:bg-pink-50 shadow-lg transition-all"
            >
              Quiero Acceso Anticipado
            </button>

            <button
              onClick={onScrollToMatcher}
              className="cursor-pointer px-6 py-3 rounded-full font-bold text-xs bg-pink-800/60 hover:bg-pink-800 text-white border border-pink-400/30 transition-all"
            >
              Volver a Probar el Asistente
            </button>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Credits matching Video */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
          {/* Brand Info & Authors */}
          <div className="md:col-span-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-pink-600/30 border border-pink-500/40 flex items-center justify-center text-pink-400">
                <ChefHat className="w-4 h-4" />
              </div>
              <span className="text-xl font-black text-white">
                Coci<span className="text-pink-500">Flex</span>
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed max-w-md">
              Asistente Digital e Innovación Culinaria Colaborativa, impulsado por Inteligencia Artificial para ingredientes en casa, guías bioartesanales de fermentación y retos de innovación abierta.
            </p>

            <div className="pt-2 border-t border-pink-950/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 block mb-1">
                Autores del Proyecto CociFlex:
              </span>
              <p className="text-xs text-zinc-300 font-medium">
                Román Morales Yaritzel • Pineda Rivera Gretel Guadalupe • Ortiz Valle Grecia
              </p>
            </div>
          </div>

          {/* Links Column 1 */}
          <div className="md:col-span-3 space-y-3 text-xs">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] text-pink-300">
              Plataforma
            </h4>
            <ul className="space-y-2 text-zinc-400">
              <li>
                <button onClick={onScrollToMatcher} className="hover:text-pink-400 transition-colors">
                  Cero Desperdicio IA
                </button>
              </li>
              <li>
                <a href="#fermentacion" className="hover:text-pink-400 transition-colors">
                  Fermentación Bioartesanal
                </a>
              </li>
              <li>
                <a href="#comunidad" className="hover:text-pink-400 transition-colors">
                  Red de Recetas Validadas (3 likes)
                </a>
              </li>
              <li>
                <a href="#fermentacion" className="hover:text-pink-400 transition-colors">
                  Simulador de Procesos
                </a>
              </li>
              <li>
                <button onClick={onOpenPilotModal} className="hover:text-pink-400 transition-colors">
                  Panel para Estudiantes Foráneos
                </button>
              </li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div className="md:col-span-3 space-y-3 text-xs">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] text-pink-300">
              Legal & Soporte
            </h4>
            <ul className="space-y-2 text-zinc-400">
              <li className="hover:text-pink-400 transition-colors cursor-pointer">
                Política de Privacidad
              </li>
              <li className="hover:text-pink-400 transition-colors cursor-pointer">
                Términos de Servicio
              </li>
              <li className="hover:text-pink-400 transition-colors cursor-pointer flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Protocolo de Seguridad Alimentaria</span>
              </li>
              <li className="pt-2">
                <span className="text-[10px] text-zinc-500 block">Contacto de soporte:</span>
                <span className="text-pink-300 text-[11px]">contacto@cociflex.mx</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="pt-8 border-t border-pink-950/60 flex flex-wrap items-center justify-between gap-4 text-[11px] text-zinc-500">
          <p>© 2026 CociFlex — Todos los Derechos Reservados. Proyecto Colaborativo Universitario.</p>
          <button
            onClick={scrollToTop}
            className="cursor-pointer flex items-center gap-1 text-pink-400 hover:text-pink-300 font-semibold"
          >
            <span>Subir al inicio</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
