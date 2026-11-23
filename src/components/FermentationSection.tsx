import React, { useState } from 'react';
import { 
  FlaskConical, 
  Thermometer, 
  Clock, 
  Activity, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  Sparkles,
  BookOpen,
  Beaker,
  ChevronRight
} from 'lucide-react';
import { FERMENTATION_GUIDES } from '../data/fermentationData.ts';
import { validateFermentationSafety } from '../utils/recipeMatcher.ts';

export const FermentationSection: React.FC = () => {
  const [selectedGuideId, setSelectedGuideId] = useState<string>(FERMENTATION_GUIDES[0].id);

  const activeGuide = FERMENTATION_GUIDES.find(g => g.id === selectedGuideId) || FERMENTATION_GUIDES[0];

  // Interactive Batch Safety Test simulator states
  const [testTemp, setTestTemp] = useState<number>(activeGuide.targetTempC);
  const [testPh, setTestPh] = useState<number>(
    Math.round(((activeGuide.phTargetMin + activeGuide.phTargetMax) / 2) * 10) / 10
  );
  const [showSimulator, setShowSimulator] = useState<boolean>(false);

  const safetyResult = validateFermentationSafety(activeGuide, testTemp, testPh);

  const handleSelectGuide = (guideId: string) => {
    setSelectedGuideId(guideId);
    const g = FERMENTATION_GUIDES.find(item => item.id === guideId) || FERMENTATION_GUIDES[0];
    setTestTemp(g.targetTempC);
    setTestPh(Math.round(((g.phTargetMin + g.phTargetMax) / 2) * 10) / 10);
  };

  return (
    <section id="fermentacion" className="py-16 px-4 sm:px-6 lg:px-8 border-t border-pink-950/40 relative">
      <div className="max-w-7xl mx-auto">
        {/* Top Section Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-950/80 border border-pink-800/40 text-pink-300 text-xs font-semibold mb-3">
            <FlaskConical className="w-3.5 h-3.5 text-pink-400" />
            <span>Ciencia de Alimentos & Biotecnología Casera</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-3">
            El Arte de la Fermentación con Rigor Científico
          </h2>

          <p className="text-xs sm:text-sm text-zinc-300 max-w-3xl leading-relaxed">
            No arriesgues tu salud con recetas dudosas de internet. En CociFlex, cada guía técnica de bioartesanía 
            cuenta con estandarización de temperaturas, tiempos críticos y parámetros de pH para garantizar 
            inocuidad y probióticos vivos.
          </p>
        </div>

        {/* Main Grid: Guide Selector on Left (5 cols) & Technical Dossier on Right (7 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Guides list */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-pink-400 px-1 mb-2">
              Guías Técnicas Certificadas:
            </h3>

            {FERMENTATION_GUIDES.map(guide => {
              const isSelected = guide.id === activeGuide.id;

              return (
                <div
                  key={guide.id}
                  onClick={() => handleSelectGuide(guide.id)}
                  className={`cursor-pointer rounded-2xl p-4 sm:p-5 transition-all border ${
                    isSelected
                      ? 'bg-[#220d2b] border-pink-500 shadow-xl shadow-pink-950/60 ring-1 ring-pink-500/40'
                      : 'bg-[#16071c] border-pink-950 hover:border-pink-900/60'
                  }`}
                  role="button"
                  aria-pressed={isSelected}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                          {guide.category}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 font-semibold">
                          {guide.badge}
                        </span>
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-white">
                        {guide.name}
                      </h4>
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {guide.description}
                      </p>
                    </div>

                    <ChevronRight className={`w-5 h-5 shrink-0 transition-transform ${isSelected ? 'text-pink-400 translate-x-1' : 'text-zinc-600'}`} />
                  </div>

                  <div className="mt-3 pt-3 border-t border-pink-950/80 flex items-center gap-4 text-[11px] text-zinc-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Thermometer className="w-3.5 h-3.5 text-pink-400" />
                      {guide.targetTempC}°C ±{guide.tempToleranceC}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-pink-400" />
                      {guide.incubationTimeDisplay}
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-pink-400" />
                      pH {guide.phTargetMin} - {guide.phTargetMax}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Active Guide Technical Dossier */}
          <div className="lg:col-span-7 bg-[#1c0c22]/95 border border-pink-900/60 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-md space-y-6">
            {/* Dossier Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-pink-950">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-400 block mb-1">
                  Ficha Técnica de Fermentación
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  {activeGuide.name}
                </h3>
              </div>
              <span className="shrink-0 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md">
                Inocuidad 100%
              </span>
            </div>

            {/* 3 Telemetry Cards matching video */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="bg-[#120716] p-4 rounded-2xl border border-pink-950">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Temp. Controlada
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-pink-300">
                  {activeGuide.targetTempC}°C ± {activeGuide.tempToleranceC}
                </span>
              </div>

              <div className="bg-[#120716] p-4 rounded-2xl border border-pink-950">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Tiempo Reposo
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-pink-300">
                  {activeGuide.incubationTimeDisplay}
                </span>
              </div>

              <div className="bg-[#120716] p-4 rounded-2xl border border-pink-950">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Parámetro pH
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-pink-300">
                  {activeGuide.phTargetMin} - {activeGuide.phTargetMax}
                </span>
              </div>
            </div>

            {/* Microbiology & Strains */}
            <div className="bg-[#120716] p-4 rounded-2xl border border-pink-950 text-xs">
              <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <Beaker className="w-3.5 h-3.5 text-pink-400" />
                Microbiología y Cultivos Activos
              </span>
              <p className="text-zinc-200 leading-relaxed font-mono text-[11px]">
                {activeGuide.microbiology}
              </p>
            </div>

            {/* Interactive Batch Safety Simulator Toggle */}
            <div className="bg-[#140618] border border-pink-900/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-pink-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Simulador de Inocuidad de Lote en Vivo
                  </span>
                </div>
                <button
                  onClick={() => setShowSimulator(prev => !prev)}
                  className="cursor-pointer text-[11px] font-bold text-pink-400 hover:text-pink-300 underline"
                >
                  {showSimulator ? 'Ocultar simulador' : 'Probar lote casero'}
                </button>
              </div>

              {showSimulator && (
                <div className="mt-4 pt-4 border-t border-pink-950/80 space-y-4 text-xs">
                  <p className="text-[11px] text-zinc-300">
                    Ingresa los valores actuales de tu preparación casera para verificar si está dentro del umbral seguro de inocuidad microbiológica:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="temp-slider" className="block text-[11px] font-medium text-zinc-400 mb-1">
                        Temperatura Medida (°C): <strong className="text-white">{testTemp}°C</strong>
                      </label>
                      <input
                        id="temp-slider"
                        type="range"
                        min="15"
                        max="55"
                        step="0.5"
                        value={testTemp}
                        onChange={(e) => setTestTemp(parseFloat(e.target.value))}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label htmlFor="ph-slider" className="block text-[11px] font-medium text-zinc-400 mb-1">
                        Nivel de pH Medido: <strong className="text-white">{testPh}</strong>
                      </label>
                      <input
                        id="ph-slider"
                        type="range"
                        min="3.0"
                        max="8.0"
                        step="0.1"
                        value={testPh}
                        onChange={(e) => setTestPh(parseFloat(e.target.value))}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Safety Result Badge */}
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                      safetyResult.warnings.length === 0
                        ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                    }`}
                  >
                    {safetyResult.warnings.length === 0 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-xs font-bold text-emerald-200">
                            ¡Lote Seguro y Parámetros en Rango Óptimo!
                          </strong>
                          <span className="text-[11px] text-emerald-300/90">
                            La temperatura ({testTemp}°C) y el pH ({testPh}) garantizan la fermentación adecuada de los cultivos sin riesgo de patógenos.
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-xs font-bold text-rose-200">
                            Alerta de Desviación Microbiológica:
                          </strong>
                          <ul className="text-[11px] list-disc list-inside space-y-0.5 text-rose-200/90 mt-1">
                            {safetyResult.warnings.map((w, idx) => (
                              <li key={idx}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Protocol Steps with Critical Control Points */}
            <div>
              <h4 className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                Protocolo Estandarizado de Elaboración:
              </h4>

              <div className="space-y-3">
                {activeGuide.steps.map(step => (
                  <div key={step.stepNumber} className="bg-[#120716] p-3.5 rounded-2xl border border-pink-950 text-xs">
                    <div className="flex items-center gap-2 mb-1.5 font-bold text-white">
                      <span className="w-5 h-5 rounded-full bg-pink-950 border border-pink-800 text-pink-400 flex items-center justify-center text-[10px]">
                        {step.stepNumber}
                      </span>
                      <span>{step.title}</span>
                    </div>

                    <p className="text-zinc-300 leading-relaxed text-[11px] ml-7">
                      {step.instruction}
                    </p>

                    {step.criticalControlPoint && (
                      <div className="mt-2 ml-7 p-2 rounded-xl bg-pink-950/60 border border-pink-900 text-[10px] text-pink-300 font-semibold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                        <span>{step.criticalControlPoint}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Safety & Hygiene Checklist */}
            <div className="bg-[#120716] p-4 rounded-2xl border border-pink-950 text-xs">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Checklist Obligatorio de Inocuidad y Esterilización:
              </span>
              <ul className="space-y-1.5 text-zinc-300 text-[11px]">
                {activeGuide.safetyChecklist.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
