const { test } = require('node:test');
const assert = require('node:assert');
const {
  getModelsForHarness,
  getDefaultModelForHarness,
  getReasoningLevelsForHarness,
  getDefaultReasoningForHarness,
  getReasoningLabelForHarness,
  isModelSupportedForHarness
} = require('../harness-models');

test('claude harness has Opus 4.7 + Sonnet 4.6 as available models', () => {
  const models = getModelsForHarness('claude');
  assert.ok(models.length >= 2, `expected >=2 claude models, got ${models.length}`);
  assert.ok(models.some(m => m.id === 'claude-opus-4-7[1m]'), 'expected Opus 1M ctx');
  assert.ok(models.some(m => m.id === 'claude-sonnet-4-6'), 'expected Sonnet 4.6');
});

test('codex harness exposes the current local GPT catalog with gpt-5.5 as default', () => {
  const models = getModelsForHarness('codex');
  const ids = models.map(m => m.id);
  assert.strictEqual(ids[0], 'gpt-5.5');
  for (const expected of [
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.3-codex',
    'gpt-5.3-codex-spark',
    'gpt-5.2'
  ]) {
    assert.ok(ids.includes(expected), `expected Codex model ${expected}`);
  }
  assert.strictEqual(getDefaultModelForHarness('codex'), 'gpt-5.5');
  for (const stale of [
    'gpt-5',
    'gpt-5-codex',
    'gpt-5.1',
    'gpt-5.1-codex',
    'gpt-5-mini',
    'gpt-5-nano'
  ]) {
    assert.ok(!ids.includes(stale), `stale Codex model "${stale}" should not be in the settings list`);
  }
});

test('claude default is the 1M-ctx Opus to match registry expectation', () => {
  assert.strictEqual(getDefaultModelForHarness('claude'), 'claude-opus-4-7[1m]');
});

test('codex default is the coding model', () => {
  assert.strictEqual(getDefaultModelForHarness('codex'), 'gpt-5.5');
});

test('codex exposes thinking-level wording and xhigh effort', () => {
  assert.strictEqual(getReasoningLabelForHarness('codex'), 'thinking level');
  assert.strictEqual(getDefaultReasoningForHarness('codex'), 'xhigh');
  assert.ok(getReasoningLevelsForHarness('codex').some(level => level.id === 'xhigh'));
});

test('all supported harnesses expose configurable model lists', () => {
  for (const harness of ['claude', 'codex', 'hermes', 'openclaw']) {
    const models = getModelsForHarness(harness);
    assert.ok(models.length > 0, `${harness} should expose at least one model option`);
    assert.ok(getDefaultModelForHarness(harness), `${harness} should expose a default model`);
  }
  assert.ok(getModelsForHarness('hermes').some(m => m.id === 'default'), 'Hermes should include its default model option');
  assert.ok(getModelsForHarness('openclaw').some(m => m.id === 'local'), 'OpenClaw should include its local runtime model option');
});

test('all supported harnesses expose reasoning or thinking levels', () => {
  for (const harness of ['claude', 'codex', 'hermes', 'openclaw']) {
    const levels = getReasoningLevelsForHarness(harness);
    assert.ok(levels.length > 0, `${harness} should expose reasoning/thinking options`);
    assert.ok(getDefaultReasoningForHarness(harness), `${harness} should expose a default reasoning/thinking level`);
  }
  assert.strictEqual(getReasoningLabelForHarness('openclaw'), 'thinking');
  assert.ok(getReasoningLevelsForHarness('claude').some(level => level.id === 'xhigh'), 'Claude effort should include xhigh from CLI help');
  assert.ok(getReasoningLevelsForHarness('codex').some(level => level.id === 'xhigh'), 'Codex reasoning should include xhigh');
  assert.ok(getReasoningLevelsForHarness('openclaw').some(level => level.id === 'max'), 'OpenClaw thinking should include max');
});

