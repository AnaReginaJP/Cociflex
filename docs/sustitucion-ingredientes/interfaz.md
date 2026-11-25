# Interfaz

Archivo: `src/components/SubstitutionHint.tsx`. Son dos componentes.

## `SubstitutionHint`

Aviso "Puedes sustituir X por Y". Muestra:

- la cantidad ya ajustada ("Usa 1 taza");
- la función del ingrediente en el platillo;
- el cambio de sabor o textura (`note`);
- los alérgenos, si los hay;
- el aviso de cuándo no conviene (`caution`).

Aparece en dos lugares:

- **Mi Cocina**: debajo de los faltantes de cada receta, junto al texto "Coincidencia con
  sustituciones: X % (antes Y %)".
- **Detalle de receta**: debajo de cada ingrediente que no está en la despensa.

Todo se dibuja con `<span>` porque vive dentro de un botón; un `<div>` rompería el HTML y el clic
para marcar el ingrediente.

## `SubstitutionAiPanel`

Botón y resultado de la consulta a la IA. Estados:

| Estado | Qué se ve |
|---|---|
| `idle` | Botón "Buscar más opciones con IA". |
| `loading` | "Consultando la IA…" con botón Cancelar. |
| `done` | Lista de propuestas, o "La IA no encontró un sustituto con lo que tienes". |
| `error` | Mensaje y "Intentar de nuevo". |

Al cerrar el detalle de receta se cancela la petición (`AbortController`) para no dejarla colgada.

## Guía interactiva

Paso 6: **"Sustituye lo que te falta con lo que ya tienes"** (`ingredient-substitutes`), en la
pestaña Mi Cocina, apuntando a la lista de resultados (`data-tour="recipe-results"`).
