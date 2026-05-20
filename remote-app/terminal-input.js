'use strict';

const TERMINAL_WORD_KEY_SEQUENCES = new Map([
  ['\x01', ['C-a']],
  ['\x03', ['C-c']],
  ['\x04', ['C-d']],
  ['\x05', ['C-e']],
  ['\x0b', ['C-k']],
  ['\x15', ['C-u']],
  ['\x17', ['C-w']],
  ['\x7f', ['BSpace']],
  ['\b', ['BSpace']],
  ['\x1bb', ['Escape', 'b']],
  ['\x1bf', ['Escape', 'f']],
  ['\x1b\x7f', ['Escape', 'BSpace']],
  ['\x1b\b', ['Escape', 'BSpace']],
  ['\x1bd', ['Escape', 'd']],
  ['\x1b[1;3D', ['Escape', 'b']],
  ['\x1b[1;3C', ['Escape', 'f']],
  ['\x1b[3;3~', ['Escape', 'd']],
  ['\x1b[1;5D', ['Escape', 'b']],
  ['\x1b[1;5C', ['Escape', 'f']],
  ['\x1b[3;5~', ['Escape', 'd']],
  ['\x1b[127;5u', ['C-w']],
  ['\x1b[8;5u', ['C-w']],
]);

function terminalWordShortcutBytes(ev) {
  if (!ev || ev.type !== 'keydown') return null;
  if (ev.metaKey) return null;
  const hasAlt = Boolean(ev.altKey);
  const hasCtrl = Boolean(ev.ctrlKey);
  if (!hasAlt && !hasCtrl) return null;

  const key = (ev.key || '').toLowerCase();
  const code = ev.code || '';

  if (hasCtrl && !hasAlt) {
    if (code === 'ArrowLeft' || key === 'arrowleft') return '\x1bb';
    if (code === 'ArrowRight' || key === 'arrowright') return '\x1bf';
    if (code === 'Backspace' || key === 'backspace') return '\x17';
    if (code === 'Delete' || key === 'delete') return '\x1bd';
    if (code === 'KeyW' || key === 'w') return '\x17';
    if (code === 'KeyU' || key === 'u') return '\x15';
    if (code === 'KeyK' || key === 'k') return '\x0b';
    if (code === 'KeyA' || key === 'a') return '\x01';
    if (code === 'KeyE' || key === 'e') return '\x05';
    if (code === 'KeyC' || key === 'c') return '\x03';
    if (code === 'KeyD' || key === 'd') return '\x04';
    return null;
  }

  if (code === 'ArrowLeft' || key === 'arrowleft') return '\x1bb';
  if (code === 'ArrowRight' || key === 'arrowright') return '\x1bf';
  if (code === 'Backspace' || key === 'backspace') return '\x1b\x7f';
  if (code === 'Delete' || key === 'delete') return '\x1bd';
  if (code === 'KeyB' || key === 'b') return '\x1bb';
  if (code === 'KeyF' || key === 'f') return '\x1bf';
  if (code === 'KeyD' || key === 'd') return '\x1bd';

  return null;
}

function tmuxKeysForTerminalInput(data) {
  return TERMINAL_WORD_KEY_SEQUENCES.get(data) || null;
}

module.exports = {
  TERMINAL_WORD_KEY_SEQUENCES,
  terminalWordShortcutBytes,
  tmuxKeysForTerminalInput
};
