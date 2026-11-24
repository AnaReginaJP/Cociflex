import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  adaptStepsWithLocalAi,
  buildPartitionMessages,
  parsePartitionStepsRequest,
  type PartitionStepsRequest,
} from './partitionAi.ts';
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

const request: PartitionStepsRequest = {
  title: 'Hotcakes caseros',
  percent: 60,
  servingsLabel: '3 porciones',
  originalServings: 5,
  limitingIngredient: 'Harina',
  ingredients: [
    { name: 'Harina', amount: '¾', unit: 'taza', omitted: false },
    { name: 'Huevos', amount: '1', unit: 'pieza', omitted: false },
    { name: 'Mermelada', amount: '0', unit: 'cucharadas', omitted: true },
  ],
  steps: [
    { title: 'Mezclar', instruction: 'Mezcla 1¼ tazas de harina con 2 huevos.', timeMinutes: 5 },
    { title: 'Cocinar', instruction: 'Cocina cada hotcake 2 minutos por lado.', timeMinutes: 10, tip: 'Usa fuego medio.' },
  ],
};

const goodAnswer = JSON.stringify({
  steps: [
    { stepNumber: 1, title: 'Mezclar', instruction: ' Mezcla ¾ taza de harina con 1 huevo. ', timeMinutes: 4, tip: '' },
    { stepNumber: 2, title: 'Cocinar', instruction: 'Cocina cada hotcake 2 minutos por lado.', timeMinutes: 0 },
  ],
  note: 'Usa un sartén chico y haz 3 hotcakes.',
});

test('parsePartitionStepsRequest accepts a valid body and rejects broken ones', () => {
  const ok = parsePartitionStepsRequest(request);
  assert.ok(ok.ok);
  assert.equal(ok.value.steps.length, 2);
  assert.equal(ok.value.ingredients[2].omitted, true);

  assert.equal(parsePartitionStepsRequest({ ...request, title: '' }).ok, false);
  assert.equal(parsePartitionStepsRequest({ ...request, percent: 100 }).ok, false);
  assert.equal(parsePartitionStepsRequest({ ...request, steps: [] }).ok, false);
  assert.equal(parsePartitionStepsRequest({ ...request, ingredients: 'harina' }).ok, false);
  assert.equal(parsePartitionStepsRequest(null).ok, false);
});

test('the prompt carries the reduced amounts and the original steps', () => {
  const [system, user] = buildPartitionMessages(request);
  assert.equal(system.role, 'system');
  assert.match(user.content, /60 %/);
  assert.match(user.content, /- ¾ taza de Harina/);
  assert.match(user.content, /No usará: Mermelada/);
  assert.match(user.content, /1\. Mezclar \(5 min\): Mezcla 1¼ tazas de harina con 2 huevos\./);
  assert.match(user.content, /Consejo: Usa fuego medio\./);
});

test('adaptStepsWithLocalAi returns clean steps from the local model', async () => {
  const llm = await startFakeLlm((_body, res) => answer(res, '```json\n' + goodAnswer + '\n```'));
  try {
    const result = await adaptStepsWithLocalAi(llm.cfg, request);
    assert.equal(result.steps.length, 2);
    assert.equal(result.steps[0].instruction, 'Mezcla ¾ taza de harina con 1 huevo.');
    assert.equal(result.steps[0].tip, undefined);
    assert.equal(result.steps[1].timeMinutes, undefined);
    assert.equal(result.note, 'Usa un sartén chico y haz 3 hotcakes.');

    const sent = llm.requests[0];
    assert.equal(sent.model, 'modelo-prueba');
    assert.equal(sent.temperature, 0.3);
    assert.equal(sent.response_format.type, 'json_schema');
    assert.equal(sent.response_format.json_schema.name, 'pasos_ajustados');
  } finally {
    await llm.close();
  }
});

test('servers without json_schema support get a second try in JSON mode', async () => {
  const llm = await startFakeLlm((body, res) => {
    if (body.response_format.type === 'json_schema') {
      res.writeHead(400);
      res.end('json_schema not supported');
      return;
    }
    answer(res, goodAnswer);
  });
  try {
    const result = await adaptStepsWithLocalAi(llm.cfg, request);
    assert.equal(result.steps.length, 2);
    assert.equal(llm.requests.length, 2);
    assert.equal(llm.requests[1].response_format.type, 'json_object');
  } finally {
    await llm.close();
  }
});

test('an answer without steps is reported as a bad response', async () => {
  const llm = await startFakeLlm((_body, res) => answer(res, '{"steps":[],"note":"nada"}'));
  try {
    await assert.rejects(adaptStepsWithLocalAi(llm.cfg, request), (error: unknown) => {
      assert.ok(error instanceof LlmError);
      assert.equal(error.code, 'bad_response');
      return true;
    });
  } finally {
    await llm.close();
  }
});

test('an unreachable model, a timeout and a cancelled request give their own errors', async () => {
  const off = await startFakeLlm(() => {});
  const offCfg = off.cfg;
  await off.close();
  await assert.rejects(adaptStepsWithLocalAi(offCfg, request), { code: 'unreachable' });

  const slow = await startFakeLlm((_body, res) => setTimeout(() => answer(res, goodAnswer), 2000));
  try {
    await assert.rejects(adaptStepsWithLocalAi({ ...slow.cfg, timeoutMs: 100 }, request), { code: 'timeout' });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    await assert.rejects(adaptStepsWithLocalAi(slow.cfg, request, controller.signal), { code: 'aborted' });
  } finally {
    await slow.close();
  }
});
