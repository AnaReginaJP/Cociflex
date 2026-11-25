// Approximate prices (MXN) used only to estimate the cost of the weekly menu.
// IMPORTANT: this is a first estimate. Review each price against a source (Profeco, the
// supermarket or your own receipts) and update PRICES_INFO when you do.
//
// Prices are per ONE unit of the recipe ("pieza", "g", "taza"...). The ingredient name is the one
// used in the catalog (without accents or capitals it still matches).

export const PRICES_INFO = {
  /** Month and year the prices were checked. */
  fecha: 'noviembre 2026',
  /** false until someone compares the prices against a real source. */
  revisados: false,
  fuente: 'Estimación inicial, pendiente de revisar con Profeco o tickets del súper',
};

/** price per unit, by ingredient name and unit (singular: "pieza", "taza", "g"...). */
export const INGREDIENT_PRICES: Record<string, Record<string, number>> = {
  'Tortillas de maíz': { pieza: 0.8 },
  'Tortillas de maíz / Tostadas': { pieza: 1 },
  Huevos: { pieza: 3.2 },
  Jitomate: { pieza: 4 },
  Cebolla: { pieza: 5 },
  Ajo: { diente: 0.8 },
  'Chile serrano / verde': { pieza: 0.8 },
  'Queso Fresco': { g: 0.19 },
  'Queso Fresco o Parmesano': { g: 0.2 },
  'Queso Manchego o Oaxaca': { g: 0.22 },
  'Crema ácida': { cucharada: 2.2, taza: 33 },
  'Aceite vegetal': { cucharada: 0.7, taza: 11 },
  'Frijoles cocidos': { taza: 8 },
  Sal: { pizca: 0.1 },
  'Sal y pimienta': { pizca: 0.3 },
  'Chile chipotle o pasilla': { pieza: 3 },
  'Chile chipotle': { pieza: 3 },
  'Caldo de pollo o verduras': { taza: 2.5 },
  Aguacate: { pieza: 20 },
  Epazote: { ramita: 1 },
  'Pollo / Pechuga': { g: 0.13 },
  Calabacitas: { pieza: 6 },
  'Elote / granos de maíz': { taza: 12 },
  Zanahorias: { pieza: 4 },
  Papas: { pieza: 6 },
  'Pasta / Espagueti': { g: 0.045 },
  Arroz: { taza: 8 },
  'Harina de trigo': { taza: 7 },
  Azúcar: { taza: 12, cucharadita: 0.3 },
  'Leche entera': { taza: 6.5 },
  'Pan de caja / bolillo': { rebanada: 2 },
};

/** Accent-free, lower-case key so "Azúcar" and "azucar" are the same ingredient. */
function priceKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

const PRICE_INDEX: Map<string, Record<string, number>> = new Map(
  Object.entries(INGREDIENT_PRICES).map(([name, prices]) => [priceKey(name), prices])
);

/** Price of one unit of an ingredient, or null when there is no price for it. */
export function getUnitPrice(ingredientName: string, unitKey: string): number | null {
  const prices = PRICE_INDEX.get(priceKey(ingredientName));
  const price = prices?.[unitKey];
  return typeof price === 'number' ? price : null;
}
