// Must be the first import: ES modules run imports before this file's code, and the
// database pool reads process.env when it is imported.
import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, optionalAuth, AuthRequest, sessionToken } from './src/middleware/auth.ts';
import {
  AuthError,
  authenticateUser,
  clearedSessionCookie,
  createSession,
  deleteSession,
  findSessionUser,
  registerUser,
  sessionCookie,
  type SessionUser,
} from './src/auth/localAuth.ts';
import { getLlmConfig, generateRecipe, LlmError, type RecipeRequest } from './src/ai/localLlm.ts';
import { createLimiter, BusyError } from './src/ai/limiter.ts';
import { parseSubstitutionRequest, requestSubstitutions } from './src/ai/substitutionAi.ts';
import { adaptStepsWithLocalAi, parsePartitionStepsRequest } from './src/ai/partitionAi.ts';
import { blockedRescueAnswer, parseRescueRequest, rescueWithLocalAi } from './src/ai/rescueAi.ts';
import {
  getUserFullState,
  updateUserPreferences,
  replaceUserPantry,
  replaceUserShoppingList,
  saveUserAiRecipe,
  recordRecipeGeneration,
  listRecipeHistory,
  deleteRecipeHistoryEntry,
  listCommunityValidations,
  addCommunityValidation,
} from './src/db/cociflexRepo.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

function resolvePort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = Number(process.argv[portArgIndex + 1]);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  if (!Number.isNaN(envPort) && envPort > 0 && envPort !== nginxPort) {
    return envPort;
  }
  const defaultAppPort = Number(process.env.DEFAULT_APP_PORT);
  return !Number.isNaN(defaultAppPort) && defaultAppPort > 0 ? defaultAppPort : 3000;
}

const port = resolvePort();

// Behind NGINX on the same machine: trust its X-Forwarded-* headers (client IP, https).
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '200kb' }));

const llmLimiter = createLimiter(
  Number(process.env.LLM_MAX_CONCURRENT) || 1,
  Number(process.env.LLM_MAX_QUEUE) || 2
);
const KEEPALIVE_MS = Number(process.env.LLM_KEEPALIVE_MS) || 15000;

// ==========================================
// Accounts (local, stored in MariaDB)
// ==========================================

// Simple brute-force protection: at most 10 login/sign-up attempts per IP every 15 minutes.
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 10;
const authAttempts = new Map<string, { count: number; resetAt: number }>();

function tooManyAttempts(req: Request): boolean {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const entry = authAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    if (authAttempts.size > 5000) {
      for (const [k, v] of authAttempts) if (v.resetAt < now) authAttempts.delete(k);
    }
    return false;
  }
  entry.count++;
  return entry.count > AUTH_MAX_ATTEMPTS;
}

const publicUser = (user: SessionUser) => ({ uid: user.uid, email: user.email, displayName: user.name });

async function startSession(req: Request, res: Response, user: SessionUser) {
  const { token, expiresAt } = await createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token, expiresAt, req.secure));
}

function sendAuthError(res: Response, error: unknown, fallback: string) {
  if (error instanceof AuthError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
}

app.post('/api/auth/register', async (req: Request, res: Response) => {
  if (tooManyAttempts(req)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
  }
  try {
    const { email, password, displayName } = req.body || {};
    const user = await registerUser(email, password, displayName);
    await startSession(req, res, user);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    return sendAuthError(res, error, 'No se pudo crear la cuenta.');
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  if (tooManyAttempts(req)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
  }
  try {
    const { email, password } = req.body || {};
    const user = await authenticateUser(email, password);
    await startSession(req, res, user);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return sendAuthError(res, error, 'No se pudo iniciar sesión.');
  }
});

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  try {
    await deleteSession(sessionToken(req));
  } catch (error) {
    console.error('Failed to delete session:', error);
  }
  res.setHeader('Set-Cookie', clearedSessionCookie(req.secure));
  return res.json({ ok: true });
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  try {
    const user = await findSessionUser(sessionToken(req));
    return res.json({ user: user ? publicUser(user) : null });
  } catch (error) {
    console.error('Failed to read session:', error);
    return res.status(500).json({ error: 'No se pudo verificar la sesión.' });
  }
});

