export type WorkspaceTab = 'inicio' | 'cocina' | 'fermentos' | 'comunidad' | 'mandado';

export interface WalkthroughStep {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  description: string;
  actionTip: string;
  targetTab: WorkspaceTab;
  targetSelector: string;
}

export const WALKTHROUGH_STORAGE_KEY = 'cociflex_walkthrough_completed_v1';

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'explore-home',
    stepNumber: 1,
    title: 'Explora recetas con lo que ya tienes',
    subtitle: 'Inicio y Buscador Inteligente',
    description:
      'Aquí ves el catálogo de recetas caseras listas para preparar. Filtra por categoría (Rápidas, Postres, Vegetarianas) o busca un ingrediente que quieras rescatar hoy.',
    actionTip: 'Prueba buscar "tortillas" o haz clic en cualquier tarjeta para abrir el Modo Cocina.',
    targetTab: 'inicio',
    targetSelector: '[data-tour="home-search"]',
  },
  {
    id: 'recipe-to-fit',
    stepNumber: 2,
    title: '¿No te alcanza un ingrediente? Ajusta la receta',
    subtitle: 'Receta a tu medida',
    description:
      'Abre cualquier receta y entra a "¿No te alcanza algún ingrediente?". Escribe cuánto tienes y CociFlex reduce toda la receta en la misma proporción: porciones, cantidades y medidas de cocina. Si quieres, la IA local reescribe los pasos.',
    actionTip: 'Abre el Pastel de Zanahoria, elige Harina de trigo y escribe 1: verás la receta al 50\u00a0% y cuánto te falta para hacerla completa.',
    targetTab: 'inicio',
    targetSelector: '[data-tour="recipe-grid"]',
  },
  {
    id: 'pantry-matcher',
    stepNumber: 3,
    title: 'Marca tu alacena y calcula coincidencias',
    subtitle: 'Mi Cocina — Motor Cero Desperdicio',
    description:
      'Selecciona los ingredientes disponibles en tu refrigerador. CociFlex ordena automáticamente las recetas según tu porcentaje de coincidencia y te indica qué te falta.',
    actionTip: 'Activa o agrega ingredientes de tu casa y pulsa "+" en faltantes para mandarlos a tu lista.',
    targetTab: 'cocina',
    targetSelector: '[data-tour="pantry-engine"]',
  },
  {
    id: 'pantry-expiry',
    stepNumber: 4,
    title: 'Anota qué caduca y salva tu comida',
    subtitle: 'Mi Cocina — Despensa con caducidad',
    description:
      'Registra cuándo caduca lo que tienes. Verás alertas de color (hoy o mañana, en 3 días o menos, o bien) y recetas para aprovechar lo que está por echarse a perder, con un botón para mandar a Mandado solo lo que te falta.',
    actionTip: 'Marca un ingrediente en tu alacena, elige "Hoy" en su fecha y mira qué platillos te propone CociFlex. Revisa siempre la fecha de la etiqueta.',
    targetTab: 'cocina',
    targetSelector: '[data-tour="pantry-expiry"]',
  },
  {
    id: 'ai-recipe-studio',
    stepNumber: 5,
    title: 'Crea una receta original con IA',
    subtitle: 'Generador Culinario Personalizado',
    description:
      '¿Tus ingredientes no coinciden con una receta clásica? Usa "Crear con IA" para inventar un platillo a medida respetando tu tiempo, porciones y dieta.',
    actionTip: 'Presiona el botón "Crear Receta con IA" cuando quieras improvisar sin desperdiciar comida.',
    targetTab: 'cocina',
    targetSelector: '[data-tour="ai-cta"]',
  },
  {
    id: 'local-ai-ferments',
    stepNumber: 6,
    title: 'Fermenta con ciencia e IA local privada',
    subtitle: 'Fermentos y BioAsistente',
    description:
      'Ajusta tiempos de fermentación según el clima de tu cocina, consulta el glosario para principiantes y verifica la seguridad (pH y temperatura) con tu simulador.',
    actionTip: 'Mueve la temperatura ambiente en el BioAsistente o prueba el Simulador de Inocuidad.',
    targetTab: 'fermentos',
    targetSelector: '[data-tour="ferment-assistant"]',
  },
  {
    id: 'community-and-mandado',
    stepNumber: 7,
    title: 'Valida recetas en comunidad y arma tu mandado',
    subtitle: 'Comunidad Certificada (3 Likes) & Mandado',
    description:
      'En Comunidad las recetas requieren 3 validaciones reales antes de certificarse. En Mandado se agrupan automáticamente los insumos que te faltaron al cocinar.',
    actionTip: 'Puedes repetir esta guía cuando quieras desde el botón "Guía Interactiva" en la barra superior.',
    targetTab: 'comunidad',
    targetSelector: '[data-tour="community-mandado"]',
  },
];

export function clampWalkthroughIndex(index: number, total: number = WALKTHROUGH_STEPS.length): number {
  if (total <= 0) return 0;
  if (Number.isNaN(index)) return 0;
  return Math.max(0, Math.min(total - 1, Math.trunc(index)));
}

export function getNextWalkthroughIndex(currentIndex: number, total: number = WALKTHROUGH_STEPS.length): number {
  return clampWalkthroughIndex(currentIndex + 1, total);
}

export function getPrevWalkthroughIndex(currentIndex: number, total: number = WALKTHROUGH_STEPS.length): number {
  return clampWalkthroughIndex(currentIndex - 1, total);
}

export function getWalkthroughProgressPercent(currentIndex: number, total: number = WALKTHROUGH_STEPS.length): number {
  if (total <= 0) return 0;
  const clamped = clampWalkthroughIndex(currentIndex, total);
  return Math.round(((clamped + 1) / total) * 100);
}

export function shouldAutoStartWalkthrough(search: string, storedCompletionValue: string | null): boolean {
  const normalizedSearch = (search || '').toLowerCase();
  if (
    normalizedSearch.includes('walkthrough=1') ||
    normalizedSearch.includes('autostart=1') ||
    normalizedSearch.includes('tour=1')
  ) {
    return true;
  }
  if (
    normalizedSearch.includes('walkthrough=0') ||
    normalizedSearch.includes('autostart=0') ||
    normalizedSearch.includes('tour=0')
  ) {
    return false;
  }
  return storedCompletionValue !== 'true';
}
