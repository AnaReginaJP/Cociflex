# Motor de reglas

Archivo: `src/utils/ingredientSubstitution.ts`.

Es lógica pura: no usa React ni la IA. Así funciona aunque la IA esté apagada y se puede probar
con `node:test` (`ingredientSubstitution.test.ts`).

## Piezas

### `findSubstitutions(faltantes, despensa, contexto)`

Devuelve, como máximo, un sustituto por faltante.

- Solo propone ingredientes que la persona tiene (`isIngredientMatched`).
- Toma la primera opción de la lista que tenga: el orden es la preferencia.
- No repite el mismo faltante dos veces.
- Respeta `onlyFor: 'reposteria'`: el huevo solo se sustituye en pasteles, panes y masas.

### `substitutionAmount(ingrediente, opción)`

Ajusta la cantidad. Dos casos:

1. **Unidades convertibles** (taza ↔ cucharada): convierte a la unidad del sustituto, aplica
   `ratio` y regresa a la unidad de la receta, para que se lea "3 cucharadas" y no "0.18 tazas".
2. **Unidades no convertibles** (pieza → taza): usa `fromUnit` y la proporción de la base.

Si no hay forma de calcularlo, devuelve `Al gusto`.

### `matchWithSubstitutions(resultado, despensa)`

Recalcula el porcentaje contando como cubierto el faltante que ya tiene sustituto.

- Ejemplo: 4 ingredientes, 3 en casa = 75 %. Si el faltante se cubre, sube a 100 %.
- Nunca baja del original ni pasa de 100.

### `missingWithoutSubstitute(faltantes, despensa, contexto)`

Filtra los faltantes que sí vale la pena consultar a la IA:

- Descarta sal, pimienta, agua y condimentos.
- Fuera de repostería no consulta el huevo: en huevos a la mexicana o chilaquiles no hay un
  sustituto razonable.

## Regla de oro

No toca `recipeMatcher.ts`: lo usa tal como está y devuelve un resultado aparte, para no cambiar
el porcentaje que ya ven las demás partes de la app.
