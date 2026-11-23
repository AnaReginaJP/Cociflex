/**
 * Service to connect with Local AI (Ollama, LM Studio, LocalAI) running on the user's computer.
 * Designed for lightweight batch personalization, microclimate parameter calculation,
 * and sensory safety diagnosis for fermented food crafts.
 */

export interface LocalAiConfig {
  provider: 'ollama' | 'lmstudio' | 'custom';
  endpoint: string; // e.g. 'http://localhost:11434' or 'http://localhost:1234/v1'
  model: string;    // e.g. 'llama3.2', 'mistral', 'phi3', 'gemma2'
  isEnabled: boolean;
}

export const DEFAULT_LOCAL_AI_CONFIG: LocalAiConfig = {
  provider: 'ollama',
  endpoint: 'http://localhost:11434',
  model: 'llama3.2',
  isEnabled: true,
};

export interface FermentBatchPersonalizationInput {
  guideId: string;
  guideName: string;
  roomTempC: number;
  baseIngredientType: string; // e.g. "Leche entera pasteurizada", "Bebida vegetal", "Agua filtrada con piloncillo"
  flavorTarget: 'suave' | 'balanceado' | 'intenso_probiotico';
  ambientHumidity?: 'baja' | 'media' | 'alta';
}

export interface FermentPersonalizationResult {
  source: 'local_ai' | 'local_heuristic';
  adjustedIncubationHours: number;
  adjustedTempC: number;
  targetPh: number;
  estimatedCompletionTime: string;
  tips: string[];
  scientificSummary: string;
}

export interface SensoryDiagnosisInput {
  guideName: string;
  elapsedHours: number;
  smellDescription: string;
  appearanceDescription: string;
  bubblesLevel: 'ninguna' | 'ligeras' | 'abundantes' | 'separacion_suero';
}

export interface SensoryDiagnosisResult {
  source: 'local_ai' | 'local_heuristic';
  verdict: 'optimo' | 'precaucion' | 'descartar';
  verdictTitle: string;
  microbialAnalysis: string;
  recommendedAction: string;
}

/**
 * Test connectivity to the local AI endpoint.
 */
export async function testLocalAiConnection(config: LocalAiConfig): Promise<{ success: boolean; message: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const testUrl = config.provider === 'ollama' 
      ? `${config.endpoint.replace(/\/$/, '')}/api/tags`
      : `${config.endpoint.replace(/\/$/, '')}/models`;

    const res = await fetch(testUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return { 
        success: true, 
        message: `Conectado exitosamente con ${config.provider.toUpperCase()} en ${config.endpoint}` 
      };
    } else {
      return { 
        success: false, 
        message: `El servidor local respondió con código HTTP ${res.status}` 
      };
    }
  } catch (err: any) {
    return { 
      success: false, 
      message: `No se pudo conectar a ${config.endpoint}. Asegúrate de tener ${config.provider} encendido en tu computadora.` 
    };
  }
}

/**
 * Calculate personalized fermentation batch parameters using Local AI or biochemical fallback.
 */
export async function personalizeFermentBatch(
  input: FermentBatchPersonalizationInput,
  config: LocalAiConfig
): Promise<FermentPersonalizationResult> {
  // If local AI is configured and reachable, attempt local model inference
  if (config.isEnabled) {
    try {
      const prompt = `Actúa como especialista en microbiología y fermentación casera. 
Personaliza este lote casero:
- Fermento: ${input.guideName}
- Temperatura real de la cocina del usuario: ${input.roomTempC}°C
- Ingrediente base: ${input.baseIngredientType}
- Perfil deseado: ${input.flavorTarget}

Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin markdown ni texto adicional) con este esquema:
{
  "adjustedIncubationHours": número (horas estimadas de reposo),
  "adjustedTempC": número (temperatura de trabajo),
  "targetPh": número (pH de corte óptimo con 1 decimal),
  "tips": [array con 2 o 3 consejos prácticos],
  "scientificSummary": "explicación concisa en 2 renglones sobre cómo la temperatura de su cocina afecta la cinética de las bacterias"
}`;

      const aiResponse = await queryLocalModel(prompt, config);
      if (aiResponse) {
        const parsed = parseJsonSafely(aiResponse);
        if (parsed && typeof parsed.adjustedIncubationHours === 'number') {
          return {
            source: 'local_ai',
            adjustedIncubationHours: parsed.adjustedIncubationHours,
            adjustedTempC: parsed.adjustedTempC || input.roomTempC,
            targetPh: parsed.targetPh || 4.3,
            estimatedCompletionTime: formatHoursToTimeDisplay(parsed.adjustedIncubationHours),
            tips: Array.isArray(parsed.tips) ? parsed.tips : ['Mantén el frasco en penumbra.', 'Monitorea el aroma cada 6 horas.'],
            scientificSummary: parsed.scientificSummary || `Cinética microbiana calibrada localmente por tu modelo ${config.model}.`,
          };
        }
      }
    } catch {
      // Fall through to heuristic if local inference fails
    }
  }

  // Heuristic biochemical engine (Offline Fallback)
  return calculateHeuristicPersonalization(input);
}

