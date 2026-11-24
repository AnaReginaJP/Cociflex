import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { generateRecipe, getLlmConfig, type LlmConfig } from './localLlm.ts';

// Fake Ollama (OpenAI-compatible) server on a random local port.
async function startFakeLlm(handler: (res: http.ServerResponse) => void) {
  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => handler(res));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const cfg: LlmConfig = { baseUrl: `http://127.0.0.1:${port}/v1`, model: 'modelo-prueba', timeoutMs: 5000, maxTokens: 500 };
  const close = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  return { cfg, close };
}

const recipeRequest = { ingredients: ['huevo', 'tortilla'], timeAvailable: 20, servings: 2, preference: 'Tradicional Mexicana' };

test('getLlmConfig is off without LLM_BASE_URL and has sensible defaults', () => {
  assert.equal(getLlmConfig({}), null);
  const cfg = getLlmConfig({ LLM_BASE_URL: 'http://10.8.0.2:11434/v1/' });
  assert.equal(cfg?.baseUrl, 'http://10.8.0.2:11434/v1');
  assert.equal(cfg?.model, 'qwen2.5:7b');
});

test('generateRecipe still returns a normalized recipe', async () => {
  const llm = await startFakeLlm((res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const content = JSON.stringify({
      title: 'Chilaquiles rápidos',
      mealType: 'Brunch',
      description: 'Rápidos.',
      ingredients: [{ name: 'Tortillas', amount: 6, unit: 'piezas', essential: true }],
      steps: [{ title: '', instruction: 'Dora las tortillas.' }],
      wasteReductionTip: '',
    });
    res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
  try {
    const recipe = await generateRecipe(llm.cfg, recipeRequest);
    assert.equal(recipe.title, 'Chilaquiles rápidos');
    assert.equal(recipe.mealType, 'Comida');
    assert.equal(recipe.ingredients[0].amount, '6');
    assert.deepEqual(recipe.steps[0], { stepNumber: 1, title: 'Paso 1', instruction: 'Dora las tortillas.', timeMinutes: undefined, tip: undefined });
  } finally {
    await llm.close();
  }
});

test('a missing model gives a clear message', async () => {
  const llm = await startFakeLlm((res) => {
    res.writeHead(404);
    res.end('model not found');
  });
  try {
    await assert.rejects(generateRecipe(llm.cfg, recipeRequest), /"modelo-prueba" no está disponible/);
  } finally {
    await llm.close();
  }
});
