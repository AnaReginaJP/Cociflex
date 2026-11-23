import React, { useState } from 'react';
import { 
  Cpu, 
  Settings2, 
  Sparkles, 
  Thermometer, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  X,
  Wifi,
  Beaker,
  BookOpen,
  Info,
  Lightbulb,
  Check
} from 'lucide-react';
import { 
  LocalAiConfig, 
  DEFAULT_LOCAL_AI_CONFIG, 
  testLocalAiConnection, 
  personalizeFermentBatch, 
  diagnoseSensoryHealth, 
  FermentPersonalizationResult, 
  SensoryDiagnosisResult 
} from '../../services/localAiFermentService.ts';
import { FERMENTATION_GUIDES } from '../../data/fermentationData.ts';

const LOCAL_AI_STORAGE_KEY = 'cociflex_local_ai_config_v1';

export const LocalAiFermentationAssistant: React.FC = () => {
  // Local AI Configuration
  const [config, setConfig] = useState<LocalAiConfig>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_AI_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_LOCAL_AI_CONFIG;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBeginnerGuideOpen, setIsBeginnerGuideOpen] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Active assistant tab: 'personalizar' | 'diagnosticar'
  const [mode, setMode] = useState<'personalizar' | 'diagnosticar'>('personalizar');

  // Personalization Form State
  const [selectedGuideId, setSelectedGuideId] = useState(FERMENTATION_GUIDES[1].id); // default kefir
  const [roomTemp, setRoomTemp] = useState<number>(24);
  const [ingredientBase, setIngredientBase] = useState('Leche pasteurizada comercial');
  const [flavorGoal, setFlavorGoal] = useState<'suave' | 'balanceado' | 'intenso_probiotico'>('balanceado');
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const [personalizationResult, setPersonalizationResult] = useState<FermentPersonalizationResult | null>(null);

  // Diagnosis Form State
  const [diagGuideId, setDiagGuideId] = useState(FERMENTATION_GUIDES[1].id);
  const [elapsedHours, setElapsedHours] = useState<number>(20);
  const [smellDesc, setSmellDesc] = useState('Ácido fresco y láctico (aroma agradable a yogur)');
  const [appDesc, setAppDesc] = useState('Espeso homogéneo con ligeras burbujas');
  const [bubblesLevel, setBubblesLevel] = useState<'ninguna' | 'ligeras' | 'abundantes' | 'separacion_suero'>('ligeras');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<SensoryDiagnosisResult | null>(null);

  // Save config
  const handleSaveConfig = (newConfig: LocalAiConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(LOCAL_AI_STORAGE_KEY, JSON.stringify(newConfig));
    } catch {
      // ignore
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await testLocalAiConnection(config);
    setTestResult(res);
    setIsTesting(false);
  };

  const handleRunPersonalization = async () => {
    setIsPersonalizing(true);
    const guide = FERMENTATION_GUIDES.find(g => g.id === selectedGuideId) || FERMENTATION_GUIDES[0];
    
    const res = await personalizeFermentBatch({
      guideId: guide.id,
      guideName: guide.name,
      roomTempC: roomTemp,
      baseIngredientType: ingredientBase,
      flavorTarget: flavorGoal,
    }, config);

    setPersonalizationResult(res);
    setIsPersonalizing(false);
  };

  const handleRunDiagnosis = async () => {
    setIsDiagnosing(true);
    const guide = FERMENTATION_GUIDES.find(g => g.id === diagGuideId) || FERMENTATION_GUIDES[0];

    const res = await diagnoseSensoryHealth({
      guideName: guide.name,
      elapsedHours,
      smellDescription: smellDesc,
      appearanceDescription: appDesc,
      bubblesLevel,
    }, config);

    setDiagnosisResult(res);
    setIsDiagnosing(false);
  };

  return (
    <div className="bg-white border border-[#C2EED9] rounded-3xl p-4 shadow-xs space-y-3.5">
      {/* Header with Title and Connection Toggle */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[#EAF8F2]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#10B981] to-[#34D399] text-white flex items-center justify-center shadow-xs">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black text-[#264E36]">BioAsistente Local</h3>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#EAF8F2] text-[#10B981] border border-[#C2EED9]">
                IA en tu PC
              </span>
            </div>
            <p className="text-[10px] text-[#5C7E66]">
              {config.provider === 'ollama' ? 'Ollama' : config.provider === 'lmstudio' ? 'LM Studio' : 'Local'} ({config.model})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsGlossaryOpen(true)}
            className="cursor-pointer p-1.5 rounded-xl bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#10B981] border border-[#C2EED9] transition-colors"
            title="Glosario para principiantes"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="cursor-pointer p-1.5 rounded-xl bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#10B981] border border-[#C2EED9] transition-colors"
            title="Configurar IA Local en tu computadora"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Beginner-Friendly Card: "¿Qué es esto y cómo te ayuda?" (Expandable) */}
      <div className="bg-gradient-to-br from-[#F0FDF4] to-[#E6F9EF] border border-[#C2EED9] rounded-2xl overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsBeginnerGuideOpen(!isBeginnerGuideOpen)}
          className="w-full p-2.5 flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">💡</span>
            <div>
              <span className="text-xs font-black text-[#166534] block">
                ¿Eres nuevo en fermentos? Toca aquí
              </span>
              <p className="text-[10px] text-[#3D7A53]">
                Aprende qué hace esta herramienta en 3 ideas súper sencillas
              </p>
            </div>
          </div>
          {isBeginnerGuideOpen ? (
            <ChevronUp className="w-4 h-4 text-[#166534] shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#166534] shrink-0" />
          )}
        </button>

        {isBeginnerGuideOpen && (
          <div className="p-3 pt-0 border-t border-[#C2EED9]/60 space-y-2.5 text-xs text-[#264E36] animate-in fade-in">
            <div className="p-2 bg-white/80 rounded-xl border border-[#C2EED9]/80 space-y-1">
              <span className="font-bold text-[#10B981] flex items-center gap-1 text-[11px]">
                <Thermometer className="w-3.5 h-3.5" /> 1. El calor de tu cocina lo cambia todo:
              </span>
              <p className="text-[11px] leading-relaxed text-[#4A6F56]">
                Las bacterias buenas son como nosotros: con calor trabajan mucho más rápido y con frío se duermen. Por eso una receta de internet de 24 horas puede estar lista en 15 horas en verano o tardar 32 horas en invierno.
              </p>
            </div>

            <div className="p-2 bg-white/80 rounded-xl border border-[#C2EED9]/80 space-y-1">
              <span className="font-bold text-[#10B981] flex items-center gap-1 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" /> 2. ¿Qué es el pH y por qué es tu escudo protector?
              </span>
              <p className="text-[11px] leading-relaxed text-[#4A6F56]">
                El pH mide la acidez (de 1 a 14). Cuando tus bacterias comen la lactosa o el azúcar, producen ácido natural. En un pH ácido (menor a 4.5), las bacterias malas no pueden vivir, garantizando que tu alimento sea 100% seguro.
              </p>
            </div>

            <div className="p-2 bg-white/80 rounded-xl border border-[#C2EED9]/80 space-y-1">
              <span className="font-bold text-[#10B981] flex items-center gap-1 text-[11px]">
                <Cpu className="w-3.5 h-3.5" /> 3. ¿Por qué usar una IA Local en tu PC?
              </span>
              <p className="text-[11px] leading-relaxed text-[#4A6F56]">
                Tu computadora hace los cálculos de manera privada y gratuita, sin enviar tus recetas ni datos personales a servidores externos. Y si aún no tienes Ollama o LM Studio instalado, ¡no te preocupes! El asistente cuenta con un <strong>motor automático inteligente que funciona siempre 100% offline</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mode Tabs: Personalizar Lote vs Diagnosticar Salud */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F0FDF4] rounded-2xl border border-[#C2EED9]/60">
        <button
          onClick={() => setMode('personalizar')}
          className={`cursor-pointer py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center ${
            mode === 'personalizar'
              ? 'bg-white text-[#10B981] shadow-xs'
              : 'text-[#5C7E66] hover:text-[#264E36]'
          }`}
        >
          🌡️ Personalizar Lote
        </button>

        <button
          onClick={() => setMode('diagnosticar')}
          className={`cursor-pointer py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center ${
            mode === 'diagnosticar'
              ? 'bg-white text-[#10B981] shadow-xs'
              : 'text-[#5C7E66] hover:text-[#264E36]'
          }`}
        >
          🔬 Triage & Salud
        </button>
      </div>

      {/* ===================== TAB 1: PERSONALIZAR POR MICROCLIMA ===================== */}
      {mode === 'personalizar' && (
        <div className="space-y-3">
          {/* Friendly Step-by-Step explanation */}
          <div className="flex items-center gap-2 p-2 bg-[#FFF8F6] border border-[#FED7CD] rounded-xl text-[11px] text-[#7D6F76]">
            <Info className="w-4 h-4 text-[#FF7262] shrink-0" />
            <span>
              Ajusta la temperatura aproximada de tu cocina para saber a qué hora exacta estará listo tu fermento.
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Ferment selector */}
            <div>
              <label className="text-[10px] font-bold uppercase text-[#8C7E85] block mb-1">
                1. ¿Qué vas a fermentar hoy?
              </label>
              <select
                value={selectedGuideId}
                onChange={(e) => setSelectedGuideId(e.target.value)}
                className="w-full bg-[#FFF8F6] border border-[#FED7CD] rounded-xl p-2 text-xs text-[#33252A] focus:outline-none"
              >
                {FERMENTATION_GUIDES.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Kitchen Room Temperature Slider */}
            <div className="bg-[#FFF8F6] p-2.5 rounded-2xl border border-[#FED7CD]/80">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-[#7D6F76] font-medium flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-[#FF7262]" />
                  2. Temperatura promedio de tu cocina:
                </span>
                <span className="font-mono font-black text-[#FF7262] text-sm">
                  {roomTemp}°C
                </span>
              </div>
              <input
                type="range"
                min="16"
                max="36"
                value={roomTemp}
                onChange={(e) => setRoomTemp(Number(e.target.value))}
                className="w-full accent-[#FF7262]"
              />
              <div className="flex justify-between text-[9px] text-[#8C7E85] mt-0.5 font-medium">
                <span>❄️ 16°C (Frío)</span>
                <span>🌤️ 24°C (Templado)</span>
                <span>🔥 36°C (Cálido)</span>
              </div>
            </div>

            {/* Base Ingredient & Flavor Target */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-[#8C7E85] block mb-1">
                  3. Ingrediente que usarás:
                </label>
                <select
                  value={ingredientBase}
                  onChange={(e) => setIngredientBase(e.target.value)}
                  className="w-full bg-[#FFF8F6] border border-[#FED7CD] rounded-xl p-2 text-[11px] text-[#33252A] focus:outline-none"
                >
                  <option value="Leche pasteurizada comercial">Leche pasteurizada</option>
                  <option value="Leche entera de rancho / bronca hervida">Leche bronca hervida</option>
                  <option value="Leche deslactosada">Leche deslactosada</option>
                  <option value="Bebida de coco / almendra">Bebida vegetal</option>
                  <option value="Agua filtrada con piloncillo">Agua con piloncillo</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#8C7E85] block mb-1">
                  4. ¿Cómo te gusta de sabor?
                </label>
                <select
                  value={flavorGoal}
                  onChange={(e) => setFlavorGoal(e.target.value as any)}
                  className="w-full bg-[#FFF8F6] border border-[#FED7CD] rounded-xl p-2 text-[11px] text-[#33252A] focus:outline-none"
                >
                  <option value="suave">Suave (dulce, poco ácido)</option>
                  <option value="balanceado">Balanceado tradicional</option>
                  <option value="intenso_probiotico">Intenso (muy ácido y probiótico)</option>
                </select>
              </div>
            </div>

            {/* Calculate Button */}
            <button
              onClick={handleRunPersonalization}
              disabled={isPersonalizing}
              className="cursor-pointer w-full py-2.5 px-4 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-[#10B981] to-[#059669] hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-60"
            >
              {isPersonalizing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Calculando con tu IA Local ({config.model})...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Calcular Tiempo y pH para mi Cocina</span>
                </>
              )}
            </button>
          </div>

          {/* Personalization Results Card */}
          {personalizationResult && (
            <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-br from-[#EAF8F2] to-[#D5F3E5] border border-[#C2EED9] space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Resultado para tu Cocina:
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white text-[#059669] border border-[#C2EED9]">
                  {personalizationResult.source === 'local_ai' ? `IA Local (${config.model})` : 'Cálculo Bio-Cinético Automático'}
                </span>
              </div>

              {/* Highlight Metrics */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-[#C2EED9]">
                  <span className="text-[10px] text-[#5C7E66] block font-semibold">Tiempo de Reposo</span>
                  <span className="text-sm font-black text-[#059669] font-mono">
                    {personalizationResult.estimatedCompletionTime}
                  </span>
                  <span className="text-[9px] text-[#8C7E85] block mt-0.5">Hasta punto ideal</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-[#C2EED9]">
                  <span className="text-[10px] text-[#5C7E66] block font-semibold">pH de Corte Óptimo</span>
                  <span className="text-sm font-black text-[#10B981] font-mono">
                    pH {personalizationResult.targetPh}
                  </span>
                  <span className="text-[9px] text-[#8C7E85] block mt-0.5">Acidez segura</span>
                </div>
              </div>

              <p className="text-xs text-[#264E36] leading-relaxed italic bg-white/70 p-2.5 rounded-xl border border-[#C2EED9]/60">
                "{personalizationResult.scientificSummary}"
              </p>

              {/* Tips */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase text-[#264E36] block">
                  Pasos sugeridos para tu lote:
                </span>
                {personalizationResult.tips.map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-[11px] text-[#355A44]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 2: DIAGNÓSTICO SENSORIAL & TRIAGE ===================== */}
      {mode === 'diagnosticar' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2 bg-[#FFF8F6] border border-[#FED7CD] rounded-xl text-[11px] text-[#7D6F76]">
            <Info className="w-4 h-4 text-[#FF7262] shrink-0" />
            <span>
              ¿Tienes dudas de si tu cultivo sigue vivo o si se echó a perder? Cuéntale a la IA cómo se ve y huele.
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Guide selection */}
            <div>
              <label className="text-[10px] font-bold uppercase text-[#8C7E85] block mb-1">
                1. ¿Qué cultivo estás revisando?
              </label>
              <select
                value={diagGuideId}
                onChange={(e) => setDiagGuideId(e.target.value)}
                className="w-full bg-[#FFF8F6] border border-[#FED7CD] rounded-xl p-2 text-xs text-[#33252A] focus:outline-none"
              >
                {FERMENTATION_GUIDES.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Elapsed Hours */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase text-[#8C7E85]">
                  2. ¿Cuántas horas lleva fermentando?
                </span>
                <span className="font-mono font-bold text-[#FF7262]">{elapsedHours}h</span>
              </div>
              <input
                type="range"
                min="2"
                max="72"
                value={elapsedHours}
                onChange={(e) => setElapsedHours(Number(e.target.value))}
                className="w-full accent-[#FF7262]"
              />
            </div>

            {/* Smell Selector */}
            <div>
              <label className="text-[10px] font-bold uppercase text-[#8C7E85] block mb-1">
                3. ¿A qué huele?
              </label>
              <select
                value={smellDesc}
                onChange={(e) => setSmellDesc(e.target.value)}
                className="w-full bg-[#FFF8F6] border border-[#FED7CD] rounded-xl p-2 text-[11px] text-[#33252A] focus:outline-none"
              >
                <option value="Ácido fresco y láctico (aroma agradable a yogur)">Ácido fresco / láctico (agradable como yogur)</option>
                <option value="Ligeramente efervescente y panadero (levadura)">Efervescente / aroma a pan o levadura</option>
                <option value="Avinagrado fuerte / acético intenso">Avinagrado fuerte (olor a vinagre penetrante)</option>
                <option value="Olor pútrido, desagradable o a leche descompuesta">Desagradable, fétido o a leche podrida</option>
              </select>
            </div>

            {/* Appearance & Bubbles */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-[#8C7E85] block mb-1">
                  4. Aspecto visible:
                </label>
                <select
                  value={appDesc}
                  onChange={(e) => setAppDesc(e.target.value)}
                  className="w-full bg-[#FFF8F6] border border-[#FED7CD] rounded-xl p-2 text-[11px] text-[#33252A] focus:outline-none"
                >
                  <option value="Espeso homogéneo y limpio">Espeso y uniforme</option>
                  <option value="Separación de suero líquido amarillo en el fondo">Líquido amarillento separado</option>
                  <option value="Velo blanco delgado y seco en la superficie (posible Kahm)">Película blanca delgada</option>
                  <option value="Puntos de moho con pelusa verde o negra">Pelusa o manchas verdes/negras</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#8C7E85] block mb-1">
                  5. Burbujeo:
                </label>
                <select
                  value={bubblesLevel}
                  onChange={(e) => setBubblesLevel(e.target.value as any)}
                  className="w-full bg-[#FFF8F6] border border-[#FED7CD] rounded-xl p-2 text-[11px] text-[#33252A] focus:outline-none"
                >
                  <option value="ligeras">Burbujas finas normales</option>
                  <option value="abundantes">Muy efervescente</option>
                  <option value="separacion_suero">Bolsas de gas grandes</option>
                  <option value="ninguna">Sin burbujas visibles</option>
                </select>
              </div>
            </div>

            {/* Diagnose Button */}
            <button
              onClick={handleRunDiagnosis}
              disabled={isDiagnosing}
              className="cursor-pointer w-full py-2.5 px-4 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-[#059669] to-[#047857] hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-60"
            >
              {isDiagnosing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Evaluando con tu IA Local...</span>
                </>
              ) : (
                <>
                  <Beaker className="w-3.5 h-3.5" />
                  <span>Diagnosticar Salud del Lote</span>
                </>
              )}
            </button>
          </div>

          {/* Diagnosis Result Card */}
          {diagnosisResult && (
            <div className={`p-3.5 rounded-2xl border space-y-2 animate-in fade-in ${
              diagnosisResult.verdict === 'optimo'
                ? 'bg-[#E8F8F0] border-[#A7F3D0]'
                : diagnosisResult.verdict === 'precaucion'
                ? 'bg-[#FEFCE8] border-[#FEF08A]'
                : 'bg-[#FFF2EE] border-[#FECDD3]'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {diagnosisResult.verdict === 'optimo' ? (
                    <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  ) : diagnosisResult.verdict === 'precaucion' ? (
                    <AlertTriangle className="w-4 h-4 text-[#CA8A04]" />
                  ) : (
                    <X className="w-4 h-4 text-[#E11D48]" />
                  )}
                  <h4 className={`text-xs font-black ${
                    diagnosisResult.verdict === 'optimo'
                      ? 'text-[#1E7E50]'
                      : diagnosisResult.verdict === 'precaucion'
                      ? 'text-[#854D0E]'
                      : 'text-[#9F1239]'
                  }`}>
                    {diagnosisResult.verdictTitle}
                  </h4>
                </div>

                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-white/80 text-[#5C4A51]">
                  {diagnosisResult.source === 'local_ai' ? 'IA Local' : 'Triage Bioartesanal'}
                </span>
              </div>

              <p className="text-[11px] text-[#33252A] leading-relaxed">
                {diagnosisResult.microbialAnalysis}
              </p>

              <div className="pt-1.5 border-t border-black/5 text-[11px]">
                <strong className="block text-[10px] uppercase font-bold text-[#5C4A51] mb-0.5">
                  ¿Qué debes hacer ahora?
                </strong>
                <p className="text-[#33252A] font-medium leading-relaxed">
                  {diagnosisResult.recommendedAction}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== GLOSARIO PARA PRINCIPIANTES MODAL ===================== */}
      {isGlossaryOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#FFF8F6] border border-[#FED7CD] rounded-3xl w-full max-w-sm p-4 text-[#33252A] shadow-2xl space-y-3 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-[#FED7CD]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#EAF8F2] text-[#10B981] flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#264E36]">Mini-Diccionario de Fermentos</h3>
                  <p className="text-[10px] text-[#8C7E85]">Términos sencillos explicados sin enredos</p>
                </div>
              </div>
              <button
                onClick={() => setIsGlossaryOpen(false)}
                className="cursor-pointer p-1 rounded-full hover:bg-[#FED7CD] text-[#7D6F76]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 text-xs pr-1">
              <div className="bg-white p-2.5 rounded-xl border border-[#FED7CD]/80">
                <strong className="text-[#FF7262] block mb-0.5">🍄 SCOBY / Nódulos de Kéfir</strong>
                <p className="text-[#5C4A51] text-[11px] leading-relaxed">
                  Son colonias vivas de bacterias amigables y levaduras que parecen gomitas gelatinosas o pequeños granos. Se alimentan de la leche o del agua con azúcar y la transforman en un probiótico digestivo.
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-[#FED7CD]/80">
                <strong className="text-[#10B981] block mb-0.5">🥛 Suero de Leche</strong>
                <p className="text-[#5C4A51] text-[11px] leading-relaxed">
                  Es el líquido translúcido verde-amarillento que se separa de la masa blanca cuando el fermento madura. ¡Es súper saludable! Está lleno de proteínas limpias y electrolitos.
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-[#FED7CD]/80">
                <strong className="text-[#CA8A04] block mb-0.5">🌫️ Levadura de Kahm</strong>
                <p className="text-[#5C4A51] text-[11px] leading-relaxed">
                  Una película delgada, blanca y plana que a veces aparece en la superficie. <strong>No es moho y no es tóxica</strong>. Solo retírala con una cuchara limpia para que no cambie el sabor.
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-[#FED7CD]/80">
                <strong className="text-[#059669] block mb-0.5">🧪 Inocuidad Alimentaria</strong>
                <p className="text-[#5C4A51] text-[11px] leading-relaxed">
                  Significa que el alimento es 100% seguro y limpio para comer. Cuando controlas la temperatura y mantienes el frasco limpio, las bacterias buenas ganan siempre y no hay ningún peligro.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#FED7CD] flex justify-end">
              <button
                type="button"
                onClick={() => setIsGlossaryOpen(false)}
                className="cursor-pointer px-4 py-1.5 rounded-xl bg-[#10B981] text-white font-bold text-xs hover:bg-[#059669]"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== LOCAL AI CONFIGURATION MODAL ===================== */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#FFF8F6] border border-[#FED7CD] rounded-3xl w-full max-w-sm p-4 text-[#33252A] shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-[#FED7CD]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#EAF8F2] text-[#10B981] flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#264E36]">Conexión con tu IA Local</h3>
                  <p className="text-[10px] text-[#8C7E85]">En tu propia computadora</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="cursor-pointer p-1 rounded-full hover:bg-[#FED7CD] text-[#7D6F76]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 text-xs pr-1">
              {/* Beginner reassurance note */}
              <div className="p-2.5 rounded-2xl bg-[#EAF8F2] border border-[#C2EED9] text-[11px] text-[#264E36] leading-relaxed">
                <strong className="block text-[#059669] font-bold mb-0.5">
                  ¿No tienes IA local o no sabes qué es?
                </strong>
                ¡No necesitas instalar nada si no quieres! Cociflex ya incluye un motor de cálculo biológico que funciona automáticamente sin internet.
              </div>

              {/* How to use with Ollama */}
              <div className="p-2.5 rounded-2xl bg-white border border-[#FED7CD] text-[11px] text-[#5C4A51] space-y-1">
                <span className="font-bold text-[#FF7262] block">
                  Si deseas conectar tu propio modelo en PC:
                </span>
                <ol className="list-decimal list-inside space-y-0.5 text-[10px] leading-relaxed">
                  <li>Descarga gratis <strong>Ollama</strong> (ollama.com) o <strong>LM Studio</strong>.</li>
                  <li>En tu terminal escribe: <code className="bg-[#FFEFEA] px-1 py-0.5 rounded text-[#FF7262] font-mono">ollama run llama3.2</code></li>
                  <li>Toca "Probar Conexión" aquí abajo.</li>
                </ol>
              </div>

              {/* Provider selector */}
              <div>
                <label className="text-[10px] font-bold uppercase text-[#8C7E85] block mb-1">
                  Programa en tu computadora:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSaveConfig({
                      ...config,
                      provider: 'ollama',
                      endpoint: 'http://localhost:11434',
                      model: config.model || 'llama3.2',
                    })}
                    className={`cursor-pointer py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                      config.provider === 'ollama'
                        ? 'bg-[#EAF8F2] text-[#10B981] border-[#10B981]'
                        : 'bg-white text-[#7D6F76] border-[#FED7CD]'
                    }`}
                  >
                    🦙 Ollama
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveConfig({
                      ...config,
                      provider: 'lmstudio',
                      endpoint: 'http://localhost:1234/v1',
                      model: config.model || 'local-model',
                    })}
                    className={`cursor-pointer py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                      config.provider === 'lmstudio'
                        ? 'bg-[#EAF8F2] text-[#10B981] border-[#10B981]'
                        : 'bg-white text-[#7D6F76] border-[#FED7CD]'
                    }`}
                  >
                    ⚡ LM Studio
                  </button>
                </div>
              </div>

              {/* Endpoint URL */}
              <div>
                <label className="text-[10px] font-bold uppercase text-[#8C7E85] block mb-1">
                  Dirección local (Endpoint):
                </label>
                <input
                  type="text"
                  value={config.endpoint}
                  onChange={(e) => handleSaveConfig({ ...config, endpoint: e.target.value })}
                  placeholder="http://localhost:11434"
                  className="w-full bg-white border border-[#FED7CD] rounded-xl p-2 text-xs font-mono text-[#33252A] focus:outline-none"
                />
              </div>

              {/* Model name */}
              <div>
                <label className="text-[10px] font-bold uppercase text-[#8C7E85] block mb-1">
                  Nombre de tu modelo:
                </label>
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => handleSaveConfig({ ...config, model: e.target.value })}
                  placeholder="llama3.2, mistral, phi3..."
                  className="w-full bg-white border border-[#FED7CD] rounded-xl p-2 text-xs font-mono text-[#33252A] focus:outline-none"
                />
              </div>

              {/* Test Button */}
              <div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="cursor-pointer w-full py-2 px-3 rounded-xl border border-[#10B981] text-[#10B981] font-bold text-xs hover:bg-[#EAF8F2] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Comprobando conexión...</span>
                    </>
                  ) : (
                    <>
                      <Wifi className="w-3.5 h-3.5" />
                      <span>Probar Conexión con tu PC</span>
                    </>
                  )}
                </button>

                {testResult && (
                  <p className={`mt-2 text-[11px] p-2 rounded-xl border leading-relaxed ${
                    testResult.success
                      ? 'bg-[#E8F8F0] text-[#1E7E50] border-[#A7F3D0]'
                      : 'bg-[#FFF2EE] text-[#E11D48] border-[#FECDD3]'
                  }`}>
                    {testResult.message}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-[#FED7CD] flex justify-end">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="cursor-pointer px-4 py-1.5 rounded-xl bg-[#10B981] text-white font-bold text-xs hover:bg-[#059669]"
              >
                Guardar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
