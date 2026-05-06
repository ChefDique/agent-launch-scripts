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
  assert.match(petWindow, /id="reply"/);
  assert.match(petWindow, /pet-send-message/);
  assert.match(petWindow, /chat-tail-init/);
});
