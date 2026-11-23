# CociFlex

**Asistente digital e innovación culinaria.** Aplicación web que sugiere recetas mexicanas con los ingredientes que ya tienes en casa para reducir el desperdicio de comida. Incluye recetas generadas con IA, guías de fermentación con un asistente de IA local (Ollama) y una comunidad de cocineros donde las recetas se certifican con validaciones.

Pensada para estudiantes foráneos, profesionales y cocineros caseros.

## Funciones

La aplicación se organiza en cinco pestañas:

| Pestaña | Qué hace |
|---|---|
| **Inicio** | Buscador y catálogo de recetas mexicanas tradicionales, con filtro por categoría. |
| **Mi Cocina** | Marcas lo que tienes en la alacena y el motor "cero desperdicio" calcula el porcentaje de coincidencia con cada receta y lo que te falta. Si ninguna se ajusta, genera una receta original con IA según tus ingredientes, tiempo, número de personas y preferencia. |
| **Fermentos** | Guías técnicas de fermentación con temperatura objetivo, rango de pH, equipo, lista de seguridad y pasos con puntos críticos de control. Incluye un simulador de inocuidad y el BioAsistente de IA local. |
| **Comunidad** | Recetas compartidas por otros usuarios. Una receta queda certificada al reunir 3 validaciones de cocineros. |
| **Mandado** | Lista de compras con los ingredientes que te faltan. |

Además, un **recorrido guiado** de 5 pasos explica cada pestaña la primera vez que entras.

### Catálogo incluido

- 13 recetas mexicanas tradicionales.
- 4 guías de fermentación: queso fresco estilo Morelos, kéfir de leche, yogur griego y kéfir de agua.
- 5 recetas de comunidad de ejemplo y retos de innovación.

### Motor de coincidencia

Compara los ingredientes del usuario con cada receta sin distinguir acentos ni mayúsculas, ordena las recetas por porcentaje de coincidencia, separa los ingredientes faltantes y escala las cantidades según el número de comensales. No usa IA generativa.

### Recetas con IA

`POST /api/generate-recipe` llama a la API de Gemini desde el servidor, de modo que la clave nunca llega al navegador. La respuesta se pide en JSON con una estructura fija (título, ingredientes, pasos con tiempos, consejo de aprovechamiento y calorías aproximadas). Si no hay clave configurada, el servidor devuelve una receta de respaldo para que la app siga funcionando.

### BioAsistente de IA local (fermentos)

Se conecta a un modelo que corre en **tu propia computadora** (Ollama o LM Studio, por defecto `http://localhost:11434` con `llama3.2`). Ofrece:

- **Personalizar lote:** ajusta temperatura, tiempo de incubación y pH objetivo según la temperatura de tu cuarto, el ingrediente base y el sabor deseado.
- **Diagnóstico sensorial:** a partir de aroma, apariencia, burbujas y horas transcurridas, emite un veredicto (óptimo, precaución o descartar) con análisis microbiológico y acción recomendada.
- **Respaldo heurístico:** si no hay modelo disponible o la inferencia falla, usa reglas bioquímicas locales. Cada resultado indica si vino de la IA local o de la heurística.
- **Probar conexión** y un mini-diccionario de términos de fermentación.

> Como el modelo corre en la máquina de cada usuario, en la versión web solo funciona para quien tenga Ollama o LM Studio instalado y en ejecución. Para el resto de usuarios se usa el respaldo heurístico.

### Cuentas y datos de usuario

- Inicio de sesión con **Google** (Firebase Auth). El servidor verifica el token de cada petición a `/api/me/...`.
- Cada usuario guarda en PostgreSQL su perfil y preferencia alimentaria, su despensa, su lista de compras y las recetas generadas con IA.
- Las validaciones de la comunidad se guardan por usuario, con una sola validación por receta.

## Tecnologías

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Motion, Lucide.
- **Backend:** Node.js y Express (`server.ts`), que sirve la API y la aplicación.
- **Base de datos:** PostgreSQL con Drizzle ORM.
- **Autenticación:** Firebase Auth (Google) y Firebase Admin.
- **IA:** Gemini API (recetas, en el servidor) y Ollama o LM Studio (fermentos, en el equipo del usuario).