// ==========================================
// User data (requires a session)
// ==========================================

app.get('/api/me/state', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const state = await getUserFullState(user.uid, user.email, user.name);
    return res.json(state);
  } catch (error: any) {
    console.error('Failed to load user state:', error);
    return res.status(500).json({ error: error?.message || 'Error al cargar el perfil.' });
  }
});

app.put('/api/me/preferences', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { displayName, dietaryPreference, walkthroughCompleted } = req.body || {};
    const updated = await updateUserPreferences(user.uid, user.email, {
      displayName: typeof displayName === 'string' ? displayName.slice(0, 80) : undefined,
      dietaryPreference:
        typeof dietaryPreference === 'string' ? dietaryPreference.slice(0, 40) : undefined,
      walkthroughCompleted:
        typeof walkthroughCompleted === 'boolean' ? walkthroughCompleted : undefined,
    });
    return res.json({
      user: {
        uid: updated.uid,
        email: updated.email,
        displayName: updated.displayName,
        dietaryPreference: updated.dietaryPreference,
        walkthroughCompleted: updated.walkthroughCompleted,
      },
    });
  } catch (error: any) {
    console.error('Failed to update user preferences:', error);
    return res.status(500).json({ error: error?.message || 'Error al guardar preferencias.' });
  }
});

app.put('/api/me/pantry', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const ingredients = Array.isArray(req.body?.ingredients)
      ? req.body.ingredients.filter((i: unknown) => typeof i === 'string')
      : [];
    const saved = await replaceUserPantry(user.uid, user.email, ingredients);
    return res.json({ pantryIngredients: saved });
  } catch (error: any) {
    console.error('Failed to update pantry:', error);
    return res.status(500).json({ error: error?.message || 'Error al guardar la alacena.' });
  }
});

app.put('/api/me/shopping-list', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const items = Array.isArray(req.body?.items)
      ? req.body.items.filter((i: unknown) => typeof i === 'string')
      : [];
    const saved = await replaceUserShoppingList(user.uid, user.email, items);
    return res.json({ shoppingList: saved });
  } catch (error: any) {
    console.error('Failed to update shopping list:', error);
    return res.status(500).json({ error: error?.message || 'Error al guardar la lista de mandado.' });
  }
});

app.post('/api/me/recipes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const recipe = req.body?.recipe;
    if (!recipe || typeof recipe.title !== 'string') {
      return res.status(400).json({ error: 'Receta inválida.' });
    }
    const saved = await saveUserAiRecipe(user.uid, user.email, {
      id: String(recipe.id || `ai-${Date.now()}`),
      title: recipe.title,
      category: String(recipe.category || 'Personalizada IA'),
      mealType: String(recipe.mealType || 'Comida'),
      description: String(recipe.description || ''),
      prepTimeMinutes: Number(recipe.prepTimeMinutes) || 10,
      cookTimeMinutes: Number(recipe.cookTimeMinutes) || 15,
      servings: Number(recipe.servings) || 2,
      difficulty: String(recipe.difficulty || 'Fácil'),
      wasteReductionTip: String(recipe.wasteReductionTip || ''),
      ...recipe,
    });
    return res.status(201).json({ savedRecipe: saved.recipePayload });
  } catch (error: any) {
    console.error('Failed to save recipe:', error);
    return res.status(500).json({ error: error?.message || 'Error al guardar la receta.' });
  }
});

app.get('/api/me/history', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const limit = Number(req.query.limit) || 50;
    const history = await listRecipeHistory(user.uid, user.email, limit);
    return res.json({ recipeHistory: history });
  } catch (error: any) {
    console.error('Failed to load recipe history:', error);
    return res.status(500).json({ error: error?.message || 'Error al cargar el historial.' });
  }
});

