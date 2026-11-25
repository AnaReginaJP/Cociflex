// "Modo Salvavidas": rescue for common cooking mistakes (taste and texture only).
// Everything here works without AI: a table of safe, common fixes plus the food-safety rules
// that decide when a dish must NOT be rescued. The local AI (src/ai/rescueAi.ts) is optional.
import { normalizeText } from './recipeMatcher.ts';

export type RescueProblemId =
  | 'muy-salado'
  | 'muy-picante'
  | 'muy-liquido'
  | 'muy-espeso'
  | 'se-corto'
  | 'se-quemo'
  | 'quedo-crudo'
  | 'ingrediente-demas'
  | 'ingrediente-faltante'
  | 'otro';

export interface RescueProblem {
  id: RescueProblemId;
  label: string;
}

export const RESCUE_PROBLEMS: RescueProblem[] = [
  { id: 'muy-salado', label: 'Muy salado' },
  { id: 'muy-picante', label: 'Muy picante' },
  { id: 'muy-liquido', label: 'Muy líquido' },
  { id: 'muy-espeso', label: 'Muy espeso' },
  { id: 'se-corto', label: 'Se cortó la mezcla' },
  { id: 'se-quemo', label: 'Se quemó un poco' },
  { id: 'quedo-crudo', label: 'Quedó crudo' },
  { id: 'ingrediente-demas', label: 'Me pasé de un ingrediente' },
  { id: 'ingrediente-faltante', label: 'Me faltó un ingrediente' },
  { id: 'otro', label: 'Otro' },
];

export const MAX_RESCUE_DESCRIPTION = 500;

export function isRescueProblemId(value: unknown): value is RescueProblemId {
  return RESCUE_PROBLEMS.some((p) => p.id === value);
}

export function rescueProblemLabel(id: RescueProblemId): string {
  return RESCUE_PROBLEMS.find((p) => p.id === id)?.label ?? 'Otro';
}

// ---------------------------------------------------------------------------
// Ingredient matching (names without accents, singular or plural)
// ---------------------------------------------------------------------------

const wordsOf = (text: string): string[] => normalizeText(text).split(/[^a-z0-9]+/).filter(Boolean);

/** "limon" and "limones", "tortilla" and "tortillas" count as the same word. */
const sameWord = (a: string, b: string): boolean =>
  a === b || a === `${b}s` || a === `${b}es` || b === `${a}s` || b === `${a}es`;

/** Words that do not identify an ingredient by themselves. */
const FILLER_WORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'con', 'sin', 'o', 'y', 'en', 'al', 'para',
  'picado', 'picada', 'picados', 'picadas', 'rallado', 'rallada', 'rallados', 'ralladas',
  'cocido', 'cocida', 'cocidos', 'cocidas', 'caliente', 'frio', 'fria',
]);

/** Names from `names` that contain the ingredient `keyword` (for example "limon" or "queso"). */
export function findIngredient(keyword: string, names: string[]): string[] {
  const key = wordsOf(keyword);
  if (key.length === 0) return [];
  return names.filter((name) => wordsOf(name).some((w) => key.some((k) => sameWord(w, k))));
}

/**
 * True when every meaningful word of `name` appears in the known ingredient names.
 * "crema" is known if the person has "Crema ácida"; "leche de coco" is not known if they
 * only have "Leche entera". Water is always known.
 */
export function isIngredientKnown(name: string, known: string[]): boolean {
  const knownWords = [...known, 'Agua'].flatMap(wordsOf);
  const words = wordsOf(name).filter((w) => !FILLER_WORDS.has(w));
  if (words.length === 0) return false;
  return words.every((w) => knownWords.some((k) => sameWord(w, k)));
}

// ---------------------------------------------------------------------------
// Table of common, safe fixes
// ---------------------------------------------------------------------------

interface FixRule {
  title: string;
  instruction: string;
  /** Ingredients this fix uses; having any one of them is enough. Empty: nothing special is needed. */
  uses?: string[];
}

interface ProblemRules {
  fixes: FixRule[];
  warnings: string[];
}

