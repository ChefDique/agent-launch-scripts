const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
}

test('pet pane stream filtering is module-backed and not agent or model name routed', () => {
  const petWindow = readRepoFile('pet-window.html');
  const filter = readRepoFile('pane-stream-filter.js');

  assert.match(petWindow, /require\('\.\/pane-stream-filter'\)/);
  assert.doesNotMatch(petWindow, /function sanitizePaneChunk|function isRenderablePaneLine|Opus\|Sonnet\|Claude\|Codex\|GPT/);
  assert.doesNotMatch(filter, /\b(?:Claude|Codex|Opus|Sonnet|GPT|Xavier|Lucius|Gekko|tmux-masta)\b/);
});

test('AgentRemote pet stream policy is registry data, not per-agent branches', () => {
  const main = readRepoFile('main.js');
  const petWindow = readRepoFile('pet-window.html');

  assert.match(main, /petStreamProfile: agent\.pet_stream_profile \|\| 'agent-agnostic-pane-stream-v1'/);
  assert.match(main, /petStreamProfileOptions: agent\.pet_stream_profile_options \|\| \{\}/);
  assert.match(main, /function supportsPetTranscriptStream\(agent\)/);
  assert.match(main, /function petStreamConfigForAgent\(agent\)/);
  assert.match(main, /petTranscriptStream: transcriptStream/);
  assert.match(main, /petPaneStream: paneStream/);
  assert.doesNotMatch(main, /agent\.id\s*(?:===|!==)\s*['"][a-z0-9_-]+['"]/i);
  assert.doesNotMatch(petWindow, /agentId\s*(?:===|!==)\s*['"][a-z0-9_-]+['"]/i);
});