app.delete('/api/me/history/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }
    const deleted = await deleteRecipeHistoryEntry(user.uid, user.email, id);
    return deleted
      ? res.json({ deleted: true })
      : res.status(404).json({ error: 'No se encontró esa entrada del historial.' });
  } catch (error: any) {
    console.error('Failed to delete history entry:', error);
    return res.status(500).json({ error: error?.message || 'Error al borrar del historial.' });
  }
});

// ==========================================
// Community
// ==========================================

app.get('/api/community/validations', async (_req: Request, res: Response) => {
  try {
    const rows = await listCommunityValidations();
    return res.json({ validations: rows });
  } catch (error: any) {
    console.error('Failed to list community validations:', error);
    return res.status(500).json({ error: error?.message || 'Error al consultar validaciones.' });
  }
});

app.post('/api/community/validate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const communityRecipeId =
      typeof req.body?.communityRecipeId === 'string' ? req.body.communityRecipeId.trim() : '';
    const validatorName =
      typeof req.body?.validatorName === 'string' && req.body.validatorName.trim()
        ? req.body.validatorName.trim().slice(0, 120)
        : user.name || user.email.split('@')[0] || 'Cocinero Verificado';

    if (!communityRecipeId) {
      return res.status(400).json({ error: 'Falta identificar la receta comunitaria.' });
    }
    const rows = await addCommunityValidation(communityRecipeId, user.uid, validatorName);
    return res.json({ communityRecipeId, validations: rows });
  } catch (error: any) {
    console.error('Failed to register community validation:', error);
    return res.status(500).json({ error: error?.message || 'Error al registrar validación.' });
  }
});

// ==========================================
// AI recipes (local model through the VPN)
// ==========================================

function buildFallbackRecipe(request: RecipeRequest) {
  const primary = request.ingredients.slice(0, 3).join(', ');
  return {
    title: `Guisado Creativo CociFlex de ${request.ingredients[0] || 'la Casa'}`,
    category: request.preference,
    mealType: 'Comida',
    description: `Una preparación nutritiva, económica y reconfortante diseñada específicamente para aprovechar al 100% ${primary} sin desperdiciar nada.`,
    prepTimeMinutes: 10,
    cookTimeMinutes: Math.min(request.timeAvailable, 30),
    servings: request.servings,
    difficulty: 'Fácil',
    ingredients: request.ingredients.map((ing) => ({
      name: ing,
      amount: '1',
      unit: 'porción adecuada',
      essential: true,
    })),
    steps: [
      {
        stepNumber: 1,
        title: 'Acondicionamiento y corte',
        instruction: `Lava y corta finamente los ingredientes disponibles (${primary}) para optimizar el tiempo de cocción.`,
        timeMinutes: 5,
        tip: 'Guarda los tallos o cáscaras limpias para preparar un fondo de verduras concentrado.',
      },
      {
        stepNumber: 2,
        title: 'Sellado y sazonado en sartén',
        instruction:
          'Calienta un sartén con una cucharadita de aceite a fuego medio. Saltea primero los elementos base y agrega condimentos al gusto.',
        timeMinutes: 10,
        tip: 'Mantén el fuego medio-alto para caramelizar los azúcares naturales de los vegetales.',
      },
      {
        stepNumber: 3,
        title: 'Integración y punto de sal',
        instruction:
          'Añade el resto de los ingredientes, tapa y deja cocer a fuego bajo hasta que todo esté suave y bien integrado.',
        timeMinutes: 10,
        tip: 'Sirve de inmediato caliente acompañado de tortillas o frijolitos.',
      },
    ],
    wasteReductionTip:
      'Aprovecha las sobras enfriadas en un recipiente hermético; se conservan perfecto por 3 días o como relleno para quesadillas.',
    caloriesApprox: 380,
  };
}

