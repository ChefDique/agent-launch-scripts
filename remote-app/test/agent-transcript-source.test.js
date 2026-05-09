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
