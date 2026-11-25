import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  blockedRescueAnswer,
  buildRescueMessages,
  normalizeRescueAnswer,
  parseRescueRequest,
  rescueWithLocalAi,
  type RescueRequest,
} from './rescueAi.ts';
import { LlmError, type LlmConfig } from './localLlm.ts';

// Fake Ollama (OpenAI-compatible) server on a random local port.
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
  const cfg: LlmConfig = { baseUrl: `http://127.0.0.1:${port}/v1`, model: 'modelo-prueba', timeoutMs: 5000, maxTokens: 500 };
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

const body = {
  title: 'Sopa de Fideo',
  problem: 'muy-salado',
  description: 'Le eché demasiada sal al caldo',
  currentStep: { stepNumber: 2, title: 'Hervir', instruction: 'Agrega el caldo y hierve 10 minutos.' },
  available: ['Limones', 'Crema ácida', ' ', 'Limones'],
  ingredients: [
    { name: 'Pasta / Espagueti', amount: '200', unit: 'g' },
    { name: 'Jitomate', amount: '2', unit: 'piezas' },
  ],
  steps: [
    { title: 'Sofreír', instruction: 'Sofríe la pasta.' },
    { title: 'Hervir', instruction: 'Agrega el caldo y hierve 10 minutos.' },
  ],
};

function parsed(): RescueRequest {
  const result = parseRescueRequest(body);
  assert.ok(result.ok);
  return result.value;
}

const goodAnswer = JSON.stringify({
  diagnosis: ' La sal se concentró en el caldo. ',
  steps: [
    { instruction: ' Agrega una taza de agua caliente y prueba. ', uses: ['agua'] },
    { instruction: 'Sirve con una cucharada de crema.', uses: ['Crema'] },
    { instruction: 'Unas gotas de limón al servir.', uses: ['limón'] },
  ],
  warnings: ['No agregues más sal.', ''],
});

test('parseRescueRequest accepts a valid body and rejects broken ones', () => {
  const ok = parseRescueRequest(body);
  assert.ok(ok.ok);
  assert.equal(ok.value.problem, 'muy-salado');
  assert.equal(ok.value.problemLabel, 'Muy salado');
  assert.deepEqual(ok.value.available, ['Limones', 'Crema ácida']);
  assert.equal(ok.value.currentStep?.stepNumber, 2);
  assert.equal(ok.value.steps.length, 2);

  assert.equal(parseRescueRequest({ ...body, title: '' }).ok, false);
  assert.equal(parseRescueRequest({ ...body, problem: 'inventado' }).ok, false);
  assert.equal(parseRescueRequest({ ...body, problem: undefined }).ok, false);
  assert.equal(parseRescueRequest({ ...body, ingredients: [] }).ok, false);
  assert.equal(parseRescueRequest({ ...body, steps: 'hervir' }).ok, false);
  assert.equal(parseRescueRequest(null).ok, false);
});

test('empty and very long descriptions are handled with a clear message', () => {
  // Empty is fine when the problem is already chosen.
  const empty = parseRescueRequest({ ...body, description: '' });
  assert.ok(empty.ok);
  assert.equal(empty.value.description, '');

  const other = parseRescueRequest({ ...body, problem: 'otro', description: '  ' });
  assert.equal(other.ok, false);
  assert.match(other.ok ? '' : other.error, /Cuenta qué pasó/);

  const long = parseRescueRequest({ ...body, description: 'a'.repeat(501) });
  assert.equal(long.ok, false);
  assert.match(long.ok ? '' : long.error, /muy larga/);
  assert.equal(parseRescueRequest({ ...body, description: 'a'.repeat(500) }).ok, true);
});

test('a missing or broken current step is left out', () => {
  const none = parseRescueRequest({ ...body, currentStep: undefined });
  assert.ok(none.ok);
  assert.equal(none.value.currentStep, undefined);
  const broken = parseRescueRequest({ ...body, currentStep: { stepNumber: 0, instruction: '' } });
  assert.ok(broken.ok);
  assert.equal(broken.value.currentStep, undefined);
});

test('the prompt carries the recipe, the problem and what the person has', () => {
  const [system, user] = buildRescueMessages(parsed());
  assert.equal(system.role, 'system');
  assert.match(user.content, /Receta: Sopa de Fideo/);
  assert.match(user.content, /- 200 g de Pasta \/ Espagueti/);
  assert.match(user.content, /Lo que salió mal: Muy salado/);
  assert.match(user.content, /Va en el paso 2 \(Hervir\): Agrega el caldo y hierve 10 minutos\./);
  assert.match(user.content, /Lo que cuenta la persona: "Le eché demasiada sal al caldo"/);
  assert.match(user.content, /a la mano: Limones, Crema ácida/);
  assert.match(user.content, /Nunca propongas comer comida con moho/);

  const bare = buildRescueMessages({ ...parsed(), description: '', currentStep: undefined, available: [] });
  assert.match(bare[1].content, /No dijo en qué paso va/);
  assert.match(bare[1].content, /No dio más detalles/);
  assert.match(bare[1].content, /ninguno \(solo agua\)/);
});

test('dangerous cases are answered by the safety rules without asking the model', async () => {
  const llm = await startFakeLlm((_body, res) => answer(res, goodAnswer));
  try {
    const spoiled = blockedRescueAnswer({ ...parsed(), description: 'La crema huele raro' });
    assert.ok(spoiled);
    assert.equal(spoiled.blocked, true);
    assert.deepEqual(spoiled.steps, []);
    assert.match(spoiled.diagnosis, /no se rescata/);

    const raw = blockedRescueAnswer({ ...parsed(), problem: 'quedo-crudo', description: 'el pollo quedó crudo por dentro' });
    assert.ok(raw);
    assert.match(raw.diagnosis, /sigue cocinando/);

    // A normal problem is not blocked, and nothing reached the fake model.
    assert.equal(blockedRescueAnswer(parsed()), null);
    assert.equal(llm.requests.length, 0);
  } finally {
    await llm.close();
  }
});