app.post('/api/generate-recipe', optionalAuth, async (req: AuthRequest, res: Response) => {
  const startedAt = Date.now();
  const { ingredients, timeAvailable, servings, preference, extraNotes } = req.body || {};
  const cleanIngredients: string[] = Array.isArray(ingredients)
    ? ingredients
        .map((i: unknown) => String(i).trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 60)
    : [];

  if (cleanIngredients.length === 0) {
    return res.status(400).json({ error: 'Debes proporcionar al menos un ingrediente disponible.' });
  }

  const request: RecipeRequest = {
    ingredients: cleanIngredients,
    timeAvailable: Number(timeAvailable) || 30,
    servings: Math.min(Math.max(Number(servings) || 2, 1), 20),
    preference: String(preference || 'Tradicional Mexicana').slice(0, 80),
    extraNotes: typeof extraNotes === 'string' ? extraNotes.slice(0, 500) : undefined,
  };

  const llm = getLlmConfig();
  const user = req.user;

  // Only signed-in users get their generations saved in the history.
  const record = (status: 'ok' | 'fallback' | 'error', recipe: unknown, errorMessage?: string) => {
    if (!user) return;
    recordRecipeGeneration(user.uid, user.email, {
      ...request,
      status,
      model: status === 'fallback' ? 'respaldo-local' : llm?.model,
      recipe: recipe as Record<string, unknown> | null,
      errorMessage,
      durationMs: Date.now() - startedAt,
    }).catch(() => {});
  };

  if (!llm) {
    const fallbackRecipe = buildFallbackRecipe(request);
    record('fallback', fallbackRecipe);
    return res.json({ recipe: fallbackRecipe });
  }

  const clientAbort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) clientAbort.abort();
  });

  let release: () => void;
  try {
    release = await llmLimiter.acquire(clientAbort.signal);
  } catch (error) {
    if (error instanceof BusyError) {
      record('error', null, 'IA local ocupada');
      return res.status(429).json({
        error: 'La IA local está ocupada generando otras recetas. Intenta de nuevo en unos minutos.',
      });
    }
    return; // client left while waiting
  }

  // The model may take minutes: send headers now and a space every few seconds to keep proxies open.
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const keepAlive = setInterval(() => res.write(' '), KEEPALIVE_MS);

  try {
    const recipe = await generateRecipe(llm, request, clientAbort.signal);
    record('ok', recipe);
    res.end(JSON.stringify({ recipe }));
  } catch (error) {
    if (error instanceof LlmError && error.code === 'aborted') {
      res.end();
    } else {
      const message =
        error instanceof LlmError ? error.message : 'Error desconocido al generar la receta.';
      console.error('Error generating recipe with the local model:', error);
      record('error', null, message);
      res.end(JSON.stringify({ error: message }));
    }
  } finally {
    clearInterval(keepAlive);
    release();
  }
});

// "Sustitución inteligente": optional AI help for missing ingredients that the base does not
// cover. The server re-checks the answer against the pantry before returning it.
app.post('/api/ai/sustitutos', async (req: Request, res: Response) => {
  const parsed = parseSubstitutionRequest(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const llm = getLlmConfig();
  if (!llm) {
    return res.status(503).json({ error: 'La IA local no está configurada en el servidor.' });
  }

  const clientAbort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) clientAbort.abort();
  });

  let release: () => void;
  try {
    release = await llmLimiter.acquire(clientAbort.signal);
  } catch (error) {
    if (error instanceof BusyError) {
      return res.status(429).json({
        error: 'La IA local está ocupada con otras recetas. Intenta de nuevo en unos minutos.',
      });
    }
    return; // client left while waiting
  }

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const keepAlive = setInterval(() => res.write(' '), KEEPALIVE_MS);

  try {
    const suggestions = await requestSubstitutions(llm, parsed.value, clientAbort.signal);
    res.end(JSON.stringify({ suggestions, model: llm.model }));
  } catch (error) {
    if (error instanceof LlmError && error.code === 'aborted') {
      res.end();
    } else {
      const message =
        error instanceof LlmError ? error.message : 'Error desconocido al buscar sustituciones.';
      console.error('Error finding substitutions with the local model:', error);
      res.end(JSON.stringify({ error: message }));
    }
  } finally {
    clearInterval(keepAlive);
    release();
  }
});