const RULES: Record<RescueProblemId, ProblemRules> = {
  'muy-salado': {
    fixes: [
      {
        title: 'Dilúyelo',
        instruction:
          'Agrega agua caliente o caldo sin sal, un cucharón a la vez. Mezcla, prueba y repite hasta que el sabor te guste.',
      },
      {
        title: 'Aumenta la base sin sal',
        instruction:
          'Agrega más del ingrediente principal sin sazonar (arroz, papa o verduras cocidas, frijoles sin sal) y reparte la sal entre más comida.',
        uses: ['arroz', 'papa', 'frijol', 'zanahoria', 'calabacita', 'jitomate'],
      },
      {
        title: 'Suavízalo con algo cremoso',
        instruction:
          'Una cucharada de crema, un poco de queso fresco o unos trozos de aguacate hacen que la sal se note menos. Agrégalo al servir.',
        uses: ['crema', 'queso', 'aguacate', 'yogur', 'mantequilla'],
      },
      {
        title: 'Equilíbralo con algo ácido',
        instruction:
          'Unas gotas de limón o un chorrito de vinagre no quitan la sal, pero la hacen menos notoria. Agrega poco y prueba.',
        uses: ['limón', 'vinagre'],
      },
      {
        title: 'Acompáñalo con algo sin sal',
        instruction: 'Sírvelo con arroz blanco, tortillas o pan sin sal para que cada bocado quede más suave.',
        uses: ['arroz', 'tortilla', 'pan', 'bolillo'],
      },
    ],
    warnings: [
      'No lo hiervas para que se "evapore" la sal: el agua se va, pero la sal se queda y se concentra.',
      'Ya no agregues más sal y prueba después de cada ajuste.',
    ],
  },
  'muy-picante': {
    fixes: [
      {
        title: 'Agrega algo cremoso o con grasa',
        instruction:
          'Crema, leche, queso o aguacate calman el picor. Incorpora una cucharada, mezcla y prueba.',
        uses: ['crema', 'leche', 'queso', 'aguacate', 'yogur'],
      },
      {
        title: 'Dilúyelo',
        instruction:
          'Agrega agua caliente, caldo o más jitomate, poco a poco, para repartir el picante entre más comida. Ajusta la sal al final.',
      },
      {
        title: 'Equilíbralo con algo dulce o ácido',
        instruction: 'Una pizca de azúcar o miel, o unas gotas de limón, hacen que el picor se sienta menos.',
        uses: ['azúcar', 'miel', 'piloncillo', 'limón'],
      },
      {
        title: 'Sírvelo con algo que lo suavice',
        instruction: 'Acompáñalo con arroz, tortillas, frijoles o crema para que cada bocado pique menos.',
        uses: ['arroz', 'tortilla', 'frijol', 'crema'],
      },
    ],
    warnings: [
      'No le agregues más chile.',
      'Si es para niños, aparta una porción antes de seguir ajustando el resto.',
    ],
  },
  'muy-liquido': {
    fixes: [
      {
        title: 'Redúcelo a fuego medio',
        instruction:
          'Cocina sin tapa a fuego medio-bajo, moviendo de vez en cuando, hasta que espese. Prueba la sal al final.',
      },
      {
        title: 'Espésalo con maicena',
        instruction:
          'Disuelve 1 cucharada de maicena en 3 cucharadas de agua fría, agrégala poco a poco moviendo y hierve 1 o 2 minutos.',
        uses: ['maicena', 'maizena', 'fécula'],
      },
      {
        title: 'Espésalo con harina',
        instruction:
          'Mezcla 1 cucharada de harina con 3 cucharadas de agua fría hasta que no queden grumos, agrégala moviendo y deja hervir 3 a 5 minutos para que no sepa a harina cruda.',
        uses: ['harina'],
      },
      {
        title: 'Aplasta un poco de la base',
        instruction:
          'Aplasta con un tenedor un poco de frijol, papa o arroz cocido dentro de la olla; ayuda a que el caldo agarre cuerpo.',
        uses: ['frijol', 'papa', 'arroz', 'lenteja'],
      },
    ],
    warnings: ['Nunca eches el polvo (maicena o harina) directo al caliente: se hacen grumos. Siempre disuélvelo en agua fría.'],
  },
  'muy-espeso': {
    fixes: [
      {
        title: 'Agrega líquido caliente poco a poco',
        instruction:
          'Agrega agua caliente o caldo, un cucharón a la vez, moviendo y probando, hasta lograr la textura que quieres.',
      },
      {
        title: 'Aligéralo con leche',
        instruction: 'En cremas, purés y masas, agrega una cucharada de leche tibia a la vez y mezcla bien.',
        uses: ['leche'],
      },
      {
        title: 'Corrige la sal al final',
        instruction: 'Al diluir baja el sabor: prueba y, si hace falta, ajusta la sal o los condimentos hasta el final.',
      },
    ],
    warnings: ['Agrega el líquido de a poquito: es fácil pasarte y dejarlo muy aguado.'],
  },
  'se-corto': {
    fixes: [
      {
        title: 'Retíralo del fuego ya',
        instruction: 'Apaga la estufa y aparta la olla. Con el calor sigue separándose.',
      },
      {
        title: 'Bátelo con agua fría o leche',
        instruction:
          'En un recipiente limpio pon 1 cucharada de agua fría o de leche y bate fuerte con un globo o tenedor, agregando la mezcla cortada poco a poco.',
      },
      {
        title: 'Licúalo un momento',
        instruction:
          'Si es una salsa o crema que se separó, licúala unos segundos; suele volver a juntarse. Después caliéntala a fuego bajo, sin dejar que hierva.',
      },
    ],
    warnings: [
      'Si la leche o la crema ya olía mal antes de cocinarla, no la uses: eso no es un corte por el calor.',
      'La próxima vez usa fuego bajo y mueve sin parar.',
    ],
  },
  'se-quemo': {
    fixes: [
      {
        title: 'Cambia de olla sin raspar',
        instruction:
          'Apaga el fuego y pasa lo que no está pegado a otra olla, sin raspar el fondo. Lo negro o pegado se queda en la olla original.',
      },
      {
        title: 'Prueba una cucharada',
        instruction:
          'Si el sabor a quemado es muy leve, puedes seguir. Si domina todo el platillo, es mejor no servirlo.',
      },
      {
        title: 'Suaviza el sabor con algo fresco',
        instruction:
          'Un poco de jitomate, crema o unas gotas de limón ayudan a tapar un quemado leve. Agrega poco y prueba.',
        uses: ['jitomate', 'crema', 'limón', 'leche'],
      },
    ],
    warnings: [
      'Las partes negras o carbonizadas no se comen: se tiran.',
      'Si todo el platillo está negro o sabe a carbón, no se rescata.',
    ],
  },
  'quedo-crudo': {
    fixes: [
      {
        title: 'Sigue cocinando',
        instruction:
          'Regresa al fuego, baja a medio-bajo y tapa para que se cocine parejo. Revisa cada 5 minutos.',
      },
      {
        title: 'Si es arroz, frijol o verduras',
        instruction: 'Agrega un poco de agua caliente o caldo (como 1/4 de taza), tapa y cocina 5 minutos más.',
      },
      {
        title: 'Si es pastel o pan',
        instruction:
          'Baja la temperatura del horno, cubre la parte de arriba con papel aluminio y hornea más tiempo. Está listo cuando un palillo sale limpio.',
      },
      {
        title: 'Si es pollo, carne o huevo',
        instruction:
          'Cocínalo hasta que no queden partes rosas ni jugos rojos. Si tienes termómetro, el pollo debe llegar a 74 °C por dentro.',
      },
    ],
    warnings: ['Carne, pollo, pescado y huevo crudos no se comen: se siguen cocinando hasta que estén bien cocidos.'],
  },
  'ingrediente-demas': {
    fixes: [
      {
        title: 'Reparte con más base',
        instruction:
          'Agrega más del resto de la receta (la base, sin el ingrediente de más) para que ese sabor se reparta.',
      },
      {
        title: 'Si fue sal o picante',
        instruction: 'Vuelve a empezar con el botón "Muy salado" o "Muy picante": tienen arreglos específicos.',
      },
      {
        title: 'Si fue algo ácido',
        instruction:
          'Una pizca de azúcar o un poco de grasa (crema, aceite o aguacate) suaviza lo ácido. Agrega poco y prueba.',
        uses: ['azúcar', 'miel', 'crema', 'aceite', 'aguacate'],
      },
      {
        title: 'Si fue algo dulce',
        instruction: 'Unas gotas de limón o una pizca de sal equilibran lo dulce. Agrega poco y prueba.',
        uses: ['limón', 'vinagre'],
      },
      {
        title: 'Haz una tanda más grande',
        instruction: 'Prepara más del resto de la receta y reparte en dos. Lo que sobre, ya cocinado, puedes guardarlo en el refri o congelarlo.',
      },
    ],
    warnings: ['Corrige de a poco y prueba después de cada ajuste.'],
  },
  'ingrediente-faltante': {
    fixes: [
      {
        title: 'Agrégalo ahora',
        instruction:
          'Si el platillo sigue en la estufa, agrega el ingrediente que faltó, mezcla y deja cocinar 5 minutos para que se integre.',
      },
      {
        title: 'Agrégalo al servir',
        instruction:
          'Si ya está listo y lo que faltó es un condimento, hierba, limón o queso, agrégalo directo en el plato.',
      },
      {
        title: 'Usa algo parecido que sí tengas',
        instruction:
          'Elige de tu lista algo con la misma función (para dar sabor, humedad o cuerpo) y agrégalo en poca cantidad, probando.',
      },
    ],
    warnings: [
      'Si lo que faltó es el huevo, la harina o el polvo para hornear de algo que ya se horneó, no se puede corregir: es mejor hacerlo de nuevo.',
    ],
  },
  otro: {
    fixes: [
      {
        title: 'Detente y prueba',
        instruction:
          'Baja el fuego y prueba una cucharada: ¿es sal, picor, acidez, dulzor o textura? Identificarlo te dice qué corregir.',
      },
      {
        title: 'Corrige una sola cosa a la vez',
        instruction:
          'Haz un solo ajuste, en cantidad pequeña (una cucharadita), mezcla bien y vuelve a probar antes de seguir.',
      },
    ],
    warnings: ['Cuéntanos con más detalle qué pasó y pide ayuda a la IA local para una respuesta más a tu medida.'],
  },
};

