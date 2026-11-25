import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  buildSubstitutionMessages,
  parseSubstitutionRequest,
  requestSubstitutions,
  sanitizeSuggestions,
  type SubstitutionAiRequest,
} from './substitutionAi.ts';
import { LlmError, type LlmConfig } from './localLlm.ts';

// Servidor falso compatible con la API de OpenAI, en un puerto local al azar.
async function startFakeLlm(handler: (body: any, res: http.ServerResponse) => void) {
  const requests: any[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null;
      requests.push(body);
      handler(body, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const cfg: LlmConfig = {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    model: 'modelo-prueba',
    timeoutMs: 5000,
    maxTokens: 500,
  };
  const close = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  return { cfg, requests, close };
}

const answer = (res: http.ServerResponse, content: string) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ choices: [{ message: { content } }] }));
};

const request: SubstitutionAiRequest = {
  recipeTitle: 'Pan Francés Dorado con Canela y Miel',
  missing: [
    { name: 'Leche entera', amount: '0.25', unit: 'taza' },
    { name: 'Queso Fresco', amount: '90', unit: 'g' },
  ],
  pantry: ['Yogur natural', 'Queso Manchego o Oaxaca', 'Huevos', 'Pan de caja / bolillo'],
};

test('parseSubstitutionRequest acepta un cuerpo valido y rechaza los rotos', () => {
  const ok = parseSubstitutionRequest(request);
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.missing.length, 2);
    assert.equal(ok.value.pantry.length, 4);
  }

  assert.equal(parseSubstitutionRequest(null).ok, false);
  assert.equal(parseSubstitutionRequest({ ...request, recipeTitle: '' }).ok, false);
  assert.equal(parseSubstitutionRequest({ ...request, missing: [] }).ok, false);
  assert.equal(parseSubstitutionRequest({ ...request, missing: [{ name: '' }] }).ok, false);
  assert.equal(parseSubstitutionRequest({ ...request, pantry: 'yogur' }).ok, false);
  assert.equal(parseSubstitutionRequest({ ...request, pantry: [{ name: 'yogur' }] }).ok, false);
});

test('el prompt lleva la receta, los faltantes y la despensa', () => {
  const [system, user] = buildSubstitutionMessages(request);
  assert.match(system.content, /chef/i);
  assert.match(user.content, /Pan Francés/);
  assert.match(user.content, /Leche entera/);
  assert.match(user.content, /Yogur natural/);
  assert.match(user.content, /SOLO puedes recomendar ingredientes de esta lista/);
  assert.match(user.content, /No recomiendes ingredientes fuera de la despensa/);
});

test('sanitizeSuggestions descarta lo que no esta en la despensa o no es un faltante', () => {
  const raw = {
    suggestions: [
      { missing: 'Leche entera', substitute: 'Yogur natural', amount: '¼ taza', note: 'Mas espeso.', allergens: ['lácteo'] },
      { missing: 'Leche entera', substitute: 'Leche de coco', amount: '1 taza', note: 'Inventado.' },
      { missing: 'Chile chipotle', substitute: 'Queso Manchego o Oaxaca', amount: '1 pieza', note: 'No es un faltante.' },
      { missing: 'Queso Fresco', substitute: 'Queso Manchego o Oaxaca', amount: '90 g', note: 'Mas salado.', allergens: ['lácteo', 'lácteo', 7] },
    ],
  };
  const clean = sanitizeSuggestions(raw, request);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].substitute, 'Yogur natural');
  assert.equal(clean[0].amount, '¼ taza');
  assert.deepEqual(clean[0].allergens, ['lácteo']);
  assert.equal(clean[1].substitute, 'Queso Manchego o Oaxaca');
  assert.deepEqual(clean[1].allergens, ['lácteo']);
});

test('sanitizeSuggestions rechaza una respuesta sin arreglo de sugerencias', () => {
  assert.throws(() => sanitizeSuggestions({ foo: 'bar' }, request), LlmError);
  assert.throws(() => sanitizeSuggestions(null, request), LlmError);
});

test('requestSubstitutions devuelve solo sugerencias validas', async () => {
  const goodAnswer = JSON.stringify({
    suggestions: [
      { missing: 'Leche entera', substitute: 'Yogur natural', amount: '¼ taza', note: 'Queda mas espeso.', allergens: ['lácteo'] },
      { missing: 'Leche entera', substitute: 'Leche de coco', amount: '1 taza', note: 'No esta en la despensa.' },
    ],
  });
  const fake = await startFakeLlm((_body, res) => answer(res, goodAnswer));
  try {
    const suggestions = await requestSubstitutions(fake.cfg, request);
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].substitute, 'Yogur natural');
    assert.equal(fake.requests.length, 1);
    assert.equal(fake.requests[0].model, 'modelo-prueba');
    assert.ok(Array.isArray(fake.requests[0].messages));
  } finally {
    await fake.close();
  }
});

test('requestSubstitutions acepta una lista vacia del modelo', async () => {
  const fake = await startFakeLlm((_body, res) => answer(res, JSON.stringify({ suggestions: [] })));
  try {
    const suggestions = await requestSubstitutions(fake.cfg, request);
    assert.deepEqual(suggestions, []);
  } finally {
    await fake.close();
  }
});

test('si la IA no responde, el error es controlado y la base sigue funcionando', async () => {
  const cfg: LlmConfig = {
    baseUrl: 'http://127.0.0.1:1/v1',
    model: 'modelo-prueba',
    timeoutMs: 1000,
    maxTokens: 100,
  };
  await assert.rejects(
    () => requestSubstitutions(cfg, request),
    (error: unknown) => error instanceof LlmError && error.code === 'unreachable'
  );
});

test('el tiempo agotado se reporta como timeout', async () => {
  const fake = await startFakeLlm((_body, res) => {
    setTimeout(() => {
      if (!res.writableEnded) answer(res, JSON.stringify({ suggestions: [] }));
    }, 300);
  });
  try {
    const cfg: LlmConfig = { ...fake.cfg, timeoutMs: 40 };
    await assert.rejects(
      () => requestSubstitutions(cfg, request),
      (error: unknown) => error instanceof LlmError && error.code === 'timeout'
    );
  } finally {
    await fake.close();
  }
});

test('si el navegador cancela, se reporta como aborted', async () => {
  const fake = await startFakeLlm((_body, res) => {
    setTimeout(() => {
      if (!res.writableEnded) answer(res, JSON.stringify({ suggestions: [] }));
    }, 300);
  });
  try {
    const controller = new AbortController();
    const pending = requestSubstitutions(fake.cfg, request, controller.signal);
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(
      pending,
      (error: unknown) => error instanceof LlmError && error.code === 'aborted'
    );
  } finally {
    await fake.close();
  }
});

test('con la despensa vacia ni siquiera se llama al modelo', async () => {
  let calls = 0;
  const fake = await startFakeLlm((_body, res) => {
    calls += 1;
    answer(res, JSON.stringify({ suggestions: [] }));
  });
  try {
    const suggestions = await requestSubstitutions(fake.cfg, { ...request, pantry: [] });
    assert.deepEqual(suggestions, []);
    assert.equal(calls, 0);
  } finally {
    await fake.close();
  }
});
