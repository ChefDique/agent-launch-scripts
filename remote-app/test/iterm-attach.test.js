const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AGENTREMOTE_ITERM_VIEWER_MARKER,
  buildITermAttachScript,
  quoteAppleScriptString
} = require('../iterm-attach');

test('iTerm attach script creates or reuses only the marked AgentRemote viewer window', () => {
  const script = buildITermAttachScript('python3 /Users/richardadair/ai_projects/swarmy/scripts/agentremote_runtime.py attach');

  assert.equal(AGENTREMOTE_ITERM_VIEWER_MARKER, 'AgentRemote CHQ Viewer');
  assert.match(script, /set markerName to "AgentRemote CHQ Viewer"/);
  assert.match(script, /repeat with candidateWindow in windows/);
  assert.match(script, /if \(name of candidateSession as text\) contains markerName then/);
  assert.match(script, /create window with default profile/);
  assert.match(script, /create tab with default profile/);
  assert.match(script, /set targetWindow to current window/);
  assert.match(script, /tell current session of targetWindow/);
  assert.match(script, /set name to markerName/);
  assert.match(script, /write text "python3 \/Users\/richardadair\/ai_projects\/swarmy\/scripts\/agentremote_runtime\.py attach"/);
  assert.doesNotMatch(script, /delete window|close window|kill\s+iterm|killall|destroy window/i);
  assert.doesNotMatch(script, /with default profile command/);
  assert.doesNotMatch(script, /current session of newWindow/);
  assert.doesNotMatch(script, /tell first window\\n    create tab/);
});

test('AppleScript string quoting escapes quotes and backslashes', () => {
  assert.equal(quoteAppleScriptString('bash "/tmp/a b"\\x'), '"bash \\"/tmp/a b\\"\\\\x"');
});

test('iTerm attach script rejects empty commands', () => {
  assert.throws(() => buildITermAttachScript(''), /required/);
});
