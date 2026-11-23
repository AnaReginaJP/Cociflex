import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WALKTHROUGH_STEPS,
  clampWalkthroughIndex,
  getNextWalkthroughIndex,
  getPrevWalkthroughIndex,
  getWalkthroughProgressPercent,
  shouldAutoStartWalkthrough,
} from './walkthroughSteps.ts';

test('WALKTHROUGH_STEPS covers 5 sequential steps across core CociFlex tabs', () => {
  assert.equal(WALKTHROUGH_STEPS.length, 5);
  assert.deepEqual(
    WALKTHROUGH_STEPS.map((s) => s.stepNumber),
    [1, 2, 3, 4, 5]
  );
  assert.deepEqual(
    WALKTHROUGH_STEPS.map((s) => s.targetTab),
    ['inicio', 'cocina', 'cocina', 'fermentos', 'comunidad']
  );
  for (const step of WALKTHROUGH_STEPS) {
    assert.ok(step.title.length > 5);
    assert.ok(step.description.length > 20);
    assert.ok(step.targetSelector.startsWith('[data-tour='));
  }
});

test('getNextWalkthroughIndex and getPrevWalkthroughIndex clamp cleanly within bounds', () => {
  assert.equal(getPrevWalkthroughIndex(0), 0);
  assert.equal(getNextWalkthroughIndex(0), 1);
  assert.equal(getNextWalkthroughIndex(3), 4);
  assert.equal(getNextWalkthroughIndex(4), 4);
  assert.equal(getPrevWalkthroughIndex(4), 3);
  assert.equal(clampWalkthroughIndex(-5), 0);
  assert.equal(clampWalkthroughIndex(99), 4);
});

test('getWalkthroughProgressPercent computes accurate percentage milestones', () => {
  assert.equal(getWalkthroughProgressPercent(0), 20);
  assert.equal(getWalkthroughProgressPercent(2), 60);
  assert.equal(getWalkthroughProgressPercent(4), 100);
});

test('shouldAutoStartWalkthrough respects query overrides and stored completion flag', () => {
  assert.equal(shouldAutoStartWalkthrough('', null), true);
  assert.equal(shouldAutoStartWalkthrough('', 'false'), true);
  assert.equal(shouldAutoStartWalkthrough('', 'true'), false);
  assert.equal(shouldAutoStartWalkthrough('?walkthrough=1', 'true'), true);
  assert.equal(shouldAutoStartWalkthrough('?autostart=1', 'true'), true);
  assert.equal(shouldAutoStartWalkthrough('?walkthrough=0', null), false);
});
