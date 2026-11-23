import express, { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';
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

dotenv.config();

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

app.use(express.json());

const AI_MODEL = 'gemini-3.8-flash';

// Initialize Google GenAI client server-side
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// ================= AUTHENTICATED USER ENDPOINTS (MariaDB) =================

app.get('/api/me/state', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || '';
    const displayName = typeof req.user?.name === 'string' ? req.user.name : undefined;

    if (!uid) {
      return res.status(401).json({ error: 'Sesión inválida.' });
    }

    const state = await getUserFullState(uid, email, displayName);
    return res.json(state);
  } catch (error: any) {
    console.error('Failed to load user state:', error);
    return res.status(500).json({ error: error?.message || 'Error al cargar el perfil.' });
  }
});

app.put('/api/me/preferences', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || '';
    if (!uid) {
      return res.status(401).json({ error: 'Sesión inválida.' });
    }

    const { displayName, dietaryPreference, walkthroughCompleted } = req.body || {};
    const updated = await updateUserPreferences(uid, email, {
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
    const uid = req.user?.uid;
    const email = req.user?.email || '';
    if (!uid) {
      return res.status(401).json({ error: 'Sesión inválida.' });
    }

    const ingredients = Array.isArray(req.body?.ingredients)
      ? req.body.ingredients.filter((i: unknown): i is string => typeof i === 'string')
      : [];

    const saved = await replaceUserPantry(uid, email, ingredients);
    return res.json({ pantryIngredients: saved });
  } catch (error: any) {
    console.error('Failed to update pantry:', error);
    return res.status(500).json({ error: error?.message || 'Error al guardar la alacena.' });
  }
});

app.put('/api/me/shopping-list', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || '';
    if (!uid) {
      return res.status(401).json({ error: 'Sesión inválida.' });
    }

    const items = Array.isArray(req.body?.items)
      ? req.body.items.filter((i: unknown): i is string => typeof i === 'string')
      : [];

    const saved = await replaceUserShoppingList(uid, email, items);
    return res.json({ shoppingList: saved });
  } catch (error: any) {
    console.error('Failed to update shopping list:', error);
    return res.status(500).json({ error: error?.message || 'Error al guardar la lista de mandado.' });
  }
});

app.post('/api/me/recipes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || '';
    if (!uid) {
      return res.status(401).json({ error: 'Sesión inválida.' });
    }

    const recipe = req.body?.recipe;
    if (!recipe || typeof recipe.title !== 'string') {
      return res.status(400).json({ error: 'Receta inválida.' });
    }

    const saved = await saveUserAiRecipe(uid, email, {
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
    const uid = req.user?.uid;
    const email = req.user?.email || '';
    if (!uid) {
      return res.status(401).json({ error: 'Sesión inválida.' });
    }

    const limit = Number(req.query.limit) || 50;
    const history = await listRecipeHistory(uid, email, limit);
    return res.json({ recipeHistory: history });
  } catch (error: any) {
    console.error('Failed to load recipe history:', error);
    return res.status(500).json({ error: error?.message || 'Error al cargar el historial.' });
  }
});

app.delete('/api/me/history/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || '';
    if (!uid) {
      return res.status(401).json({ error: 'Sesión inválida.' });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const deleted = await deleteRecipeHistoryEntry(uid, email, id);
    return deleted
      ? res.json({ deleted: true })
      : res.status(404).json({ error: 'No se encontró esa entrada del historial.' });
  } catch (error: any) {
    console.error('Failed to delete history entry:', error);
    return res.status(500).json({ error: error?.message || 'Error al borrar del historial.' });
  }
});

// ================= COMMUNITY VALIDATION ENDPOINTS =================

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
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Sesión inválida.' });
    }

    const communityRecipeId =
      typeof req.body?.communityRecipeId === 'string' ? req.body.communityRecipeId.trim() : '';
    const validatorName =
      typeof req.body?.validatorName === 'string' && req.body.validatorName.trim()
        ? req.body.validatorName.trim()
        : typeof req.user?.name === 'string'
        ? req.user.name
        : req.user?.email?.split('@')[0] || 'Cocinero Verificado';

    if (!communityRecipeId) {
      return res.status(400).json({ error: 'Falta identificar la receta comunitaria.' });
    }

    const rows = await addCommunityValidation(communityRecipeId, uid, validatorName);
    return res.json({ communityRecipeId, validations: rows });
  } catch (error: any) {
    console.error('Failed to register community validation:', error);
    return res.status(500).json({ error: error?.message || 'Error al registrar validación.' });
  }
});

// ================= AI RECIPE GENERATION ENDPOINT =================

