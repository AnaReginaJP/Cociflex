# Sustitución inteligente de ingredientes

Parte de **Abdriel Mendiola Aragon** (equipo Nodo 4) en CociFlex.

Cuando una receta pide un ingrediente que no está en la despensa, CociFlex busca un sustituto
que la persona sí tenga, explica qué función cumple el ingrediente original, ajusta la cantidad
e indica el nuevo porcentaje de coincidencia. Si la base de equivalencias no cubre el caso, se
puede consultar a la IA local, que solo puede proponer ingredientes de la despensa.

## Piezas

| Archivo | Qué hace |
|---|---|
| `src/data/ingredientSubstitutes.ts` | Base de equivalencias: 11 ingredientes con su función, sustitutos, proporción, nota y alérgenos. |
| `src/utils/ingredientSubstitution.ts` | Motor de reglas: elige el sustituto, ajusta la cantidad y recalcula el porcentaje. Funciona sin IA. |
| `src/ai/substitutionAi.ts` | Consulta opcional a la IA local y revisión de su respuesta contra la despensa. |
| `src/components/SubstitutionHint.tsx` | Los dos componentes de pantalla: el aviso de sustitución y el panel de IA. |
| `server.ts` (ruta `POST /api/ai/sustitutos`) | Atiende la consulta de IA. |

## Cómo funciona, en orden

1. El motor de coincidencias (`recipeMatcher.ts`) dice qué ingredientes faltan.
2. Para cada faltante, el motor de reglas busca en la base un sustituto que la persona tenga.
3. Si lo encuentra, ajusta la cantidad con la proporción de la base.
4. Si no lo encuentra y el faltante vale la pena, se ofrece consultar a la IA local.
5. El porcentaje con sustituciones se muestra junto al original: "100 % (antes 75 %)".

## Cómo probarlo

Caso de la guía (paso 6):

1. `npm run dev` y abrir http://localhost:3000
2. En **Mi Cocina**, quitar **Leche entera** de la despensa y dejar **Yogur natural**.
3. Abrir **Pan Francés Dorado con Canela y Miel**: debe aparecer "Puedes sustituir Leche entera
   por Yogur natural" y subir el porcentaje.

Antes de subir cambios: `npm run check` (tipos, pruebas y compilación).

## Qué no hace

- No cambia las recetas ni las cantidades guardadas: solo sugiere.
- No modifica `recipeMatcher.ts` ni el porcentaje normal de las demás partes.
- No usa base de datos ni servicios en la nube.
- No recomienda nada que no esté en la despensa.

## Más detalle

- [Base de equivalencias](base-de-equivalencias.md)
- [Motor de reglas](motor-de-reglas.md)
- [Apoyo de la IA local](ia-local.md)
- [Interfaz](interfaz.md)