// ---------------------------------------------------------------------------
// Food safety: when NOT to rescue
// ---------------------------------------------------------------------------

export interface SafetyVerdict {
  level: 'discard' | 'keep-cooking';
  message: string;
}

const DISCARD_SPOILED_MESSAGE =
  'Por seguridad, este platillo no se rescata. Si tiene moho, huele mal, está echado a perder o estuvo horas fuera del refri, lo más seguro es tirarlo. El Modo Salvavidas solo corrige sabor y textura de comida en buen estado.';
const DISCARD_BURNED_MESSAGE =
  'Si todo el platillo está negro o sabe a carbón, no se rescata: es mejor tirarlo y empezar de nuevo. Las partes quemadas o carbonizadas no se comen.';
const KEEP_COOKING_MESSAGE =
  'No lo comas todavía: sigue cocinando hasta que esté bien cocido por dentro. La carne, el pollo, el pescado y el huevo crudos no son seguros. Si tienes termómetro, busca 74 °C por dentro; si no, que no queden partes rosas ni jugos rojos.';

const SPOILED_PATTERNS: RegExp[] = [
  /\bmoho\w*/,
  /\bpodrid\w*/,
  /echad[oa]s?\s+a\s+perder/,
  /descompuest\w*/,
  /\brancio\w*/,
  /\bcaducad\w*/,
  /\bvencid\w*/,
  /pasad[oa]s?\s+de\s+fecha/,
  /\bmal\s+olor\b/,
  /\bolor\s+(muy\s+)?(raro|feo|extran\w*|desagradable|rancio|agrio|a\s+podrid\w*)/,
  /\bhuel[eo]\w*\s+(muy\s+|bien\s+|algo\s+|un\s+poco\s+)?(raro|mal|feo|agri\w*|rancio|extran\w*|a\s+podrid\w*|a\s+echad\w*)/,
  /\bmanchas?\s+(verdes?|blancas?|negras?|azules?)/,
  /\bpelusa\b/,
];

