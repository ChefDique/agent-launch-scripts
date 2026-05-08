const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AGENTREMOTE_ITERM_VIEWER_MARKER,
  buildITermAttachScript,
  buildITermHideMarkedViewerScript,
  buildITermTwoByTwoScript,
  quoteAppleScriptString
} = require('../iterm-attach');

test('iTerm attach script creates or reuses only the marked AgentRemote viewer window', () => {
  const script = buildITermAttachScript('python3 /Users/richardadair/ai_projects/swarmy/scripts/agentremote_runtime.py attach');

  assert.equal(AGENTREMOTE_ITERM_VIEWER_MARKER, 'AgentRemote CHQ Viewer');
  assert.match(script, /set markerName to "AgentRemote CHQ Viewer"/);
  assert.match(script, /repeat with candidateWindow in windows/);
  assert.match(script, /if \(name of candidateSession as text\) contains markerName then/);
  assert.match(script, /create window with default profile/);
  assert.match(script, /set targetWindow to current window/);
  assert.match(script, /tell current session of targetWindow/);
  assert.match(script, /set name to markerName/);
  assert.match(script, /write text "python3 \/Users\/richardadair\/ai_projects\/swarmy\/scripts\/agentremote_runtime\.py attach"/);
  assert.doesNotMatch(script, /tell application "Terminal"/);
  assert.doesNotMatch(script, /Terminal\.app/);
  assert.doesNotMatch(script, /create tab with default profile/);
  assert.doesNotMatch(script, /delete window|close window|kill\s+iterm|killall|destroy window/i);
  assert.doesNotMatch(script, /with default profile command/);
  assert.doesNotMatch(script, /current session of newWindow/);
  assert.doesNotMatch(script, /tell first window\\n    create tab/);
});

test('iTerm attach script rejects plain tmux attach viewers', () => {
  assert.throws(() => buildITermAttachScript('tmux attach -t chq'), /plain tmux attach/);
  assert.doesNotThrow(() => buildITermAttachScript('tmux -CC attach -t chq'));
});

test('marked iTerm helper can be hidden without touching unrelated windows', () => {
  const script = buildITermHideMarkedViewerScript();

  assert.match(script, /set markerName to "AgentRemote CHQ Viewer"/);
  assert.match(script, /set miniaturized of candidateWindow to true/);
  assert.doesNotMatch(script, /close window|delete window|killall|tell application "Terminal"/i);
});

test('native 2x2 iTerm script builds one marked target window object-by-object', () => {
  const script = buildITermTwoByTwoScript([
    'tmux -CC attach -t chq',
    'tmux -CC attach -t chq',
    'tmux -CC attach -t chq',
    'tmux -CC attach -t chq'
  ]);

  assert.match(script, /set targetWindow to missing value/);
  assert.match(script, /repeat with candidateWindow in windows/);
  assert.match(script, /if targetWindow is missing value then\n    create window with default profile/);
  assert.match(script, /set rightPane to \(split vertically with default profile\)/);
  assert.match(script, /set bottomLeft to \(split horizontally with default profile\)/);
  assert.match(script, /set bottomRight to \(split horizontally with default profile\)/);
  assert.doesNotMatch(script, /tell application "Terminal"/);
  assert.doesNotMatch(script, /create tab with default profile/);
  assert.doesNotMatch(script, /\btmux attach -t chq\b/);
});

test('native 2x2 iTerm script rejects plain tmux attach clutter', () => {
  assert.throws(() => buildITermTwoByTwoScript(['tmux attach -t chq']), /plain tmux attach/);
});

test('AppleScript string quoting escapes quotes and backslashes', () => {
  assert.equal(quoteAppleScriptString('bash "/tmp/a b"\\x'), '"bash \\"/tmp/a b\\"\\\\x"');
});

test('iTerm attach script rejects empty commands', () => {
  assert.throws(() => buildITermAttachScript(''), /required/);
});
