const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TMUX_SUBMIT_ENTER_DELAY_MS,
  normalizeSubmittedText,
  tmuxSendLiteralArgs,
  tmuxSendEnterArgs,
  tmuxSendSubmittedTextArgs,
  validateTmuxSendTarget
} = require('../tmux-send-path');

test('literal send args carry the payload only — never a fused Enter/CR/LF', () => {
  // The whole point of the two-phase submit is that text and Enter are
  // separable so a TUI does not read them as one paste. If the literal phase
  // ever grows a trailing key/CR, the regression is back.
  assert.deepEqual(
    tmuxSendLiteralArgs('chq:2.0', '[image: /tmp/agentremote-pasted-images/paste-123.png]'),
    ['send-keys', '-t', 'chq:2.0', '-l', '--', '[image: /tmp/agentremote-pasted-images/paste-123.png]']
  );
  const args = tmuxSendLiteralArgs('%42', 'hello codex');
  assert.ok(!args.includes('Enter'), 'literal args must not include Enter');
  assert.ok(!args.some(a => /[\r\n]/.test(a)), 'literal args must not include CR/LF');
});

test('enter send args are a lone Enter keypress', () => {
  assert.deepEqual(tmuxSendEnterArgs('chq:2.0'), ['send-keys', '-t', 'chq:2.0', 'Enter']);
  assert.deepEqual(tmuxSendEnterArgs('%42'), ['send-keys', '-t', '%42', 'Enter']);
});

test('submit enter delay is a real, non-zero pause so the Enter lands in its own read', () => {
  assert.equal(typeof TMUX_SUBMIT_ENTER_DELAY_MS, 'number');
  assert.ok(TMUX_SUBMIT_ENTER_DELAY_MS >= 50, 'delay must be large enough to split the read');
});

test('literal phase protects dash-prefixed and key-looking payloads', () => {
  assert.deepEqual(
    tmuxSendLiteralArgs('%42', '-please inspect this pasted image'),
    ['send-keys', '-t', '%42', '-l', '--', '-please inspect this pasted image']
  );
  // "Enter" / "C-c" as chat text must go literal, not as key names.
  assert.deepEqual(tmuxSendLiteralArgs('%42', 'Enter'), ['send-keys', '-t', '%42', '-l', '--', 'Enter']);
  assert.deepEqual(tmuxSendLiteralArgs('%42', 'C-c'), ['send-keys', '-t', '%42', '-l', '--', 'C-c']);
});

test('combined single-invocation form stays available for line-buffered consumers', () => {
  // Documented as cat/shell-only; TUIs must use the two-phase split instead.
  assert.deepEqual(
    tmuxSendSubmittedTextArgs('chq:2.0', 'hi'),
    ['send-keys', '-t', 'chq:2.0', '-l', '--', 'hi', ';', 'send-keys', '-t', 'chq:2.0', 'Enter']
  );
});

test('send path rejects suspicious targets and empty messages', () => {
  assert.equal(validateTmuxSendTarget('%12'), '%12');
  assert.equal(validateTmuxSendTarget('chq:3.1'), 'chq:3.1');
  assert.equal(normalizeSubmittedText('[image: /tmp/a.png]'), '[image: /tmp/a.png]');

  assert.throws(() => validateTmuxSendTarget('chq; rm -rf /'), /invalid tmux send target/);
  assert.throws(() => validateTmuxSendTarget(''), /invalid tmux send target/);
  assert.throws(() => normalizeSubmittedText(''), /message required/);
});