const OUTSIDE_FRIDGE = /(fuera|afuera|sin\s+refri\w*|sin\s+refrigerar|temperatura\s+ambiente|\bmesa\b|\bbarra\b|mostrador|encimera)/;
const HOURS = /(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|diez|doce|varias|muchas|unas)\s+horas?/;
const OVERNIGHT = /(toda\s+la\s+noche|de\s+un\s+dia\s+para\s+otro|desde\s+ayer)/;
const OVERNIGHT_OUT = /(fuera|afuera|sin\s+refri\w*|sin\s+refrigerar|temperatura\s+ambiente|\bmesa\b|\bbarra\b|estufa|cocina|mostrador)/;

const RAW_PATTERN = /\bcrud[oa]s?\b|sin\s+cocer|sin\s+cocinar|poco\s+cocid\w*|\brosad[oa]s?\b|\brosa\b|jugos?\s+rojos?|\bsangre\b|\bsangra\w*/;
const MEAT_PATTERN = /pollo|pechuga|muslo|pierna|\bcarne\b|\bres\b|cerdo|puerco|cochinita|pescado|camaron\w*|\batun\b|salmon|chorizo|salchicha|jamon|tocino|huevo\w*|molida|bistec|arrachera/;

const BURNED_SEVERE =
  /carboniz\w*|\bcarbon\b|todo\s+(se\s+)?quem\w*|(muy|mucho|totalmente|completamente)\s+quemad\w*|\bnegr[oa]s?\b|ceniza|\bhumo\b/;