app.post('/api/generate-recipe', optionalAuth, async (req: AuthRequest, res: Response) => {
  const startedAt = Date.now();
  // Saves the request in the user's history (signed-in users only); never breaks the response.
  let record: (status: 'ok' | 'fallback' | 'error', recipe?: Record<string, unknown> | null, errorMessage?: string) => void = () => {};

  try {
    const { ingredients, timeAvailable, servings, preference, extraNotes } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Debes proporcionar al menos un ingrediente disponible.' });
    }

    const uid = req.user?.uid;
    if (uid) {
      record = (status, recipe, errorMessage) => {
        recordRecipeGeneration(uid, req.user?.email || '', {
          ingredients: ingredients.map(String),
          timeAvailable: Number(timeAvailable) || 30,
          servings: Number(servings) || 2,
          preference: String(preference || 'Tradicional Mexicana'),
          extraNotes: typeof extraNotes === 'string' ? extraNotes : undefined,
          status,
          model: status === 'fallback' ? 'respaldo-local' : AI_MODEL,
          recipe,
          errorMessage,
          durationMs: Date.now() - startedAt,
        }).catch(() => {
          // Already logged by the repository.
        });
      };
    }

    if (!ai) {
      const primary = ingredients.slice(0, 3).join(', ');
      const fallbackRecipe = {
          title: `Guisado Creativo CociFlex de ${ingredients[0] || 'la Casa'}`,
          category: preference || 'Tradicional Mexicana',
          mealType: 'Comida',
          description: `Una preparación nutritiva, económica y reconfortante diseñada específicamente para aprovechar al 100% ${primary} sin desperdiciar nada.`,
          prepTimeMinutes: 10,
          cookTimeMinutes: Math.min(Number(timeAvailable) || 25, 30),
          servings: Number(servings) || 2,
          difficulty: 'Fácil',
          ingredients: ingredients.map((ing: string) => ({
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
              instruction: 'Calienta un sartén con una cucharadita de aceite a fuego medio. Saltea primero los elementos base y agrega condimentos al gusto.',
              timeMinutes: 10,
              tip: 'Mantén el fuego medio-alto para caramelizar los azúcares naturales de los vegetales.',
            },
            {
              stepNumber: 3,
              title: 'Integración y punto de sal',
              instruction: 'Añade el resto de los ingredientes, tapa y deja cocer a fuego bajo hasta que todo esté suave y bien integrado.',
              timeMinutes: 10,
              tip: 'Sirve de inmediato caliente acompañado de tortillas o frijolitos.',
            },
          ],
          wasteReductionTip: 'Aprovecha las sobras enfriadas en un recipiente hermético; se conservan perfecto por 3 días o como relleno para quesadillas.',
          caloriesApprox: 380,
      };
      record('fallback', fallbackRecipe);
      return res.json({ recipe: fallbackRecipe });
    }

    const prompt = `Actúa como CociFlex, un chef profesional especializado en gastronomía mexicana casera y sostenibilidad alimentaria (cero desperdicio).
Crea una receta deliciosa, realista y explicada paso a paso que utilice prioritariamente los siguientes ingredientes que el usuario tiene en casa:
Ingredientes disponibles: ${ingredients.join(', ')}
Tiempo máximo disponible: ${timeAvailable || '30'} minutos
Número de comensales/personas: ${servings || '2'} personas
Preferencia culinaria: ${preference || 'Tradicional Mexicana'}
Notas adicionales: ${extraNotes || 'Ninguna'}

Reglas:
- La receta debe adaptarse exactamente al número de personas y al tiempo indicado.
- Destaca cómo aprovechar ingredientes viejos o sobrantes (cero desperdicio).
- Cantidades exactas en tazas, gramos o piezas.
- Pasos numerados con tiempo de cocción e indicación clara.`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: 'Eres CociFlex, el asistente culinario inteligente enfocado en reducir el desperdicio de alimentos y crear platillos con rigor y sabor.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título atractivo de la receta' },
            category: { type: Type.STRING, description: 'Categoría culinaria' },
            mealType: { type: Type.STRING, description: 'Tipo: Desayuno, Comida, Cena, Plato Fuerte, etc.' },
            description: { type: Type.STRING, description: 'Breve descripción tentadora' },
            prepTimeMinutes: { type: Type.INTEGER, description: 'Minutos de preparación' },
            cookTimeMinutes: { type: Type.INTEGER, description: 'Minutos de cocción' },
            servings: { type: Type.INTEGER, description: 'Porciones' },
            difficulty: { type: Type.STRING, description: 'Fácil, Media, o Avanzada' },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  amount: { type: Type.STRING },
                  unit: { type: Type.STRING },
                  essential: { type: Type.BOOLEAN },
                },
                required: ['name', 'amount', 'unit', 'essential'],
              },
            },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  instruction: { type: Type.STRING },
                  timeMinutes: { type: Type.INTEGER },
                  tip: { type: Type.STRING },
                },
                required: ['stepNumber', 'title', 'instruction'],
              },
            },
            wasteReductionTip: { type: Type.STRING, description: 'Consejo para aprovechar al máximo o conservar sobras' },
            caloriesApprox: { type: Type.INTEGER, description: 'Calorías estimadas por porción' },
          },
          required: [
            'title',
            'category',
            'mealType',
            'description',
            'prepTimeMinutes',
            'cookTimeMinutes',
            'servings',
            'difficulty',
            'ingredients',
            'steps',
            'wasteReductionTip',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    record('ok', parsed);
    return res.json({ recipe: parsed });
  } catch (error: any) {
    console.error('Error generating recipe with Gemini:', error);
    record('error', null, error?.message || 'Error desconocido');
    return res.status(500).json({
      error: 'Hubo un error al generar la receta con IA. Por favor intenta de nuevo.',
      details: error?.message || 'Error desconocido',
    });
  }
});

// Production and development static/Vite handling
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
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

  app.listen(port, '0.0.0.0', () => {
    console.log(`CociFlex server running on http://0.0.0.0:${port}`);
  });
}

startServer();
