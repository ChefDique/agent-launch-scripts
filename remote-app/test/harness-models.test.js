const { test } = require('node:test');
const assert = require('node:assert');
const { getModelsForHarness, getDefaultModelForHarness } = require('../harness-models');

test('claude harness has Opus 4.7 + Sonnet 4.6 as available models', () => {
  const models = getModelsForHarness('claude');
  assert.ok(models.length >= 2, `expected >=2 claude models, got ${models.length}`);
  assert.ok(models.some(m => m.id === 'claude-opus-4-7[1m]'), 'expected Opus 1M ctx');
  assert.ok(models.some(m => m.id === 'claude-sonnet-4-6'), 'expected Sonnet 4.6');
});

test('codex harness includes gpt-5.5', () => {
  const models = getModelsForHarness('codex');
  assert.ok(models.some(m => m.id === 'gpt-5.5'), 'expected gpt-5.5 in codex models');
});

test('claude default is the 1M-ctx Opus to match registry expectation', () => {
  assert.strictEqual(getDefaultModelForHarness('claude'), 'claude-opus-4-7[1m]');
});

test('codex default is gpt-5.5', () => {
  assert.strictEqual(getDefaultModelForHarness('codex'), 'gpt-5.5');
});

test('unknown harness returns empty list and null default (no throw)', () => {
  assert.deepStrictEqual(getModelsForHarness('does-not-exist'), []);
  assert.strictEqual(getDefaultModelForHarness('does-not-exist'), null);
});

test('case-insensitive harness lookup', () => {
  assert.ok(getModelsForHarness('CLAUDE').length > 0, 'CLAUDE should match claude');
  assert.strictEqual(getDefaultModelForHarness('Codex'), 'gpt-5.5');
});

test('every model entry has both id and label fields', () => {
  for (const harness of ['claude', 'codex']) {
    for (const m of getModelsForHarness(harness)) {
      assert.ok(typeof m.id === 'string' && m.id.length > 0, `${harness} model missing id`);
      assert.ok(typeof m.label === 'string' && m.label.length > 0, `${harness} model missing label`);
    }
  }
});