// "Receta a tu medida": the browser already reduced the ingredients with rules; the local model
// rewrites the steps for the smaller batch. It shares the queue with recipe generation.
app.post('/api/recipes/partition-steps', async (req: Request, res: Response) => {
  const parsed = parsePartitionStepsRequest(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const llm = getLlmConfig();
  if (!llm) {
    return res.status(503).json({ error: 'La IA local no está configurada en el servidor.' });
  }

  const clientAbort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) clientAbort.abort();
  });

  let release: () => void;
  try {
    release = await llmLimiter.acquire(clientAbort.signal);
  } catch (error) {
    if (error instanceof BusyError) {
      return res.status(429).json({
        error: 'La IA local está ocupada con otras recetas. Intenta de nuevo en unos minutos.',
      });
    }
    return; // client left while waiting
  }

  // Same as recipes: headers now and a space every few seconds while the model works.
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const keepAlive = setInterval(() => res.write(' '), KEEPALIVE_MS);

  try {
    const adapted = await adaptStepsWithLocalAi(llm, parsed.value, clientAbort.signal);
    res.end(JSON.stringify({ ...adapted, model: llm.model }));
  } catch (error) {
    if (error instanceof LlmError && error.code === 'aborted') {
      res.end();
    } else {
      const message =
        error instanceof LlmError ? error.message : 'Error desconocido al ajustar los pasos.';
      console.error('Error adapting steps with the local model:', error);
      res.end(JSON.stringify({ error: message }));
    }
  } finally {
    clearInterval(keepAlive);
    release();
  }
});
// "Modo Salvavidas": rescue plan for a dish that went wrong while cooking. The food-safety rules
// answer first (spoiled, burned black or raw meat: the model is never asked); otherwise the local
// model suggests a plan. It shares the queue with recipe generation.
app.post('/api/ai/salvavidas', async (req: Request, res: Response) => {
  const parsed = parseRescueRequest(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const blocked = blockedRescueAnswer(parsed.value);
  if (blocked) return res.json({ ...blocked, model: null });

  const llm = getLlmConfig();
  if (!llm) {
    return res.status(503).json({ error: 'La IA local no está configurada en el servidor.' });
  }

  const clientAbort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) clientAbort.abort();
  });

  let release: () => void;
  try {
    release = await llmLimiter.acquire(clientAbort.signal);
  } catch (error) {
    if (error instanceof BusyError) {
      return res.status(429).json({
        error: 'La IA local está ocupada con otras recetas. Intenta de nuevo en unos minutos.',
      });
    }
    return; // client left while waiting
  }

  // Same as recipes: headers now and a space every few seconds while the model works.
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const keepAlive = setInterval(() => res.write(' '), KEEPALIVE_MS);

  try {
    const rescue = await rescueWithLocalAi(llm, parsed.value, clientAbort.signal);
    res.end(JSON.stringify({ ...rescue, model: llm.model }));
  } catch (error) {
    if (error instanceof LlmError && error.code === 'aborted') {
      res.end();
    } else {
      const message =
        error instanceof LlmError ? error.message : 'Error desconocido al consultar a la IA local.';
      console.error('Error rescuing the dish with the local model:', error);
      res.end(JSON.stringify({ error: message }));
    }
  } finally {
    clearInterval(keepAlive);
    release();
  }
});
// ==========================================
// Frontend
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const host = process.env.HOST || '0.0.0.0';
  app.listen(port, host, () => {
    console.log(`CociFlex server running on http://${host}:${port}`);
  });
}

startServer();
