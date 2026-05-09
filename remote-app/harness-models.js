const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config', 'harness-models.json');

let cached = null;

function load() {
  if (cached) return cached;
  try {
    cached = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    cached = {};
  }
  return cached;
}

function entryFor(runtime) {
  const config = load();
  return config[String(runtime || '').toLowerCase()] || null;
}

function getModelsForHarness(runtime) {
  const entry = entryFor(runtime);
  return entry && Array.isArray(entry.models) ? entry.models : [];
}

function getDefaultModelForHarness(runtime) {
  const entry = entryFor(runtime);
  return entry && entry.default ? entry.default : null;
}

function reloadHarnessModels() {
  cached = null;
  return load();
}

module.exports = {
  getModelsForHarness,
  getDefaultModelForHarness,
  reloadHarnessModels
};
