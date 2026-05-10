const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  claudeProjectSlug,
  extractClaudeText,
  extractCodexText,
  normalizeMessageText,
  transcriptMessagesForAgent
} = require('../agent-transcript-source');

test('transcript source extracts Claude assistant text and ignores thinking and tools', () => {
  const entry = {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'private chain' },
        { type: 'tool_use', name: 'Bash', input: { command: 'echo noisy' } },
        { type: 'text', text: 'Visible assistant answer.' }
      ]
    }
  };

  assert.deepEqual(extractClaudeText(entry), ['Visible assistant answer.']);
});

test('transcript source extracts Codex assistant output text and ignores tool/reasoning records', () => {
  assert.deepEqual(extractCodexText({
    type: 'response_item',
    payload: {
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Done cleanly.' }]
    }
  }), ['Done cleanly.']);

  assert.deepEqual(extractCodexText({
    type: 'response_item',
    payload: { type: 'function_call', name: 'exec_command' }
  }), []);

  assert.deepEqual(extractCodexText({
    type: 'response_item',
    payload: { type: 'reasoning', encrypted_content: 'opaque' }
  }), []);
});

test('transcript source maps cwd to the Claude project directory convention', () => {
  assert.equal(
    claudeProjectSlug('/Users/richardadair/ai_projects/research-and-development'),
    '-Users-richardadair-ai-projects-research-and-development'
  );
});

test('transcript source normalizes text for compact pet bubbles', () => {
  assert.equal(normalizeMessageText('  first line\r\n\r\n\r\n second line  '), 'first line\n\nsecond line');
});

