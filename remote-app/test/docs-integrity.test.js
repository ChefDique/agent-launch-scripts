const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..', '..');

function mustExist(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  assert.equal(fs.existsSync(fullPath), true, `${relativePath} should exist`);
}

test('AgentRemote startup docs point to existing control-plane artifacts', () => {
  [
    'tasks.json',
    'docs/product/agentremote-prd.md',
    'docs/product/agentremote-feature-index.md',
    'docs/operations/agentremote-quality-gates.md',
    'docs/operations/agentremote-completion-audit.md',
    'docs/operations/agentremote-operator-contract.md',
    'docs/operations/launch-scripts.md',
    'remote-app/AGENTS.md'
  ].forEach(mustExist);
});

test('root task board artifacts exist unless explicitly outside this repo', () => {
  const tasks = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tasks.json'), 'utf8'));
  for (const task of tasks.tasks || []) {
    for (const artifact of task.artifacts || []) {
      if (String(artifact).startsWith('message-agent ')) continue;
      mustExist(artifact);
    }
  }
});
