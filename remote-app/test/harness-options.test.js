const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_HARNESS_RUNTIME,
  HARNESS_OPTIONS,
  HARNESS_RUNTIME_IDS,
  harnessOptionFor,
  normalizeRuntime
} = require('../harness-options');

test('harness picker exposes the four supported local runtimes in display order', () => {
  assert.deepEqual(HARNESS_RUNTIME_IDS, ['claude', 'codex', 'hermes', 'openclaw']);
  assert.equal(DEFAULT_HARNESS_RUNTIME, 'codex');
});

test('every harness option has a local logo asset', () => {
  const assetsDir = path.join(__dirname, '..', 'assets');
  for (const option of HARNESS_OPTIONS) {
    assert.ok(option.label);
    assert.match(option.themeColor, /^#[0-9a-f]{6}$/i);
    assert.ok(fs.existsSync(path.join(assetsDir, option.logo)), `${option.logo} missing`);
  }
});

test('runtime normalization keeps invalid input on the Codex-safe default', () => {
  assert.equal(normalizeRuntime('claude'), 'claude');
  assert.equal(normalizeRuntime('OpenClaw'), 'openclaw');
  assert.equal(normalizeRuntime('bogus'), 'codex');
  assert.equal(normalizeRuntime(''), 'codex');
  assert.equal(harnessOptionFor('hermes').label, 'Hermes');
});
