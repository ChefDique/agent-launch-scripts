const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config', 'harness-models.json');
function codexConfigPath() {
  return process.env.CODEX_CONFIG || path.join(os.homedir(), '.codex', 'config.toml');
}

// Read fresh on every call. The JSON is ~700 bytes and is only read when the
// add/edit-agent form opens, so the cache was never worth the staleness cost
// — editing config/harness-models.json while AgentRemote is running used to
// require an app restart for the dropdown to pick up new entries.
function load() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function csvEnv(...names) {
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) continue;
    const values = raw.split(',').map(item => item.trim()).filter(Boolean);
    if (values.length > 0) return values;
  }
  return [];
}

function dedupeModels(models) {
  const seen = new Set();
  const out = [];
  for (const model of models) {
    const id = typeof model === 'string' ? model : model && model.id;
    const label = typeof model === 'string' ? model : model && model.label;
    const trimmed = String(id || '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push({
      id: trimmed,
      label: String(label || trimmed).trim()
    });
  }
  return out;
}

function codexConfigModel() {
  let text = '';
  try {
    text = fs.readFileSync(codexConfigPath(), 'utf8');
  } catch {
    return null;
  }
  const match = text.match(/^\s*model\s*=\s*["']([^"']+)["']\s*$/m);
  return match ? match[1].trim() : null;
}

function normalizeCodexEntry(entry) {
  const dynamicDefault = (
    process.env.AGENTREMOTE_CODEX_DEFAULT_MODEL
    || process.env.SWARMY_CODEX_DEFAULT_MODEL
    || codexConfigModel()
    || entry.default
    || ''
  ).trim();
  const envModels = csvEnv('AGENTREMOTE_CODEX_MODELS', 'SWARMY_CODEX_MODELS');
  const modelSource = envModels.length > 0
    ? envModels
    : dynamicDefault
      ? [dynamicDefault]
      : entry.models || [];
  const models = dedupeModels([
    dynamicDefault ? { id: dynamicDefault, label: `${dynamicDefault} (current default)` } : null,
    ...modelSource
  ].filter(Boolean));

  return {
    ...entry,
    default: dynamicDefault || (models[0] && models[0].id) || '',
    models
  };
}

function entryFor(runtime) {
  const config = load();
  const key = String(runtime || '').toLowerCase();
  const entry = config[key] || null;
  if (!entry) return null;
  if (key === 'codex') return normalizeCodexEntry(entry);
  return entry;
}

function getModelsForHarness(runtime) {
  const entry = entryFor(runtime);
  return entry && Array.isArray(entry.models) ? entry.models : [];
}

function getDefaultModelForHarness(runtime) {
  const entry = entryFor(runtime);
  return entry && entry.default ? entry.default : null;
}

function getReasoningLevelsForHarness(runtime) {
  const entry = entryFor(runtime);
  return entry && Array.isArray(entry.reasoningLevels) ? entry.reasoningLevels : [];
}

function getDefaultReasoningForHarness(runtime) {
  const entry = entryFor(runtime);
  return entry && entry.defaultReasoning ? entry.defaultReasoning : null;
}

function getReasoningLabelForHarness(runtime) {
  const entry = entryFor(runtime);
  return entry && entry.reasoningLabel ? entry.reasoningLabel : 'reasoning';
}

function isModelSupportedForHarness(runtime, model) {
  const value = String(model || '').trim();
  if (!value) return false;
  return getModelsForHarness(runtime).some(item => item.id === value);
}

module.exports = {
  getModelsForHarness,
  getDefaultModelForHarness,
  getReasoningLevelsForHarness,
  getDefaultReasoningForHarness,
  getReasoningLabelForHarness,
  isModelSupportedForHarness
};
