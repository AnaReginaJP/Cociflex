# CociFlex

**Asistente digital e innovación culinaria.** Aplicación web que sugiere recetas mexicanas con los ingredientes que ya tienes en casa para reducir el desperdicio de comida. Incluye recetas generadas con IA (con historial por usuario), guías de fermentación con un asistente de IA local (Ollama) y una comunidad de cocineros donde las recetas se certifican con validaciones. Los datos se guardan en MariaDB.

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

Al abrir cualquier receta entras al **modo cocina** (temporizador, pasos para marcar y porciones ajustables) y al apartado **Receta a tu medida**, para prepararla con lo que tienes cuando un ingrediente no te alcanza.

Además, un **recorrido guiado** de 6 pasos explica cada pestaña y la receta a tu medida la primera vez que entras (se repite desde el botón "Guía Interactiva").

### Catálogo incluido

- 13 recetas mexicanas tradicionales.
- 4 guías de fermentación: queso fresco estilo Morelos, kéfir de leche, yogur griego y kéfir de agua.
- 5 recetas de comunidad de ejemplo y retos de innovación.

### Motor de coincidencia

Compara los ingredientes del usuario con cada receta sin distinguir acentos ni mayúsculas, ordena las recetas por porcentaje de coincidencia, separa los ingredientes faltantes y escala las cantidades según el número de comensales. No usa IA generativa.

### Despensa con caducidad (cero desperdicio)

En **Mi Cocina**, cada ingrediente marcado en la alacena puede llevar una fecha de caducidad: botones rápidos (hoy, 3 días, 1 semana, 2 semanas) o una fecha elegida. La despensa avisa por color qué caduca hoy o mañana, en 3 días o menos, o está bien. Lo que ya caducó no se propone para cocinar: se avisa que se revise y que, si huele o se ve mal, se tire.

Con lo que está por caducar, la app propone recetas del catálogo que lo aprovechan (con el motor de coincidencia) y el botón **Crear con IA** con esos ingredientes. En cada receta, **Mandar a Mandado lo que falta** agrega solo los ingredientes que no están ya en la lista, sin distinguir acentos ni mayúsculas.

Las fechas las escribe la persona (la app no inventa días de caducidad) y se guardan en el navegador con `localStorage`: no hay tablas ni rutas nuevas. La lógica está en `src/utils/pantryExpiry.ts` y funciona sin IA.

### Recetas con IA

`POST /api/generate-recipe` llama desde el servidor a un modelo local compatible con la API de OpenAI (Ollama o LM Studio), configurado con `LLM_BASE_URL` y `LLM_MODEL`. La respuesta se pide en JSON con una estructura fija (título, ingredientes, pasos con tiempos, consejo de aprovechamiento y calorías aproximadas). Atiende una receta a la vez (`LLM_MAX_CONCURRENT`) con una cola corta (`LLM_MAX_QUEUE`) y avisa si está ocupada. Si `LLM_BASE_URL` no está configurado, devuelve una receta de respaldo.

### Receta a tu medida (cuando no te alcanza un ingrediente)

Si tienes un ingrediente pero no la cantidad completa (por ejemplo, la receta rinde 5 hotcakes y solo te alcanza la harina para 3), el apartado **"¿No te alcanza algún ingrediente?"** del detalle de la receta calcula la versión reducida:

1. Eliges el ingrediente que no te alcanza y escribes cuánto tienes (acepta `1`, `1/2`, `1½`, `0.5` o `media`), en la unidad de la receta o en una equivalente (tazas, cucharadas, cucharaditas, ml, litros, g o kg). Puedes agregar varios.
2. El **motor de reglas** (`src/utils/recipePartition.ts`, sin IA generativa) toma la proporción del ingrediente que más limita y reduce toda la receta en esa misma proporción:
   - convierte unidades y redondea a medidas de cocina (¼, ⅓, ½ o ¾ de taza; pasa a cucharadas si la fracción no es exacta);
   - los huevos solo se parten en mitades y explica cómo medir medio huevo;
   - lo que va "al gusto" o por pizca no cambia, y un ingrediente opcional que no tienes se omite;
   - ajusta las medidas escritas en los pasos, pero no los tiempos, las temperaturas ni las cantidades "en cada pieza";
   - indica el rendimiento nuevo, tiempos aproximados, consejos (molde u olla más pequeños) y cuánto te falta para la receta completa, con botón para agregarlo a la lista de mandado.
3. Opcionalmente, **Ajustar pasos con IA local** envía la receta ya reducida a `POST /api/recipes/partition-steps`. El modelo local reescribe los pasos con las nuevas cantidades, tiempos y recipientes. Comparte la cola con las recetas con IA; si la IA local está apagada u ocupada, se quedan los pasos ajustados por reglas.

### BioAsistente de IA local (fermentos)

