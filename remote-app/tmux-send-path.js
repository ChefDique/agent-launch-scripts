'use strict';

// Why submitting is two-phase, not one `send-keys ... Enter` invocation:
//
// Codex, Claude Code, and other raw-mode TUIs do their own line editing. When
// the literal payload and the Enter key arrive in a SINGLE read() — which is
// what `send-keys -l text ; send-keys Enter` produces, because tmux flushes
// both in one write — the TUI treats the trailing CR as part of a paste and
// inserts a newline into the composer instead of submitting. The text just
// sits in the input box waiting for a human to press Enter.
//
// Splitting the Enter into its own send a beat later makes it arrive as an
// isolated keypress in a separate read(), which the TUI recognizes as a
// deliberate submit. The delay is load-bearing, not cosmetic. Line-buffered
// consumers (a shell reading via `cat`) submit either way, so the split is
// safe across runtimes. See docs/operations/agentremote-operator-contract.md
// ("Send means send and submit. Text must not merely appear in a terminal
// input box waiting for Richard to press Enter.").
const TMUX_SUBMIT_ENTER_DELAY_MS = 120;

function validateTmuxSendTarget(value) {
  const target = String(value || '').trim();
  if (!target || !/^(?:%[0-9]+|[a-z0-9_.:@/-]+)$/i.test(target)) {
    throw new Error('invalid tmux send target');
  }
  return target;
}

function normalizeSubmittedText(value) {
  const text = typeof value === 'string' ? value : '';
  if (!text) throw new Error('message required');
  return text;
}

// Phase 1 — deliver the payload as literal text (`-l` disables key-name lookup,
// `--` protects dash-prefixed payloads).
function tmuxSendLiteralArgs(target, text) {
  const message = normalizeSubmittedText(text);
  return ['send-keys', '-t', validateTmuxSendTarget(target), '-l', '--', message];
}

// Phase 2 — deliver a lone Enter keypress to submit the composer.
function tmuxSendEnterArgs(target) {
  return ['send-keys', '-t', validateTmuxSendTarget(target), 'Enter'];
}

// Combined single-invocation form. ONLY safe for line-buffered consumers (e.g. a
// shell reading via `cat`). TUIs require the two-phase split above, or the
// trailing Enter is absorbed into the paste and the message is never submitted.
function tmuxSendSubmittedTextArgs(target, text) {
  return [...tmuxSendLiteralArgs(target, text), ';', ...tmuxSendEnterArgs(target)];
}

module.exports = {
  TMUX_SUBMIT_ENTER_DELAY_MS,
  normalizeSubmittedText,
  tmuxSendLiteralArgs,
  tmuxSendEnterArgs,
  tmuxSendSubmittedTextArgs,
  validateTmuxSendTarget
};