test('registered Codex agents do not pin stale GPT model ids', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'agents.json'), 'utf8'));
  const valid = new Set(getModelsForHarness('codex').map(m => m.id));
  const stale = [];
  for (const agent of registry.agents || []) {
    if (String(agent.runtime || 'codex').toLowerCase() !== 'codex') continue;
    if (agent.model && !valid.has(agent.model)) stale.push(`${agent.id}:${agent.model}`);
  }
  assert.deepStrictEqual(stale, []);
});

test('unknown harness returns empty list and null default (no throw)', () => {
  assert.deepStrictEqual(getModelsForHarness('does-not-exist'), []);
  assert.strictEqual(getDefaultModelForHarness('does-not-exist'), null);
  assert.deepStrictEqual(getReasoningLevelsForHarness('does-not-exist'), []);
  assert.strictEqual(getDefaultReasoningForHarness('does-not-exist'), null);
  assert.strictEqual(getReasoningLabelForHarness('does-not-exist'), 'reasoning');
});

test('case-insensitive harness lookup', () => {
  assert.ok(getModelsForHarness('CLAUDE').length > 0, 'CLAUDE should match claude');
  assert.strictEqual(getDefaultModelForHarness('Codex'), 'gpt-5.5');
  assert.strictEqual(getDefaultReasoningForHarness(' Codex '), 'xhigh');
  assert.strictEqual(getDefaultReasoningForHarness('OpenClaw'), 'high');
});

test('codex model list can be declared from env as an allowlist', () => {
  const oldDefault = process.env.AGENTREMOTE_CODEX_DEFAULT_MODEL;
  const oldModels = process.env.AGENTREMOTE_CODEX_MODELS;
  try {
    process.env.AGENTREMOTE_CODEX_DEFAULT_MODEL = 'gpt-live-default';
    process.env.AGENTREMOTE_CODEX_MODELS = 'gpt-live-default,gpt-live-fast';
    assert.deepStrictEqual(getModelsForHarness('codex').map(m => m.id), [
      'gpt-live-default',
      'gpt-live-fast'
    ]);
    assert.strictEqual(getDefaultModelForHarness('codex'), 'gpt-live-default');
    assert.strictEqual(isModelSupportedForHarness('codex', 'gpt-live-fast'), true);
    assert.strictEqual(isModelSupportedForHarness('codex', 'gpt-5.1'), false);
  } finally {
    if (oldDefault === undefined) delete process.env.AGENTREMOTE_CODEX_DEFAULT_MODEL;
    else process.env.AGENTREMOTE_CODEX_DEFAULT_MODEL = oldDefault;
    if (oldModels === undefined) delete process.env.AGENTREMOTE_CODEX_MODELS;
    else process.env.AGENTREMOTE_CODEX_MODELS = oldModels;
  }
});

