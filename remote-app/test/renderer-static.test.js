const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('add-agent form contains harness logo picker and Armory import affordance', () => {
  assert.match(html, /id="f-harness-picker"/);
  assert.match(html, /id="armory-import-btn"/);
  assert.match(html, /Import from Armory/);
});

test('add-agent form supports image avatars and harness mascot fallback', () => {
  assert.match(html, /optional image or gif path/);
  assert.match(html, /pick-avatar/);
  assert.match(html, /avatarFileForAgent/);
  assert.match(html, /harnessOptionFor\(agent\.runtime/);
});

test('popup surfaces include explicit close buttons and hidden restore copy is intentional', () => {
  assert.match(html, /id="f-close"/);
  assert.match(html, /id="chat-close-btn"/);
  assert.match(html, /id="settings-close-btn"/);
  assert.match(html, /\$\{hiddenAgentOrder\.length\} hidden/);
  assert.doesNotMatch(html, /··· \$\{hiddenAgentOrder\.length\}/);
});

test('dock add control is rendered as a two-line add-agent tile', () => {
  assert.match(html, /add-agent-tile/);
  assert.match(html, /<span class="add-plus">\+<\/span> ADD/);
  assert.match(html, /<span>AGENT<\/span>/);
});

test('right-click settings routes to the shared add/edit form', () => {
  assert.match(html, /function openEditAgentForm\(id\)/);
  assert.match(html, /action: \(\) => openEditAgentForm\(id\)/);
  assert.match(html, /id="f-autorestart"/);
  assert.match(html, /update-agent-form/);
});

test('agent pets are per-agent and use the Codex pet roster instead of a hard-coded companion', () => {
  assert.match(html, /id="agent-pet-layer"/);
  assert.match(html, /id="pet-picker"/);
  assert.match(html, /className = 'pet-toggle'/);
  assert.match(html, /list-codex-pets/);
  assert.match(html, /load-agent-pet-state/);
  assert.match(html, /show-agent-pet/);
  assert.match(html, /hide-agent-pet/);
  assert.doesNotMatch(html, /agentRemoteVisiblePets/);
  assert.doesNotMatch(html, /id="codex-pet"/);
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'assets', 'pets', 'goku')), false);
});

test('floating pet window has draggable sprite, mini log, close, and reply controls', () => {
  const petWindow = fs.readFileSync(path.join(__dirname, '..', 'pet-window.html'), 'utf8');
  assert.match(petWindow, /id="sprite"/);
  assert.match(petWindow, /id="log"/);
  assert.match(petWindow, /id="close"/);
  assert.match(petWindow, /id="collapse"/);
  assert.match(petWindow, /id="chat-tab"/);
  assert.match(petWindow, /id="reply-toggle"/);
  assert.match(petWindow, /id="reply"/);
  assert.match(petWindow, /chat-expanded/);
  assert.match(petWindow, /chat-collapsed/);
  assert.match(petWindow, /body\.chat-expanded \.sprite-wrap/);
  assert.match(petWindow, /min-height: min\(126px, calc\(100vh - 112px\)\)/);
  assert.match(petWindow, /chat-meta/);
  assert.match(petWindow, /overflow-wrap: anywhere/);
  assert.match(petWindow, /resize-grip/);
  assert.match(petWindow, /pet-send-message/);
  assert.match(petWindow, /chat-tail-init/);
  assert.doesNotMatch(petWindow, /class="bubble-head"/);
});

test('main process pet windows are resizable and broadcasts delay submit after literal text', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.match(main, /resizable: true/);
  assert.match(main, /minWidth: 320/);
  assert.match(main, /height: Math\.max\(238/);
  assert.match(main, /pet-set-mood/);
  assert.match(main, /pet-window-moving/);
  assert.match(main, /send-keys', '-t', coord, '-l', message/);
  assert.match(main, /setTimeout\(\(\) => \{/);
  assert.match(main, /send-keys', '-t', coord, 'C-m'/);
});

test('floating pet window maps Codex atlas rows and move events to moods', () => {
  const petWindow = fs.readFileSync(path.join(__dirname, '..', 'pet-window.html'), 'utf8');
  assert.match(petWindow, /mood-running-right/);
  assert.match(petWindow, /mood-running-left/);
  assert.match(petWindow, /mood-waving/);
  assert.match(petWindow, /mood-jumping/);
  assert.match(petWindow, /mood-failed/);
  assert.match(petWindow, /mood-waiting/);
  assert.match(petWindow, /mood-running/);
  assert.match(petWindow, /mood-review/);
  assert.match(petWindow, /pet-window-moving/);
  assert.match(petWindow, /pet-moving/);
  assert.match(html, /sendPetWindowMood/);
  assert.match(html, /sendPetWindowMood\(a\.id, 'review'\)/);
  assert.match(html, /sendPetWindowMood\(a\.id, 'sent', 1400\)/);
});

test('deploy surface keeps the operator path to one movable window per agent', () => {
  assert.match(html, /data-layout="ittab"/);
  assert.match(html, />EACH<\/button>/);
  assert.doesNotMatch(html, /data-layout="panes"/);
  assert.doesNotMatch(html, /data-layout="windows"/);
});

test('edit form allows agent id edits until the agent is running', () => {
  assert.match(html, /Stop this agent before changing its id/);
  assert.match(html, /originalId: editingAgentId/);
  assert.doesNotMatch(html, /idInput\.readOnly = agentFormMode === 'edit'/);
});
