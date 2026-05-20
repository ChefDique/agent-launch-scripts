'use strict';

const TERMINAL_WORD_KEY_SEQUENCES = new Map([
  ['\x1bb', ['Escape', 'b']],
  ['\x1bf', ['Escape', 'f']],
  ['\x1b\x7f', ['Escape', 'BSpace']],
  ['\x1b\b', ['Escape', 'BSpace']],
  ['\x1bd', ['Escape', 'd']],
  ['\x1b[1;3D', ['Escape', 'b']],
  ['\x1b[1;3C', ['Escape', 'f']],
  ['\x1b[3;3~', ['Escape', 'd']],
]);

function terminalWordShortcutBytes(ev) {
  if (!ev || ev.type !== 'keydown') return null;
  if (!ev.altKey || ev.ctrlKey || ev.metaKey) return null;

  const key = (ev.key || '').toLowerCase();
  const code = ev.code || '';

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
