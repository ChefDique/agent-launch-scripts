const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  classifyPaneLine,
  cleanPaneLines,
  createPaneStreamFilterState,
  filterPaneChunk,
  sanitizeTerminalText
} = require('../pane-stream-filter');

test('pane stream filter strips terminal controls without hardcoded agent or model names', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pane-stream-filter.js'), 'utf8');

  assert.doesNotMatch(source, /\b(?:Claude|Codex|Opus|Sonnet|GPT|Xavier|Lucius|Gekko|tmux-masta)\b/);
  assert.equal(sanitizeTerminalText('\x1b[>1uvisible\x1b[0m'), 'visible');
});

test('pane stream filter suppresses active TUI chrome and control fragments dynamically', () => {
  const state = createPaneStreamFilterState();
  const suppressed = [
    '[<u [>1u [>4;2m',
    '────────────────────────────────────────',
    '❯ Implement {feature}',
    'tab to queue message                                                        64% context left',
    '[Opus 4.7 (1M context)] 📁 research-and-development | 🌿 main',
    '████░░░░░░ 41% $21.46 | 183m 35s',
    '⏵⏵ bypass permissions on (shift+tab to cycle)',
    'Called plugin:telegram:telegram',
    '└ Search message-agent|channels/team|session_id in docs',
    '2 tasks (1 done, 1 open)',
    '✔ Convene 3-member council on pod foundation rules + migration',
    '◻ Revise /lead-gogo Step 7 per review',
    '+123 lines (ctrl + t to view transcript)',
    '✻ Cogitated for 37s',
    '※ recap: Mid-session goal is to land a uniform standard.',
    '[Pasted text #2 +56 lines]',
    'paste again to expand',
    'Agent "Implementer OPS-215 spec" completed',
    'Please use --channels to run a list of approved channels.',
    'this option to run channels you have downloaded off the internet.',
    'WARNING: Loading development channels',
    'Channels: server:claude-peers',
    'Resume this session with:r local development',
    'claude --resume "XAVIER"',
    '[launch-agent] pre_launch hook returned non-zero (continuing)',
    'Ran 1 shell command',
    'Running 1 shell command…',
    "⎿ $ echo '---pr_url state across this session ships---'",
    '?? remote-app/test/runtime-dynamic-contract.test.js',
    'launch-agent runtime tests passed',
    'gpt-5.5 high · ~/repo · main · Context 21% … Pursuing goal',
    '18 +- Direct-dispatch worktree pattern proven.',
    '+ reviewer independently verified and merged.',
    '+210 #562 merged in prior wave.',
    '--fix tasks dispatched in parallel.',
    'for tid in OPS-207 OPS-214; do',
    'bash scripts/task-api.sh --get $tid --project corporatehq 2>/dev/null | python3 -c "',
    '99 if (/\\b\\d+\\s*(?:ms|s|m|h)\\b/.test(text)) return true;',
    "43 'launch-agent runtime tests passed',",
    "const { execFileSync } = require('child_process');"
  ];

  for (const line of suppressed) {
    const result = classifyPaneLine(line, state);
    assert.equal(result.keep, false, `${line} should be suppressed as ${result.reason}`);
  }
});

test('pane stream filter preserves readable assistant prose across agents', () => {
  const kept = cleanPaneLines([
    '⏺ Corrected prompt sent.',
    'The standing standard is active/source-of-truth and says the pod foundation tree is mandatory.',
    'So the prompt is good, but the word ratified may overstate the status unless approval has happened elsewhere.',
    'No other changes needed.'
  ]);

  assert.deepEqual(kept, [
    'Corrected prompt sent.',
    'The standing standard is active/source-of-truth and says the pod foundation tree is mandatory.',
    'So the prompt is good, but the word ratified may overstate the status unless approval has happened elsewhere.',
    'No other changes needed.'
  ]);
});

test('pane stream filter keeps state across chunk boundaries', () => {
  const state = createPaneStreamFilterState();
  const first = filterPaneChunk('Called plugin:telegram:telegram\nCorrected ', state, '');
  const second = filterPaneChunk('prompt sent.\n[<u [>1u\n', state, first.carry);

  assert.deepEqual(first.lines, []);
  assert.equal(first.carry, 'Corrected ');
  assert.deepEqual(second.lines, ['Corrected prompt sent.']);
});

test('pane stream filter honors registry-supplied profile data', () => {
  const line = 'Corrected prompt sent.';

  assert.deepEqual(cleanPaneLines([line], { profile: { minProseWords: 3 } }), [line]);
  assert.deepEqual(cleanPaneLines([line], { profile: { minProseWords: 6 } }), []);
});
