const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config', 'harness-models.json');

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

module.exports = {
  getModelsForHarness,
  getDefaultModelForHarness
};