Se conecta a un modelo que corre en **tu propia computadora** (Ollama o LM Studio, por defecto `http://localhost:11434` con `llama3.2`). Ofrece:

- **Personalizar lote:** ajusta temperatura, tiempo de incubación y pH objetivo según la temperatura de tu cuarto, el ingrediente base y el sabor deseado.
- **Diagnóstico sensorial:** a partir de aroma, apariencia, burbujas y horas transcurridas, emite un veredicto (óptimo, precaución o descartar) con análisis microbiológico y acción recomendada.
- **Respaldo heurístico:** si no hay modelo disponible o la inferencia falla, usa reglas bioquímicas locales. Cada resultado indica si vino de la IA local o de la heurística.
- **Probar conexión** y un mini-diccionario de términos de fermentación.

> Como el modelo corre en la máquina de cada usuario, en la versión web solo funciona para quien tenga Ollama o LM Studio instalado y en ejecución. Para el resto de usuarios se usa el respaldo heurístico.

### Cuentas y datos de usuario

- Cuentas **locales** con correo y contraseña, guardadas en MariaDB. La contraseña se cifra con scrypt y la sesión vive en una cookie `HttpOnly` (`SameSite=Lax`, 30 días); en la base solo se guarda el hash SHA-256 de la sesión. No depende de servicios externos.
- Límite de 10 intentos de inicio de sesión o registro cada 15 minutos por IP.
- Cada usuario guarda en MariaDB su perfil y preferencia alimentaria, su despensa, su lista de compras, las recetas generadas con IA y su historial de generaciones.
- Las validaciones de la comunidad se guardan por usuario, con una sola validación por receta.

### Historial de recetas

Cada vez que un usuario con sesión iniciada genera una receta, el servidor guarda la petición completa: ingredientes, tiempo, comensales, preferencia y notas, además del resultado (la receta en JSON), el estado (`ok`, `fallback` o `error`), el modelo, el mensaje de error si lo hubo y cuánto tardó. En el perfil, el usuario puede ver su historial, abrir una receta anterior o borrar una entrada. Las generaciones sin sesión no se guardan.

## Tecnologías

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Motion, Lucide.
- **Backend:** Node.js y Express (`server.ts`), que sirve la API y la aplicación.
- **Base de datos:** MariaDB con Drizzle ORM (driver `mysql2`).
- **Autenticación:** cuentas locales en MariaDB (scrypt de `node:crypto` y cookies de sesión).
- **IA:** Ollama o LM Studio (recetas desde el servidor, y fermentos desde el equipo del usuario).

## Estructura del proyecto

```
server.ts                      Servidor Express: API y archivos estáticos
src/
  App.tsx                      Estado global, sesión y sincronización con la API
  components/                  Interfaz (workspace, comunidad, fermentos, modales, tour)
    mobile/                    Vista móvil y BioAsistente de fermentos
  contexts/AuthContext.tsx     Sesión (registro, inicio y cierre de sesión)
  data/                        Recetas, guías de fermentación y datos de comunidad
  db/                          Esquema Drizzle (MariaDB), conexión y consultas
database/schema.sql            Script SQL para crear las tablas a mano
  middleware/auth.ts           Verificación de la cookie de sesión
  auth/localAuth.ts            Contraseñas, sesiones y cookies
  ai/                          Cliente del modelo local (recetas y receta a tu medida) y limitador
  services/                    Cliente de IA local (Ollama / LM Studio)
  utils/                       Motor de coincidencia, receta a tu medida y recorrido guiado
```

## API

| Método y ruta | Acceso | Descripción |
|---|---|---|
| `POST /api/auth/register` | Público | Crea una cuenta (correo, contraseña de 8+ caracteres, nombre opcional) e inicia sesión. |
| `POST /api/auth/login` | Público | Inicia sesión y envía la cookie de sesión. |
| `POST /api/auth/logout` | Público | Cierra la sesión actual. |
| `GET /api/auth/me` | Público | Usuario de la sesión actual o `null`. |
| `GET /api/me/state` | Con sesión | Perfil, despensa, lista de compras, recetas guardadas e historial. |
| `PUT /api/me/preferences` | Con sesión | Guarda preferencia alimentaria y estado del recorrido. |
| `PUT /api/me/pantry` | Con sesión | Reemplaza la despensa del usuario. |
| `PUT /api/me/shopping-list` | Con sesión | Reemplaza la lista de compras. |
| `POST /api/me/recipes` | Con sesión | Guarda una receta generada con IA. |
| `GET /api/me/history` | Con sesión | Historial de generaciones de recetas (más recientes primero). |
| `DELETE /api/me/history/:id` | Con sesión | Borra una entrada del historial propio. |
| `GET /api/community/validations` | Público | Validaciones de las recetas de la comunidad. |
| `POST /api/community/validate` | Con sesión | Registra la validación de una receta. |
| `POST /api/generate-recipe` | Público; con sesión también guarda el historial | Genera una receta con IA a partir de los ingredientes. |
| `POST /api/recipes/partition-steps` | Público | Reescribe con la IA local los pasos de una receta reducida (Receta a tu medida). |

