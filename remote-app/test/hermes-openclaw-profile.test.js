const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
}

// --------------------------------------------------------------------------
// buildProfileId helper — extracted from the renderer for unit testing.
// Must match the inline definition in index.html exactly.
// --------------------------------------------------------------------------
function buildProfileId(runtime, profile) {
  const slug = String(profile || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug ? `${slug}-${runtime}-tmux` : '';
}

function isProfileRuntime(runtime) {
  return runtime === 'hermes' || runtime === 'openclaw';
}

// --------------------------------------------------------------------------
// Unit tests for the buildProfileId helper
// --------------------------------------------------------------------------

test('hermes runtime: profile="aria" → id="aria-hermes-tmux"', () => {
  assert.strictEqual(buildProfileId('hermes', 'aria'), 'aria-hermes-tmux');
});

test('openclaw runtime: profile="aria" → id="aria-openclaw-tmux"', () => {
  assert.strictEqual(buildProfileId('openclaw', 'aria'), 'aria-openclaw-tmux');
});

test('buildProfileId normalises uppercase and spaces in profile name', () => {
  assert.strictEqual(buildProfileId('hermes', 'My Agent'), 'my-agent-hermes-tmux');
});

test('buildProfileId returns empty string when profile is empty', () => {
  assert.strictEqual(buildProfileId('hermes', ''), '');
  assert.strictEqual(buildProfileId('hermes', '   '), '');
});

test('isProfileRuntime returns true only for hermes and openclaw', () => {
  assert.ok(isProfileRuntime('hermes'),   'hermes should be a profile runtime');
  assert.ok(isProfileRuntime('openclaw'), 'openclaw should be a profile runtime');
  assert.ok(!isProfileRuntime('claude'),  'claude should NOT be a profile runtime');
  assert.ok(!isProfileRuntime('codex'),   'codex should NOT be a profile runtime');
});

// --------------------------------------------------------------------------
// Renderer source tests — verify the field-swap logic is present in index.html
// --------------------------------------------------------------------------

test('index.html defines isProfileRuntime and buildProfileId helpers', () => {
  const html = readRepoFile('index.html');
  assert.match(html, /function isProfileRuntime\(runtime\)/,
    'isProfileRuntime must be defined in the renderer');
  assert.match(html, /function buildProfileId\(runtime, profile\)/,
    'buildProfileId must be defined in the renderer');
});

test('add-agent form: profile row and model row are both present (toggled by runtime)', () => {
  const html = readRepoFile('index.html');
  assert.match(html, /id="f-profile-row"/,  'profile row must exist in add-agent form');
  assert.match(html, /id="f-profile"/,       'profile input must exist in add-agent form');
  assert.match(html, /id="f-model-row"/,     'model row must exist in add-agent form');
  assert.match(html, /id="f-model"/,         'model select must exist in add-agent form');
});

test('add-agent form: setAddHarnessRuntime keeps model row and shows profile row for profile runtimes', () => {
  const html = readRepoFile('index.html');
  const block = html.slice(
    html.indexOf('function setAddHarnessRuntime'),
    html.indexOf('// Populate the add-agent form')
  );
  // The function must read isProfileRuntime and toggle only the profile/id
  // fields. Model/reasoning selectors remain catalog-backed for every runtime.
  assert.match(block, /useProfile.*isProfileRuntime/s,
    'setAddHarnessRuntime must use isProfileRuntime to determine field swap');
  assert.doesNotMatch(block, /f-model-row.*display.*none/s,
    'model row must remain visible when useProfile is true');
  assert.match(block, /populateAddFormModelOptions\(addFormRuntime\)/,
    'model row must be repopulated from the harness catalog for every runtime');
  assert.match(block, /populateAddFormReasoningOptions\(addFormRuntime\)/,
    'reasoning row must be repopulated from the harness catalog for every runtime');
  assert.match(block, /f-profile-row.*display/s,
    'profile row display must be toggled');
  assert.match(block, /f-id-row.*display.*none/s,
    'id row must be hidden for profile runtimes');
});

test('submitAdd derives registry id from buildProfileId for hermes/openclaw', () => {
  const html = readRepoFile('index.html');
  assert.match(html, /buildProfileId\(addFormRuntime, profileValue\)/,
    'submitAdd must call buildProfileId to compute the agent id for profile runtimes');
});

test('settings popover: profile row is additive for hermes/openclaw, model/reasoning always render', () => {
  const html = readRepoFile('index.html');
  assert.match(html, /set-profile-row/,  'settings popover must have set-profile-row');
  assert.match(html, /set-model-row/,    'settings popover must have set-model-row');
  assert.match(html, /set-reasoning-row/, 'settings popover must have set-reasoning-row');
  assert.match(html, /populateModelOptions\(agent\.runtime \|\| 'codex', agent\.model \|\| ''\)/,
    'settings popover must populate model options for every runtime');
  assert.match(html, /populateReasoningOptions\(agent\.runtime \|\| 'codex', agent\.reasoningEffort \|\| ''\)/,
    'settings popover must populate reasoning options for every runtime');
  // The conditional only controls the additional profile row.
  assert.match(html, /_settingsUseProfile.*isProfileRuntime/s,
    'settings popover must use isProfileRuntime for profile row visibility');
});

test('settings popover: profile save wiring uses buildProfileId', () => {
  const html = readRepoFile('index.html');
  assert.match(html, /buildProfileId\(agent\.runtime, v\)/,
    'profile save in settings popover must derive new id via buildProfileId');
  assert.match(html, /ipcRenderer\.invoke\('update-agent-form'/,
    'profile save must use update-agent-form because update-agent does not rename ids');
  assert.match(html, /originalId: id/,
    'profile save must preserve the original id for the rename path');
  assert.doesNotMatch(html, /patch: \{ id: newId \}/,
    'profile save must not send id through update-agent patch');
});

test('no hardcoded agent id string comparisons for runtime/chat/input paths (registry-first rule)', () => {
  const html = readRepoFile('index.html');
  // The AGENTS.md registry-first rule: per-id branching in runtime/chat/input
  // paths is banned. Form-level conditional rendering based on RUNTIME is allowed.
  // This test checks that the profile-field logic does not sneak in agent-id comparisons.
  // (The existing runtime-dynamic-contract test covers main.js — this covers the renderer.)
  assert.doesNotMatch(html, /agent\.id\s*(?:===|!==)\s*['"][a-z0-9_-]+['"]/i,
    'renderer must not contain hardcoded agent id comparisons in runtime paths');
});