test('Claude transcript source binds to the agent by custom-title, not just latest mtime', () => {
  // Repro: CHQ slug has hundreds of sessions across Xavier restarts, /clear
  // cycles, and SDK / autopilot workers. Latest-mtime alone picks the wrong
  // session when an unrelated worker writes to the same slug. The fix scans
  // for a `custom-title` (or `agent-name`) entry matching the agent's
  // displayName and prefers that over the newest-mtime sibling.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentremote-claude-projects-'));
  // Slug for /tmp/xavier-fake-cwd → -tmp-xavier-fake-cwd
  const slugDir = path.join(tmp, '-tmp-xavier-fake-cwd');
  fs.mkdirSync(slugDir, { recursive: true });

  const oldXavier = path.join(slugDir, 'old-xavier.jsonl');
  const sdkWorker = path.join(slugDir, 'sdk-worker.jsonl');
  const currentXavier = path.join(slugDir, 'current-xavier.jsonl');

  fs.writeFileSync(oldXavier, [
    JSON.stringify({ type: 'custom-title', customTitle: 'XAVIER', sessionId: 'old' }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Xavier old reply.' }] } })
  ].join('\n'));
  fs.writeFileSync(sdkWorker, [
    // No custom-title / agent-name — SDK / autopilot worker session.
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'SDK worker reply.' }] } })
  ].join('\n'));
  fs.writeFileSync(currentXavier, [
    JSON.stringify({ type: 'custom-title', customTitle: 'XAVIER', sessionId: 'current' }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Xavier current reply.' }] } })
  ].join('\n'));

  // Order by mtime: oldXavier < currentXavier < sdkWorker (SDK is newest).
  fs.utimesSync(oldXavier,     new Date('2026-05-08T00:00:00Z'), new Date('2026-05-08T00:00:00Z'));
  fs.utimesSync(currentXavier, new Date('2026-05-09T10:00:00Z'), new Date('2026-05-09T10:00:00Z'));
  fs.utimesSync(sdkWorker,     new Date('2026-05-09T20:00:00Z'), new Date('2026-05-09T20:00:00Z'));

  const previous = process.env.AGENTREMOTE_CLAUDE_PROJECTS_DIR;
  process.env.AGENTREMOTE_CLAUDE_PROJECTS_DIR = tmp;
  try {
    const xavier = transcriptMessagesForAgent({ runtime: 'claude', cwd: '/tmp/xavier-fake-cwd', displayName: 'Xavier' }, { maxMessages: 4 });
    assert.equal(xavier.ok, true, 'Xavier resolution should succeed');
    assert.equal(xavier.filePath, currentXavier, 'should pick the current Xavier session, not the newer SDK-worker session');
    assert.deepEqual(xavier.messages.map((m) => m.text), ['Xavier current reply.']);

    // Without displayName: legacy fallback to latest-mtime.
    const legacy = transcriptMessagesForAgent({ runtime: 'claude', cwd: '/tmp/xavier-fake-cwd' }, { maxMessages: 4 });
    assert.equal(legacy.ok, true);
    assert.equal(legacy.filePath, sdkWorker, 'no displayName should preserve old latest-mtime behaviour');

    // displayName that matches none of the sessions: also falls back.
    const nameless = transcriptMessagesForAgent({ runtime: 'claude', cwd: '/tmp/xavier-fake-cwd', displayName: 'Mugatu' }, { maxMessages: 4 });
    assert.equal(nameless.ok, true);
    assert.equal(nameless.filePath, sdkWorker, 'unmatched displayName should also fall through to latest-mtime');
  } finally {
    if (previous === undefined) delete process.env.AGENTREMOTE_CLAUDE_PROJECTS_DIR;
    else process.env.AGENTREMOTE_CLAUDE_PROJECTS_DIR = previous;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Claude transcript source also matches custom-title when stored as agent-name', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentremote-claude-projects-'));
  const slugDir = path.join(tmp, '-tmp-lucius-fake');
  fs.mkdirSync(slugDir, { recursive: true });
  const named = path.join(slugDir, 'lucius.jsonl');
  const newer = path.join(slugDir, 'unnamed.jsonl');
  fs.writeFileSync(named, [
    JSON.stringify({ type: 'agent-name', agentName: 'LUCIUS' }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Lucius answer.' }] } })
  ].join('\n'));
  fs.writeFileSync(newer, [
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Other answer.' }] } })
  ].join('\n'));
  fs.utimesSync(named, new Date('2026-05-09T08:00:00Z'), new Date('2026-05-09T08:00:00Z'));
  fs.utimesSync(newer, new Date('2026-05-09T09:00:00Z'), new Date('2026-05-09T09:00:00Z'));

  const previous = process.env.AGENTREMOTE_CLAUDE_PROJECTS_DIR;
  process.env.AGENTREMOTE_CLAUDE_PROJECTS_DIR = tmp;
  try {
    const result = transcriptMessagesForAgent({ runtime: 'claude', cwd: '/tmp/lucius-fake', displayName: 'lucius' }, { maxMessages: 4 });
    assert.equal(result.ok, true);
    assert.equal(result.filePath, named);
    assert.deepEqual(result.messages.map((m) => m.text), ['Lucius answer.']);
  } finally {
    if (previous === undefined) delete process.env.AGENTREMOTE_CLAUDE_PROJECTS_DIR;
    else process.env.AGENTREMOTE_CLAUDE_PROJECTS_DIR = previous;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Codex transcript source refuses newest-session fallback without cwd proof', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentremote-codex-sessions-'));
  const sessions = path.join(tmp, 'sessions');
  fs.mkdirSync(path.join(sessions, '2026', '05', '08'), { recursive: true });
  const matching = path.join(sessions, '2026', '05', '08', 'matching.jsonl');
  const newestWrong = path.join(sessions, '2026', '05', '08', 'wrong.jsonl');
  fs.writeFileSync(matching, [
    JSON.stringify({ session_meta: { payload: { cwd: '/tmp/right-project' } } }),
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Correct transcript.' }]
      }
    })
  ].join('\n'));
  fs.writeFileSync(newestWrong, [
    JSON.stringify({ session_meta: { payload: { cwd: '/tmp/wrong-project' } } }),
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Wrong transcript.' }]
      }
    })
  ].join('\n'));
  fs.utimesSync(matching, new Date('2026-05-08T00:00:00Z'), new Date('2026-05-08T00:00:00Z'));
  fs.utimesSync(newestWrong, new Date('2026-05-08T01:00:00Z'), new Date('2026-05-08T01:00:00Z'));

  const previous = process.env.AGENTREMOTE_CODEX_SESSIONS_DIR;
  process.env.AGENTREMOTE_CODEX_SESSIONS_DIR = sessions;
  try {
    const found = transcriptMessagesForAgent({ runtime: 'codex', cwd: '/tmp/right-project' }, { maxMessages: 2 });
    assert.equal(found.ok, true);
    assert.equal(found.filePath, matching);
    assert.deepEqual(found.messages.map((message) => message.text), ['Correct transcript.']);

    const missing = transcriptMessagesForAgent({ runtime: 'codex', cwd: '/tmp/missing-project' }, { maxMessages: 2 });
    assert.equal(missing.ok, false);
    assert.deepEqual(missing.messages, []);
  } finally {
    if (previous === undefined) delete process.env.AGENTREMOTE_CODEX_SESSIONS_DIR;
    else process.env.AGENTREMOTE_CODEX_SESSIONS_DIR = previous;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
