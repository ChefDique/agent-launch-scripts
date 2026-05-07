const test = require('node:test');
const assert = require('node:assert/strict');

const { buildITermAttachScript, buildITermFirstWindowAttachScript, quoteAppleScriptString } = require('../iterm-attach');

test('iTerm attach script targets the newly created iTerm tab before writing attach', () => {
  const script = buildITermAttachScript('bash /Users/richardadair/ai_projects/agent-launch-scripts/chq-tmux.sh attach');

  assert.match(script, /create window with default profile/);
  assert.match(script, /create tab with default profile/);
  assert.match(script, /tell current session of first window/);
  assert.match(script, /write text "bash \/Users\/richardadair\/ai_projects\/agent-launch-scripts\/chq-tmux\.sh attach"/);
  assert.doesNotMatch(script, /with default profile command/);
  assert.doesNotMatch(script, /current session of newWindow/);
});

test('iTerm first-window attach script writes into the existing first window', () => {
  const script = buildITermFirstWindowAttachScript('bash /Users/richardadair/ai_projects/agent-launch-scripts/chq-tmux.sh attach');

  assert.match(script, /if \(count of windows\) is 0 then/);
  assert.doesNotMatch(script, /create tab with default profile/);
  assert.match(script, /tell current session of first window/);
  assert.match(script, /write text "bash \/Users\/richardadair\/ai_projects\/agent-launch-scripts\/chq-tmux\.sh attach"/);
});

test('AppleScript string quoting escapes quotes and backslashes', () => {
  assert.equal(quoteAppleScriptString('bash "/tmp/a b"\\x'), '"bash \\"/tmp/a b\\"\\\\x"');
});

test('iTerm attach script rejects empty commands', () => {
  assert.throws(() => buildITermAttachScript(''), /required/);
});