## Estructura del proyecto

```
server.ts                      Servidor Express: API y archivos estáticos
src/
  App.tsx                      Estado global, sesión y sincronización con la API
  components/                  Interfaz (workspace, comunidad, fermentos, modales, tour)
    mobile/                    Vista móvil y BioAsistente de fermentos
  contexts/AuthContext.tsx     Sesión con Google
  data/                        Recetas, guías de fermentación y datos de comunidad
  db/                          Esquema Drizzle, conexión y consultas
  middleware/auth.ts           Verificación del token de Firebase
  services/                    Cliente de IA local (Ollama / LM Studio)
  utils/                       Motor de coincidencia y pasos del recorrido guiado
```

## API

| Método y ruta | Acceso | Descripción |
|---|---|---|
| `GET /api/me/state` | Con sesión | Perfil, despensa, lista de compras y recetas guardadas. |
| `PUT /api/me/preferences` | Con sesión | Guarda preferencia alimentaria y estado del recorrido. |
| `PUT /api/me/pantry` | Con sesión | Reemplaza la despensa del usuario. |
| `PUT /api/me/shopping-list` | Con sesión | Reemplaza la lista de compras. |
| `POST /api/me/recipes` | Con sesión | Guarda una receta generada con IA. |
| `GET /api/community/validations` | Público | Validaciones de las recetas de la comunidad. |
| `POST /api/community/validate` | Con sesión | Registra la validación de una receta. |
| `POST /api/generate-recipe` | Público | Genera una receta con IA a partir de los ingredientes. |

### Tablas

`users`, `pantry_items`, `shopping_items`, `saved_recipes` y `community_validations`.

## Ejecutar en local

Requisitos: Node.js y una base de datos PostgreSQL.

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Copia `.env.example` a `.env` y completa los valores (clave de Gemini y datos de la base de datos).
3. Crea las tablas:
   ```bash
   npx drizzle-kit push --config src/db/drizzle.config.ts
   ```
4. Inicia la aplicación:
   ```bash
   npm run dev
   ```
5. Abre `http://localhost:3000`.

Para usar el BioAsistente con IA local, instala [Ollama](https://ollama.com), descarga un modelo (`ollama pull llama3.2`) y, si el navegador bloquea la conexión, inicia Ollama permitiendo el origen de la app (variable `OLLAMA_ORIGINS`).

## Variables de entorno

| Variable | Uso |
|---|---|
| `GEMINI_API_KEY` | Generación de recetas con IA (solo servidor). |
| `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME` | Conexión de la aplicación a PostgreSQL. |
| `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` | Solo para crear las tablas con `drizzle-kit`. |
| `PORT` | Puerto del servidor (por defecto 3000). |
| `NODE_ENV` | Con `production` sirve la carpeta `dist` ya compilada. |

Nunca subas tu archivo `.env` al repositorio.

## Producción

```bash
npm run build
NODE_ENV=production npm start
```

Necesitas un hosting que ejecute Node.js y una base de datos PostgreSQL accesible desde el servidor. Un hosting de páginas estáticas no sirve, porque la clave de IA y la base de datos viven en el servidor.

## Pruebas

```bash
npm test        # pruebas con el ejecutor nativo de Node
npm run lint    # revisa los tipos de TypeScript
```

Las pruebas cubren el motor de coincidencia (`src/utils/recipeMatcher.test.ts`) y el recorrido guiado (`src/utils/walkthroughSteps.test.ts`).

## Limitaciones conocidas

- La IA local de fermentos depende de que el usuario tenga Ollama o LM Studio en su equipo.
- La clave de Firebase de cliente está en `firebase-applet-config.json`; es pública por diseño, pero conviene restringir los dominios autorizados en la consola de Firebase.
- Las recetas de comunidad de ejemplo viven en el código; solo las validaciones se guardan en la base de datos.
