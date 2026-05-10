const { test } = require('node:test');
const assert = require('node:assert');
const { getModelsForHarness, getDefaultModelForHarness } = require('../harness-models');

test('claude harness has Opus 4.7 + Sonnet 4.6 as available models', () => {
  const models = getModelsForHarness('claude');
  assert.ok(models.length >= 2, `expected >=2 claude models, got ${models.length}`);
  assert.ok(models.some(m => m.id === 'claude-opus-4-7[1m]'), 'expected Opus 1M ctx');
  assert.ok(models.some(m => m.id === 'claude-sonnet-4-6'), 'expected Sonnet 4.6');
});

test('codex harness includes the full gpt-5 model lineup', () => {
  const models = getModelsForHarness('codex');
  const ids = models.map(m => m.id);
  const required = [
    'gpt-5.5',
    'gpt-5',
    'gpt-5-codex',
    'gpt-5.1',
    'gpt-5.1-codex',
    'gpt-5-mini',
    'gpt-5-nano'
  ];
  for (const id of required) {
    assert.ok(ids.includes(id), `expected "${id}" in codex model list`);
  }
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

// Regression: the previous loader cached the parsed JSON in module scope and
// only invalidated on an explicit reloadHarnessModels() call. Editing
// config/harness-models.json while AgentRemote was running silently served the
// stale boot-time snapshot — Richard hit this when the codex lineup was
// expanded from 2 → 7 models and the dropdown still showed only 5.5 + 5 until
// an app restart. The fix drops the cache so each ipc roundtrip reads fresh.
test('loader reflects on-disk JSON changes without process restart', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const configPath = path.join(__dirname, '..', 'config', 'harness-models.json');
  const original = fs.readFileSync(configPath, 'utf8');
  try {
    const patched = JSON.parse(original);
    patched.codex = patched.codex || { default: 'gpt-5', models: [] };
    patched.codex.models = [
      ...patched.codex.models,
      { id: '__reload-canary__', label: 'Reload canary' }
    ];
    fs.writeFileSync(configPath, JSON.stringify(patched, null, 2));
    const ids = getModelsForHarness('codex').map(m => m.id);
    assert.ok(ids.includes('__reload-canary__'),
      'expected getModelsForHarness to see canary entry written after module load');
  } finally {
    fs.writeFileSync(configPath, original);
  }
});