/**
 * Decides whether the dish can be rescued. `discard`: it must not be eaten or rescued.
 * `keep-cooking`: raw meat, poultry, fish or egg; the only advice is to keep cooking.
 * `null`: the normal rescue applies.
 */
export function assessSafety(input: {
  problem: RescueProblemId;
  text?: string;
  recipeIngredients?: string[];
}): SafetyVerdict | null {
  const t = normalizeText(input.text ?? '');

  if (SPOILED_PATTERNS.some((p) => p.test(t))) return { level: 'discard', message: DISCARD_SPOILED_MESSAGE };

  if ((HOURS.test(t) && OUTSIDE_FRIDGE.test(t)) || (OVERNIGHT.test(t) && OVERNIGHT_OUT.test(t))) {
    return { level: 'discard', message: DISCARD_SPOILED_MESSAGE };
  }

  const burned = input.problem === 'se-quemo' || /quem\w+/.test(t);
  if (burned && BURNED_SEVERE.test(t.replace(/frijol\w*\s+negr\w*/g, ''))) {
    return { level: 'discard', message: DISCARD_BURNED_MESSAGE };
  }

  const recipeHasMeat = (input.recipeIngredients ?? []).some((name) => MEAT_PATTERN.test(normalizeText(name)));
  if (RAW_PATTERN.test(t) && (MEAT_PATTERN.test(t) || recipeHasMeat)) {
    return { level: 'keep-cooking', message: KEEP_COOKING_MESSAGE };
  }
  if (input.problem === 'quedo-crudo' && recipeHasMeat) {
    return { level: 'keep-cooking', message: KEEP_COOKING_MESSAGE };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Advice
// ---------------------------------------------------------------------------

export interface RescueFix {
  title: string;
  instruction: string;
  /** Ingredients this fix uses (any one is enough). Empty: nothing special is needed. */
  needs: string[];
  /** Ingredients the person has that this fix can use. */
  have: string[];
  available: boolean;
}

export interface RescueAdvice {
  problem: RescueProblem;
  safety: SafetyVerdict | null;
  fixes: RescueFix[];
  warnings: string[];
}

/** Common fixes for a problem, with the ones the person can do right now first. */
export function buildRescueAdvice(input: {
  problem: RescueProblemId;
  text?: string;
  available?: string[];
  recipeIngredients?: string[];
}): RescueAdvice {
  const problem = { id: input.problem, label: rescueProblemLabel(input.problem) };
  const safety = assessSafety({
    problem: input.problem,
    text: input.text,
    recipeIngredients: input.recipeIngredients,
  });

  // Nothing to rescue: no fixes, only the verdict.
  if (safety?.level === 'discard') return { problem, safety, fixes: [], warnings: [] };

  // Raw meat or egg: the only advice is to keep cooking.
  const rules = safety?.level === 'keep-cooking' ? RULES['quedo-crudo'] : RULES[input.problem];
  const available = input.available ?? [];

  const fixes: RescueFix[] = rules.fixes.map((rule) => {
    const needs = rule.uses ?? [];
    const have = needs.length === 0 ? [] : [...new Set(needs.flatMap((keyword) => findIngredient(keyword, available)))];
    return {
      title: rule.title,
      instruction: rule.instruction,
      needs,
      have,
      available: needs.length === 0 || have.length > 0,
    };
  });
  // Stable sort: fixes the person can do now go first, the rest keep the table's order.
  const ordered = [...fixes.filter((f) => f.available), ...fixes.filter((f) => !f.available)];

  return { problem, safety, fixes: ordered, warnings: rules.warnings };
}

/** Checks what the person wrote. Returns the problem to use or a message to show. */
export function checkRescueInput(
  problem: RescueProblemId | null,
  description: string
): { ok: true; problem: RescueProblemId; description: string } | { ok: false; error: string } {
  const text = description.trim();
  if (text.length > MAX_RESCUE_DESCRIPTION) {
    return { ok: false, error: `Tu descripción es muy larga (máximo ${MAX_RESCUE_DESCRIPTION} caracteres).` };
  }
  if (!problem) {
    if (!text) return { ok: false, error: 'Elige qué pasó con tu platillo o cuéntalo con tus palabras.' };
    return { ok: true, problem: 'otro', description: text };
  }
  if (problem === 'otro' && !text) {
    return { ok: false, error: 'Cuéntanos qué pasó para poder ayudarte.' };
  }
  return { ok: true, problem, description: text };
}