test('codex model list follows CODEX_CONFIG when no env override is set', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const oldConfig = process.env.CODEX_CONFIG;
  const oldCache = process.env.CODEX_MODELS_CACHE;
  const oldDefault = process.env.AGENTREMOTE_CODEX_DEFAULT_MODEL;
  const oldModels = process.env.AGENTREMOTE_CODEX_MODELS;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-models-'));
  const configPath = path.join(dir, 'config.toml');
  try {
    delete process.env.AGENTREMOTE_CODEX_DEFAULT_MODEL;
    delete process.env.AGENTREMOTE_CODEX_MODELS;
    process.env.CODEX_CONFIG = configPath;
    process.env.CODEX_MODELS_CACHE = path.join(dir, 'missing-model-cache.json');
    fs.writeFileSync(configPath, 'model = "gpt-config-default"\n');
    assert.deepStrictEqual(getModelsForHarness('codex').map(m => m.id), [
      'gpt-config-default',
      'gpt-5.5',
      'gpt-5.4',
      'gpt-5.4-mini',
      'gpt-5.3-codex',
      'gpt-5.3-codex-spark',
      'gpt-5.2'
    ]);
    assert.strictEqual(getDefaultModelForHarness('codex'), 'gpt-config-default');
  } finally {
    if (oldConfig === undefined) delete process.env.CODEX_CONFIG;
    else process.env.CODEX_CONFIG = oldConfig;
    if (oldCache === undefined) delete process.env.CODEX_MODELS_CACHE;
    else process.env.CODEX_MODELS_CACHE = oldCache;
    if (oldDefault === undefined) delete process.env.AGENTREMOTE_CODEX_DEFAULT_MODEL;
    else process.env.AGENTREMOTE_CODEX_DEFAULT_MODEL = oldDefault;
    if (oldModels === undefined) delete process.env.AGENTREMOTE_CODEX_MODELS;
    else process.env.AGENTREMOTE_CODEX_MODELS = oldModels;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('codex model list refreshes from the local Codex model cache when present', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const oldCache = process.env.CODEX_MODELS_CACHE;
  const oldDefault = process.env.AGENTREMOTE_CODEX_DEFAULT_MODEL;
  const oldModels = process.env.AGENTREMOTE_CODEX_MODELS;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-model-cache-'));
  const cachePath = path.join(dir, 'models_cache.json');
  try {
    delete process.env.AGENTREMOTE_CODEX_DEFAULT_MODEL;
    delete process.env.AGENTREMOTE_CODEX_MODELS;
    process.env.CODEX_MODELS_CACHE = cachePath;
    fs.writeFileSync(cachePath, JSON.stringify({
      models: [
        { slug: 'gpt-6.0', display_name: 'GPT-6.0' },
        { slug: 'codex-auto-review', display_name: 'Codex Auto Review' }
      ]
    }));
    const ids = getModelsForHarness('codex').map(m => m.id);
    assert.ok(ids.includes('gpt-6.0'), 'expected cache-discovered GPT model');
    assert.ok(!ids.includes('codex-auto-review'), 'review-only Codex model should not appear in runtime picker');
    assert.ok(ids.includes('gpt-5.5'), 'configured fallback models should remain available');
  } finally {
    if (oldCache === undefined) delete process.env.CODEX_MODELS_CACHE;
    else process.env.CODEX_MODELS_CACHE = oldCache;
    if (oldDefault === undefined) delete process.env.AGENTREMOTE_CODEX_DEFAULT_MODEL;
    else process.env.AGENTREMOTE_CODEX_DEFAULT_MODEL = oldDefault;
    if (oldModels === undefined) delete process.env.AGENTREMOTE_CODEX_MODELS;
    else process.env.AGENTREMOTE_CODEX_MODELS = oldModels;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('every catalog entry has both id and label fields', () => {
  for (const harness of ['claude', 'codex', 'hermes', 'openclaw']) {
    for (const m of getModelsForHarness(harness)) {
      assert.ok(typeof m.id === 'string' && m.id.length > 0, `${harness} model missing id`);
      assert.ok(typeof m.label === 'string' && m.label.length > 0, `${harness} model missing label`);
    }
    for (const level of getReasoningLevelsForHarness(harness)) {
      assert.ok(typeof level.id === 'string' && level.id.length > 0, `${harness} reasoning level missing id`);
      assert.ok(typeof level.label === 'string' && level.label.length > 0, `${harness} reasoning level missing label`);
    }
  }
});

// Regression: the previous loader cached the parsed JSON in module scope and
// only invalidated on an explicit reloadHarnessModels() call. Editing
// config/harness-models.json while AgentRemote was running silently served the
// stale boot-time snapshot — Richard hit this when the codex lineup changed
// and the dropdown still showed old GPT entries until
// an app restart. The fix drops the cache so each ipc roundtrip reads fresh.
test('loader reflects on-disk JSON changes without process restart', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const configPath = path.join(__dirname, '..', 'config', 'harness-models.json');
  const original = fs.readFileSync(configPath, 'utf8');
  try {
    const patched = JSON.parse(original);
    patched.hermes = patched.hermes || { default: 'default', models: [] };
    patched.hermes.models = [
      ...patched.hermes.models,
      { id: '__reload-canary__', label: 'Reload canary' }
    ];
    fs.writeFileSync(configPath, JSON.stringify(patched, null, 2));
    const ids = getModelsForHarness('hermes').map(m => m.id);
    assert.ok(ids.includes('__reload-canary__'),
      'expected getModelsForHarness to see canary entry written after module load');
  } finally {
    fs.writeFileSync(configPath, original);
  }
});