test('rescueWithLocalAi returns a clean plan from the local model', async () => {
  const llm = await startFakeLlm((_body, res) => answer(res, '```json\n' + goodAnswer + '\n```'));
  try {
    const result = await rescueWithLocalAi(llm.cfg, parsed());
    assert.equal(result.diagnosis, 'La sal se concentró en el caldo.');
    assert.equal(result.steps.length, 3);
    assert.equal(result.steps[0].instruction, 'Agrega una taza de agua caliente y prueba.');
    assert.deepEqual(result.warnings, ['No agregues más sal.']);
    assert.equal(result.blocked, undefined);

    const sent = llm.requests[0];
    assert.equal(sent.model, 'modelo-prueba');
    assert.equal(sent.temperature, 0.3);
    assert.equal(sent.response_format.type, 'json_schema');
    assert.equal(sent.response_format.json_schema.name, 'plan_de_rescate');
  } finally {
    await llm.close();
  }
});

test('steps that use an ingredient the person does not have are dropped', () => {
  const raw = {
    diagnosis: 'Mucha sal.',
    steps: [
      { instruction: 'Agrega leche de coco.', uses: ['leche de coco'] },
      { instruction: 'Agrega miel.', uses: ['miel'] },
      { instruction: 'Agrega jitomate picado.', uses: ['jitomate'] },
      { instruction: 'Agrega crema ácida.', uses: ['Crema ácida'] },
      { instruction: 'Agrega agua.', uses: ['agua'] },
      { instruction: 'Mezcla bien y prueba.', uses: [] },
    ],
    warnings: [],
  };
  const result = normalizeRescueAnswer(raw, parsed());
  assert.deepEqual(
    result.steps.map((s) => s.instruction),
    ['Agrega jitomate picado.', 'Agrega crema ácida.', 'Agrega agua.', 'Mezcla bien y prueba.']
  );
});

test('unsafe advice from the model is dropped', () => {
  const raw = {
    diagnosis: 'Algo pasó.',
    steps: [
      { instruction: 'Quita el moho y sírvelo igual.', uses: [] },
      { instruction: 'Raspa el fondo y mézclalo con todo.', uses: [] },
      { instruction: 'Prueba una cucharada y ajusta.', uses: [] },
    ],
    warnings: ['Si hay moho, quítalo con una cuchara.', 'Prueba antes de servir.'],
  };
  const result = normalizeRescueAnswer(raw, parsed());
  assert.deepEqual(result.steps.map((s) => s.instruction), ['Prueba una cucharada y ajusta.']);
  assert.deepEqual(result.warnings, ['Prueba antes de servir.']);
});

test('the plan keeps at most five steps and three warnings', () => {
  const raw = {
    diagnosis: 'x',
    steps: Array.from({ length: 9 }, (_, i) => ({ instruction: `Paso ${i + 1}`, uses: [] })),
    warnings: ['a', 'b', 'c', 'd', 'e'],
  };
  const result = normalizeRescueAnswer(raw, parsed());
  assert.equal(result.steps.length, 5);
  assert.equal(result.warnings.length, 3);
});

test('an odd answer is reported as a bad response', async () => {
  const cases = ['{"diagnosis":"nada","steps":[],"warnings":[]}', '{"algo":"raro"}', '["solo","texto"]'];
  for (const content of cases) {
    const llm = await startFakeLlm((_body, res) => answer(res, content));
    try {
      await assert.rejects(rescueWithLocalAi(llm.cfg, parsed()), (error: unknown) => {
        assert.ok(error instanceof LlmError);
        assert.equal(error.code, 'bad_response');
        return true;
      });
    } finally {
      await llm.close();
    }
  }

  // Every step names something the person does not have.
  const onlyForeign = JSON.stringify({
    diagnosis: 'x',
    steps: [{ instruction: 'Agrega leche de coco.', uses: ['leche de coco'] }],
    warnings: [],
  });
  const llm = await startFakeLlm((_body, res) => answer(res, onlyForeign));
  try {
    await assert.rejects(rescueWithLocalAi(llm.cfg, parsed()), { code: 'bad_response' });
  } finally {
    await llm.close();
  }
});

test('servers without json_schema support get a second try in JSON mode', async () => {
  const llm = await startFakeLlm((req, res) => {
    if (req.response_format.type === 'json_schema') {
      res.writeHead(400);
      res.end('json_schema not supported');
      return;
    }
    answer(res, goodAnswer);
  });
  try {
    const result = await rescueWithLocalAi(llm.cfg, parsed());
    assert.equal(result.steps.length, 3);
    assert.equal(llm.requests.length, 2);
    assert.equal(llm.requests[1].response_format.type, 'json_object');
  } finally {
    await llm.close();
  }
});

test('an unreachable model, a timeout and a cancelled request give their own errors', async () => {
  const off = await startFakeLlm(() => {});
  const offCfg = off.cfg;
  await off.close();
  await assert.rejects(rescueWithLocalAi(offCfg, parsed()), { code: 'unreachable' });

  const slow = await startFakeLlm((_body, res) => setTimeout(() => answer(res, goodAnswer), 2000));
  try {
    await assert.rejects(rescueWithLocalAi({ ...slow.cfg, timeoutMs: 100 }, parsed()), { code: 'timeout' });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    await assert.rejects(rescueWithLocalAi(slow.cfg, parsed(), controller.signal), { code: 'aborted' });
  } finally {
    await slow.close();
  }
});
