import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WALKTHROUGH_STEPS,
  clampWalkthroughIndex,
  getNextWalkthroughIndex,
  getPrevWalkthroughIndex,
  getWalkthroughProgressPercent,
  shouldAutoStartWalkthrough,
} from './walkthroughSteps.ts';

test('WALKTHROUGH_STEPS covers 7 sequential steps across core CociFlex tabs', () => {
  assert.equal(WALKTHROUGH_STEPS.length, 7);
  assert.deepEqual(
    WALKTHROUGH_STEPS.map((s) => s.stepNumber),
    [1, 2, 3, 4, 5, 6, 7]
  );
  assert.deepEqual(
    WALKTHROUGH_STEPS.map((s) => s.targetTab),
    ['inicio', 'inicio', 'cocina', 'cocina', 'cocina', 'fermentos', 'comunidad']
  );
  assert.equal(new Set(WALKTHROUGH_STEPS.map((s) => s.id)).size, WALKTHROUGH_STEPS.length);
  for (const step of WALKTHROUGH_STEPS) {
    assert.ok(step.title.length > 5);
    assert.ok(step.description.length > 20);
    assert.ok(step.targetSelector.startsWith('[data-tour='));
  }
});

test('the recipe-to-fit step introduces "Receta a tu medida" on the recipe grid', () => {
  const step = WALKTHROUGH_STEPS.find((s) => s.id === 'recipe-to-fit');
  assert.ok(step);
  assert.equal(step.stepNumber, 2);
  assert.equal(step.targetTab, 'inicio');
  assert.equal(step.targetSelector, '[data-tour="recipe-grid"]');
  assert.match(step.description, /No te alcanza algún ingrediente/);
});

test('the pantry-expiry step comes right after pantry-matcher and points to its panel', () => {
  const index = WALKTHROUGH_STEPS.findIndex((s) => s.id === 'pantry-expiry');
  assert.equal(index, WALKTHROUGH_STEPS.findIndex((s) => s.id === 'pantry-matcher') + 1);
  const step = WALKTHROUGH_STEPS[index];
  assert.equal(step.stepNumber, 4);
  assert.equal(step.targetTab, 'cocina');
  assert.equal(step.targetSelector, '[data-tour="pantry-expiry"]');
  assert.match(step.description, /caduca/);
});

test('every step points to an anchor that exists in the workspace', () => {
  const workspace = readFileSync(new URL('../components/CociflexWorkspace.tsx', import.meta.url), 'utf-8');
  for (const step of WALKTHROUGH_STEPS) {
    const anchor = step.targetSelector.match(/^\[data-tour="([\w-]+)"\]$/)?.[1];
    assert.ok(anchor, `${step.id} has a data-tour selector`);
    assert.ok(workspace.includes(`data-tour="${anchor}"`), `${anchor} exists in CociflexWorkspace.tsx`);
  }
});

test('getNextWalkthroughIndex and getPrevWalkthroughIndex clamp cleanly within bounds', () => {
  assert.equal(getPrevWalkthroughIndex(0), 0);
  assert.equal(getNextWalkthroughIndex(0), 1);
  assert.equal(getNextWalkthroughIndex(4), 5);
  assert.equal(getNextWalkthroughIndex(6), 6);
  assert.equal(getPrevWalkthroughIndex(6), 5);
  assert.equal(clampWalkthroughIndex(-5), 0);
  assert.equal(clampWalkthroughIndex(99), 6);
});

test('getWalkthroughProgressPercent computes accurate percentage milestones', () => {
  assert.equal(getWalkthroughProgressPercent(0), 14);
  assert.equal(getWalkthroughProgressPercent(2), 43);
  assert.equal(getWalkthroughProgressPercent(6), 100);
});

test('shouldAutoStartWalkthrough respects query overrides and stored completion flag', () => {
  assert.equal(shouldAutoStartWalkthrough('', null), true);
  assert.equal(shouldAutoStartWalkthrough('', 'false'), true);
  assert.equal(shouldAutoStartWalkthrough('', 'true'), false);
  assert.equal(shouldAutoStartWalkthrough('?walkthrough=1', 'true'), true);
  assert.equal(shouldAutoStartWalkthrough('?autostart=1', 'true'), true);
  assert.equal(shouldAutoStartWalkthrough('?walkthrough=0', null), false);
});
