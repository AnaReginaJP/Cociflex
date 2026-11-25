# Base de equivalencias

Archivo: `src/data/ingredientSubstitutes.ts`.

Contiene 11 ingredientes del catálogo. Cada entrada dice qué función cumple el ingrediente en el
platillo y con qué se puede sustituir. Las proporciones son aproximadas, de cocina casera: la
persona revisa cada equivalencia y anota su fuente cuando la tenga.

## Campos de una entrada

| Campo | Para qué sirve |
|---|---|
| `ingredient` | Nombre tal como aparece en las recetas. |
| `functions` | Función en el platillo: líquido, grasa, aglutinante, leudante, acidez, dulzor, sabor o espesor. Se usa para explicar el cambio. |
| `substitutes` | Opciones, en orden de preferencia. |
| `onlyFor: 'reposteria'` | Solo se propone en repostería (por ejemplo, huevo → yogur). |
| `avoidWhen` | Cuándo no conviene sustituir y por qué. |
| `source` | Fuente revisada por la persona. Hoy no se usa en ninguna entrada. |

## Campos de un sustituto

| Campo | Para qué sirve |
|---|---|
| `name` | Nombre canónico, como está en la despensa. |
| `ratio` | Cuánto sustituto equivale a 1 unidad del original. `1` = igual, `0.75` = tres cuartos. |
| `unit` | Unidad en la que se expresa el sustituto. |
| `fromUnit` | Unidad del original cuando no hay conversión posible (por ejemplo `pieza` → `taza`). |
| `note` | Qué cambia en sabor, textura o consistencia. |
| `allergens` | Alérgenos que aporta (`lácteo`, `gluten`...). |

## Cómo se lee

- **Leche entera → Yogur natural**: `ratio 1`, `unit 'taza'`. Una taza de leche = una taza de yogur.
- **Huevos → Yogur natural**: `ratio 0.25`, `unit 'taza'`, `fromUnit 'pieza'`. Cada huevo = ¼ de
  taza de yogur, y solo en repostería.

## Cómo agregar una equivalencia

1. Buscar el ingrediente en `INGREDIENT_SUBSTITUTES`; si ya está, agregar la opción en `substitutes`.
2. Si es nuevo, agregar la entrada completa: `ingredient`, `functions` y `substitutes`.
3. Escribir la `note` pensando en qué cambia de sabor o textura, no en pasos de cocina.
4. Llenar `allergens` si el sustituto aporta lácteo, gluten o huevo.
5. Anotar `avoidWhen` cuando haya un caso en el que no conviene.
6. Correr `npm run check`: las pruebas del motor usan esta base.

## Cuidado con los datos

Son equivalencias aproximadas. Si se agrega una proporción nueva, conviene probarla en la cocina
y, cuando se pueda, anotar la fuente en el campo `source`.