### Tablas

| Tabla | Contenido |
|---|---|
| `users` | Cuenta (uid, correo único, contraseña cifrada, nombre, preferencia alimentaria, recorrido completado, último acceso). |
| `sessions` | Sesiones activas (hash del token, usuario y vencimiento). |
| `pantry_items` | Ingredientes de la alacena de cada usuario. |
| `shopping_items` | Lista de compras (mandado). |
| `saved_recipes` | Recetas generadas con IA que el usuario conserva (JSON completo). |
| `recipe_history` | Cada generación: datos de entrada, receta resultante, estado, modelo, error y duración. |
| `community_validations` | Validaciones de la comunidad, una por usuario y receta. |

Todas las tablas del usuario se borran en cascada si se elimina el usuario.

## Ejecutar en local

Funciona en **Windows 10/11**, Linux y macOS. Requisitos: Node.js 22.18 o superior (recomendado 24 LTS), Git y Docker Desktop.

```powershell
npm install
npm run db:dev     # MariaDB de desarrollo en Docker (puerto 3307), tablas, migraciones y .env
npm run dev        # http://localhost:3000
```

Si prefieres un MariaDB propio (10.6 o superior), crea la base y el usuario `cociflex_app` con permisos `SELECT, INSERT, UPDATE, DELETE`, carga `database/schema.sql` y los `database/migrate_*.sql`, y completa tu `.env` a partir de `.env.example`.

Para usar el BioAsistente con IA local, instala [Ollama](https://ollama.com), descarga un modelo (`ollama pull llama3.2`) y, si el navegador bloquea la conexión, inicia Ollama permitiendo el origen de la app (variable `OLLAMA_ORIGINS`).

En CachyOS (Arch Linux) puedes instalar y arrancar MariaDB con:
```bash
sudo pacman -S mariadb
sudo mariadb-install-db --user=mysql --basedir=/usr --datadir=/var/lib/mysql
sudo systemctl enable --now mariadb
```

## Variables de entorno

| Variable | Uso |
|---|---|
| `LLM_BASE_URL`, `LLM_MODEL` | Modelo local para recetas, p. ej. `http://10.8.0.2:11434/v1` y `qwen2.5:7b`. |
| `LLM_TIMEOUT_MS`, `LLM_MAX_TOKENS`, `LLM_MAX_CONCURRENT`, `LLM_MAX_QUEUE` | Tiempo máximo, longitud y concurrencia de la IA local (opcionales). |
| `HOST` | Interfaz donde escucha el servidor (por defecto `0.0.0.0`). |
| `SQL_HOST`, `SQL_PORT`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME` | Conexión de la aplicación a MariaDB (el puerto por defecto es 3306). |
| `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` | Solo para crear las tablas con `drizzle-kit`. |
| `PORT` | Puerto del servidor (por defecto 3000). |
| `NODE_ENV` | Con `production` sirve la carpeta `dist` ya compilada. |

Nunca subas tu archivo `.env` al repositorio.

## Producción

El servidor del proyecto (Ubuntu con MariaDB, Node.js, systemd y NGINX) se actualiza con `npm run servidor:actualizar`; los detalles están en [deploy/README.md](deploy/README.md).

Necesitas un hosting que ejecute Node.js y una base de datos MariaDB accesible desde el servidor. Un hosting de páginas estáticas no sirve, porque las cuentas, la base de datos y la conexión con la IA viven en el servidor.

## Pruebas

```bash
npm test        # pruebas con el ejecutor nativo de Node
npm run lint    # revisa los tipos de TypeScript
```

Las pruebas cubren el motor de coincidencia (`src/utils/recipeMatcher.test.ts`), la receta a tu medida (`src/utils/recipePartition.test.ts`), el recorrido guiado (`src/utils/walkthroughSteps.test.ts`) y el cliente de IA local contra un servidor simulado (`src/ai/*.test.ts`).

## Limitaciones conocidas

- La IA local de fermentos depende de que el usuario tenga Ollama o LM Studio en su equipo.
- Sin HTTPS, la contraseña viaja sin cifrar entre el navegador y el servidor; para uso real conviene un dominio con HTTPS.
- La IA de recetas depende de que el equipo con Ollama y la VPN estén encendidos.
- Las recetas de comunidad de ejemplo viven en el código; solo las validaciones se guardan en la base de datos.
- El historial solo guarda las generaciones de usuarios con sesión iniciada.
- Las pruebas automáticas (`npm test`) no incluyen la base de datos; la capa de datos se probó contra MariaDB 10.11.
