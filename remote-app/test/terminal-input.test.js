const assert = require('node:assert/strict');
const test = require('node:test');

const {
  terminalWordShortcutBytes,
  tmuxKeysForTerminalInput
} = require('../terminal-input');

function keydown(overrides = {}) {
  return {
    type: 'keydown',
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    key: '',
    code: '',
    ...overrides
  };
}

test('terminal input maps Option/Alt word navigation and deletion to readline bytes', () => {
  assert.equal(terminalWordShortcutBytes(keydown({ key: 'ArrowLeft', code: 'ArrowLeft' })), '\x1bb');
  assert.equal(terminalWordShortcutBytes(keydown({ key: 'ArrowRight', code: 'ArrowRight' })), '\x1bf');
  assert.equal(terminalWordShortcutBytes(keydown({ key: 'Backspace', code: 'Backspace' })), '\x1b\x7f');
  assert.equal(terminalWordShortcutBytes(keydown({ key: 'Delete', code: 'Delete' })), '\x1bd');
  assert.equal(terminalWordShortcutBytes(keydown({ key: 'b', code: 'KeyB' })), '\x1bb');
  assert.equal(terminalWordShortcutBytes(keydown({ key: 'f', code: 'KeyF' })), '\x1bf');
  assert.equal(terminalWordShortcutBytes(keydown({ key: 'd', code: 'KeyD' })), '\x1bd');
});

test('terminal input maps Control word-edit shortcuts to real control bytes', () => {
  assert.equal(terminalWordShortcutBytes(keydown({ altKey: false, ctrlKey: true, key: 'ArrowLeft', code: 'ArrowLeft' })), '\x1bb');
  assert.equal(terminalWordShortcutBytes(keydown({ altKey: false, ctrlKey: true, key: 'ArrowRight', code: 'ArrowRight' })), '\x1bf');
  assert.equal(terminalWordShortcutBytes(keydown({ altKey: false, ctrlKey: true, key: 'Backspace', code: 'Backspace' })), '\x17');
  assert.equal(terminalWordShortcutBytes(keydown({ altKey: false, ctrlKey: true, key: 'Delete', code: 'Delete' })), '\x1bd');
  assert.equal(terminalWordShortcutBytes(keydown({ altKey: false, ctrlKey: true, key: 'w', code: 'KeyW' })), '\x17');
  assert.equal(terminalWordShortcutBytes(keydown({ altKey: false, ctrlKey: true, key: 'u', code: 'KeyU' })), '\x15');
  assert.equal(terminalWordShortcutBytes(keydown({ altKey: false, ctrlKey: true, key: 'k', code: 'KeyK' })), '\x0b');
  assert.equal(terminalWordShortcutBytes(keydown({ altKey: false, ctrlKey: true, key: 'c', code: 'KeyC' })), '\x03');
});

test('terminal input leaves paste and non-Alt shortcuts alone', () => {
  assert.equal(terminalWordShortcutBytes(keydown({ altKey: false, ctrlKey: true, key: 'v', code: 'KeyV' })), null);
  assert.equal(terminalWordShortcutBytes(keydown({ altKey: true, metaKey: true, key: 'ArrowLeft', code: 'ArrowLeft' })), null);
  assert.equal(terminalWordShortcutBytes({ type: 'keyup', altKey: true, key: 'ArrowLeft', code: 'ArrowLeft' }), null);
});

test('terminal input converts readline and xterm modified-key bytes to tmux keys', () => {
  assert.deepEqual(tmuxKeysForTerminalInput('\x01'), ['C-a']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x03'), ['C-c']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x04'), ['C-d']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x05'), ['C-e']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x0b'), ['C-k']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x15'), ['C-u']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x17'), ['C-w']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x7f'), ['BSpace']);
  assert.deepEqual(tmuxKeysForTerminalInput('\b'), ['BSpace']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x1bb'), ['Escape', 'b']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x1bf'), ['Escape', 'f']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x1b\x7f'), ['Escape', 'BSpace']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x1b\b'), ['Escape', 'BSpace']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x1bd'), ['Escape', 'd']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x1b[1;3D'), ['Escape', 'b']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x1b[1;3C'), ['Escape', 'f']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x1b[3;3~'), ['Escape', 'd']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x1b[1;5D'), ['Escape', 'b']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x1b[1;5C'), ['Escape', 'f']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x1b[3;5~'), ['Escape', 'd']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x1b[127;5u'), ['C-w']);
  assert.deepEqual(tmuxKeysForTerminalInput('\x1b[8;5u'), ['C-w']);
  assert.equal(tmuxKeysForTerminalInput('plain text'), null);
});