/**
 * Diagnose fermentation batch health using Local AI or microbiological triage fallback.
 */
export async function diagnoseSensoryHealth(
  input: SensoryDiagnosisInput,
  config: LocalAiConfig
): Promise<SensoryDiagnosisResult> {
  if (config.isEnabled) {
    try {
      const prompt = `Actúa como bioartesano experto en inocuidad alimentaria.
Evalúa este lote de fermentación casera:
- Fermento: ${input.guideName}
- Horas transcurridas: ${input.elapsedHours}h
- Olor: ${input.smellDescription}
- Apariencia/Textura: ${input.appearanceDescription}
- Burbujeo: ${input.bubblesLevel}

Devuelve EXCLUSIVAMENTE un JSON válido (sin formato ni texto adicional) con:
{
  "verdict": "optimo" | "precaucion" | "descartar",
  "verdictTitle": "título corto (ej. Cultivo Sano y Efervescente)",
  "microbialAnalysis": "análisis microbiológico de 2 líneas",
  "recommendedAction": "indicación concreta de qué hacer ahora mismo"
}`;

      const aiResponse = await queryLocalModel(prompt, config);
      if (aiResponse) {
        const parsed = parseJsonSafely(aiResponse);
        if (parsed && parsed.verdict) {
          return {
            source: 'local_ai',
            verdict: parsed.verdict,
            verdictTitle: parsed.verdictTitle || 'Evaluación de Lote',
            microbialAnalysis: parsed.microbialAnalysis || 'Actividad biológica evaluada por tu modelo local.',
            recommendedAction: parsed.recommendedAction || 'Continúa supervisando la temperatura y el aroma.',
          };
        }
      }
    } catch {
      // Fall through
    }
  }

  return calculateHeuristicDiagnosis(input);
}

// ----------------- Helper Functions ----------------- //

