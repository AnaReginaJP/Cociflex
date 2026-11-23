import React from 'react';
import { ChefHat, Sparkles, BookOpen, Users, HelpCircle, Utensils, Download } from 'lucide-react';

interface NavbarProps {
  onOpenPilotModal: () => void;
  activeSection: string;
  onNavigate: (sectionId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenPilotModal, activeSection, onNavigate }) => {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#120716]/90 border-b border-pink-950/40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div 
          onClick={() => onNavigate('inicio')}
          className="flex items-center gap-3 cursor-pointer group"
          role="button"
          aria-label="CociFlex Inicio"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-500 p-0.5 shadow-lg shadow-pink-900/30 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#17091d] rounded-[14px] flex items-center justify-center">
              <ChefHat className="w-6 h-6 text-pink-400 group-hover:text-pink-300 transition-colors" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-white font-sans">
                Coci<span className="text-pink-500">Flex</span>
              </span>
            </div>
            <p className="text-[11px] text-pink-200/60 font-medium hidden sm:block">
              Asistente Digital e Innovación Culinaria
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-[#1c0c22]/80 p-1.5 rounded-full border border-pink-900/30 shadow-inner">
          <button
            onClick={() => onNavigate('pilares')}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSection === 'pilares'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                : 'text-zinc-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Pilares de Valor
          </button>

          <button
            onClick={() => onNavigate('asistente')}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSection === 'asistente'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                : 'text-zinc-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            Simular con IA
          </button>

          <button
            onClick={() => onNavigate('fermentacion')}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSection === 'fermentacion'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                : 'text-zinc-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Fermentación
          </button>

          <button
            onClick={() => onNavigate('comunidad')}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSection === 'comunidad'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                : 'text-zinc-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Comunidad
          </button>

          <button
            onClick={() => onNavigate('preguntas')}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSection === 'preguntas'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                : 'text-zinc-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Preguntas
          </button>
        </nav>

        {/* Action Button & Mobile Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => onNavigate('switch-mobile')}
            className="cursor-pointer px-3.5 py-2 rounded-full text-xs font-bold text-pink-300 bg-pink-950/80 hover:bg-pink-900 border border-pink-700/50 flex items-center gap-1.5 transition-all shadow-sm"
            aria-label="Abrir versión móvil interactiva"
          >
            <span>📱</span>
            <span className="hidden sm:inline">Modo App Móvil</span>
            <span className="sm:hidden">App</span>
          </button>

          <button
            onClick={onOpenPilotModal}
            className="cursor-pointer relative group overflow-hidden px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-pink-600 via-rose-500 to-pink-700 hover:brightness-110 shadow-lg shadow-pink-900/40 border border-pink-400/30 transition-all flex items-center gap-1.5"
            aria-label="Descargar App Gratis o Fase Piloto"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Descargar App Gratis</span>
            <span className="sm:hidden">Descargar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
