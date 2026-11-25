# Apoyo de la IA local

Archivos: `src/ai/substitutionAi.ts` y la ruta `POST /api/ai/sustitutos` en `server.ts`.

Es opcional: solo se usa cuando la base de equivalencias no cubre un faltante. Si la IA no
responde, la app sigue funcionando con la base y las reglas.

## Cuándo aparece

En el detalle de receta, debajo de los ingredientes, con el botón **Buscar más opciones con IA**.
No aparece si:

- la despensa está vacía;
- todos los faltantes ya tienen sustituto en la base;
- el faltante es sal, pimienta, agua o un condimento.

## Petición

```json
{
  "recipeTitle": "Pan Francés Dorado con Canela y Miel",
  "missing": [{ "name": "Leche entera", "amount": "1", "unit": "taza" }],
  "pantry": ["Yogur natural", "Huevos"]
}
```

Validación: nombre de receta obligatorio, entre 1 y 8 faltantes, despensa de hasta 100 nombres.

## Respuesta

```json
{
  "suggestions": [
    {
      "missing": "Leche entera",
      "substitute": "Yogur natural",
      "amount": "1 taza",
      "note": "Queda más espeso y aporta acidez suave.",
      "allergens": ["lácteo"]
    }
  ],
  "model": "qwen2.5:7b"
}
```

Códigos de error: `400` datos inválidos, `503` IA no configurada, `429` la cola está ocupada.

## Qué se le pide al modelo

- Explicar la función del ingrediente y ajustar la cantidad en una cantidad corta.
- Indicar el cambio de sabor o textura y los alérgenos.
- **Solo** proponer ingredientes de la despensa; si no hay, no inventar.
- No proponer yogur, crema ni leche como sustituto del huevo cuando el huevo es el protagonista.

## Qué se revisa al volver

El servidor descarta toda propuesta que no esté en la despensa (`sanitizeSuggestions`), recorta
textos, quita duplicados y deja máximo 6 sugerencias. La temperatura es 0.3 para que no invente.