async function queryLocalModel(prompt: string, config: LocalAiConfig): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout for local model

  try {
    if (config.provider === 'ollama') {
      const url = `${config.endpoint.replace(/\/$/, '')}/api/generate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt,
          stream: false,
          format: 'json',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      return data.response || null;
    } else {
      // OpenAI-compatible format (LM Studio, LocalAI, Jan, etc.)
      const url = `${config.endpoint.replace(/\/$/, '')}/chat/completions`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      return data.choices?.[0]?.message?.content || null;
    }
  } catch {
    return null;
  }
}

function parseJsonSafely(raw: string): any {
  try {
    const cleaned = raw.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function formatHoursToTimeDisplay(hours: number): string {
  if (hours <= 1.5) return `${Math.round(hours * 60)} minutos`;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = Math.round(hours % 24);
    return remHours > 0 ? `${days} día(s) y ${remHours} horas` : `${days} día(s)`;
  }
  return `${Math.round(hours * 10) / 10} horas`;
}

function calculateHeuristicPersonalization(input: FermentBatchPersonalizationInput): FermentPersonalizationResult {
  let baseHours = 24;
  let optimalTemp = 22;
  let targetPh = 4.3;

  if (input.guideId.includes('queso')) {
    baseHours = 1;
    optimalTemp = 35;
    targetPh = 6.3;
  } else if (input.guideId.includes('yogur')) {
    baseHours = 8.5;
    optimalTemp = 43;
    targetPh = 4.5;
  } else if (input.guideId.includes('kefir-agua')) {
    baseHours = 48;
    optimalTemp = 24;
    targetPh = 3.8;
  }

  // Arrhenius Q10 kinetic approximation: biological reaction speed doubles every ~10°C
  const deltaTemp = input.roomTempC - optimalTemp;
  const speedFactor = Math.pow(1.8, deltaTemp / 10);
  const adjustedHours = Math.max(0.5, Math.round((baseHours / speedFactor) * 10) / 10);

  // Flavor target adjust
  let finalHours = adjustedHours;
  if (input.flavorTarget === 'suave') {
    finalHours = Math.max(0.4, Math.round(adjustedHours * 0.8 * 10) / 10);
    targetPh += 0.2;
  } else if (input.flavorTarget === 'intenso_probiotico') {
    finalHours = Math.round(adjustedHours * 1.25 * 10) / 10;
    targetPh -= 0.2;
  }

  return {
    source: 'local_heuristic',
    adjustedIncubationHours: finalHours,
    adjustedTempC: input.roomTempC,
    targetPh: Math.round(targetPh * 10) / 10,
    estimatedCompletionTime: formatHoursToTimeDisplay(finalHours),
    tips: [
      input.roomTempC > optimalTemp + 3
        ? `Ambiente cálido (${input.roomTempC}°C): las bacterias acidificarán más velozmente. Revisa el lote unas horas antes.`
        : input.roomTempC < optimalTemp - 3
        ? `Ambiente fresco (${input.roomTempC}°C): la fermentación será más lenta y suave. Considera abrigar el frasco con un paño.`
        : `Temperatura ideal (${input.roomTempC}°C): equilibrio perfecto entre sabor láctico y textura.`,
      `Objetivo de pH de corte: ${Math.round(targetPh * 10) / 10} para asegurar inocuidad y probióticos activos.`,
    ],
    scientificSummary: `Aceleración biológica calibrada con la temperatura ambiental de tu cocina (${input.roomTempC}°C).`,
  };
}

function calculateHeuristicDiagnosis(input: SensoryDiagnosisInput): SensoryDiagnosisResult {
  const smellLower = input.smellDescription.toLowerCase();
  const appLower = input.appearanceDescription.toLowerCase();

  const badSmellKeywords = ['pútrido', 'podrido', 'amoniaco', 'fétido', 'basura', 'pescado', 'desagradable', 'nauseabundo'];
  const moldKeywords = ['pelusa', 'verde', 'negro', 'moho', 'velloso', 'esporas', 'puntos negros', 'puntos rosas'];

  const isBadSmell = badSmellKeywords.some(kw => smellLower.includes(kw));
  const hasMold = moldKeywords.some(kw => appLower.includes(kw));

  if (hasMold || isBadSmell) {
    return {
      source: 'local_heuristic',
      verdict: 'descartar',
      verdictTitle: 'Descarte Preventivo por Contaminación',
      microbialAnalysis: 'Se detectaron signos característicos de hongos filamentosos o descomposición anaeróbica no deseada.',
      recommendedAction: 'Desecha el lote por completo, lava y desinfecta el frasco con agua hirviendo antes de iniciar uno nuevo.',
    };
  }

  if (appLower.includes('velo blanco') || appLower.includes('capa blanca') || appLower.includes('película blanca')) {
    return {
      source: 'local_heuristic',
      verdict: 'precaucion',
      verdictTitle: 'Posible Levadura de Kahm (Inocua pero requiere atención)',
      microbialAnalysis: 'Una película blanca delgada y mate suele ser levadura silvestre de Kahm. No produce toxinas, pero puede alterar el sabor.',
      recommendedAction: 'Retira la fina capa con una cuchara estéril y procura cerrar o reducir la oxigenación en la superficie.',
    };
  }

  if (input.bubblesLevel === 'separacion_suero') {
    return {
      source: 'local_heuristic',
      verdict: 'precaucion',
      verdictTitle: 'Sobre-acidificación / Suero Separado',
      microbialAnalysis: 'El cultivo consumió toda la lactosa/azúcar disponible y el pH cayó significativamente, contrayendo la caseína.',
      recommendedAction: 'Lote perfectamente apto para consumo. Cuela inmediatamente o bate vigorosamente para recuperar textura cremosa.',
    };
  }

  return {
    source: 'local_heuristic',
    verdict: 'optimo',
    verdictTitle: 'Cultivo Activo y Saludable',
    microbialAnalysis: 'Aroma ácido fresco y textura consistente con fermentación simbiótica balanceada de lactobacilos benéficos.',
    recommendedAction: 'Continúa el proceso con normalidad hasta alcanzar tu tiempo o pH de corte deseado.',
  };
}
