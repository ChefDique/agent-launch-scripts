const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeSubmittedText,
  tmuxSendSubmittedTextArgs,
  validateTmuxSendTarget
} = require('../tmux-send-path');

test('tmux submitted text path sends the chat payload and Enter in one argv call', () => {
  assert.deepEqual(
    tmuxSendSubmittedTextArgs('chq:2.0', '[image: /tmp/agentremote-pasted-images/paste-123.png]'),
    [
      'send-keys',
      '-t',
      'chq:2.0',
      '-l',
      '--',
      '[image: /tmp/agentremote-pasted-images/paste-123.png]',
      ';',
      'send-keys',
      '-t',
      'chq:2.0',
      'Enter'
    ]
  );
});

test('tmux submitted text path protects dash-prefixed chat payloads', () => {
  assert.deepEqual(
    tmuxSendSubmittedTextArgs('%42', '-please inspect this pasted image'),
    ['send-keys', '-t', '%42', '-l', '--', '-please inspect this pasted image', ';', 'send-keys', '-t', '%42', 'Enter']
  );
});

test('tmux submitted text path sends tmux key names as literal chat text', () => {
  assert.deepEqual(
    tmuxSendSubmittedTextArgs('%42', 'Enter'),
    ['send-keys', '-t', '%42', '-l', '--', 'Enter', ';', 'send-keys', '-t', '%42', 'Enter']
  );
  assert.deepEqual(
    tmuxSendSubmittedTextArgs('%42', 'C-c'),
    ['send-keys', '-t', '%42', '-l', '--', 'C-c', ';', 'send-keys', '-t', '%42', 'Enter']
  );
});

test('tmux submitted text path rejects suspicious targets and empty messages', () => {
  assert.equal(validateTmuxSendTarget('%12'), '%12');
  assert.equal(validateTmuxSendTarget('chq:3.1'), 'chq:3.1');
  assert.equal(normalizeSubmittedText('[image: /tmp/a.png]'), '[image: /tmp/a.png]');

  assert.throws(() => validateTmuxSendTarget('chq; rm -rf /'), /invalid tmux send target/);
  assert.throws(() => validateTmuxSendTarget(''), /invalid tmux send target/);
  assert.throws(() => normalizeSubmittedText(''), /message required/);
});
