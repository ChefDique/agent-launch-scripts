const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  TMUX_SUBMIT_ENTER_DELAY_MS,
  tmuxSendLiteralArgs,
  tmuxSendEnterArgs,
  tmuxSendSubmittedTextArgs
} = require('../tmux-send-path');

function hasTmux() {
  const result = childProcess.spawnSync('tmux', ['-V'], { encoding: 'utf8' });
  return result.status === 0;
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForFile(filePath, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
    sleepMs(25);
  }
  return '';
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

// A raw-mode consumer that mimics a TUI input layer (Codex/Claude): it enables
// bracketed paste and records how many distinct read()s it receives. Whether
// the payload text and the trailing Enter arrive together (one read) or apart
// (two reads) is exactly what decides "newline in composer" vs "submit".
const RAW_CONSUMER_SRC = `
const fs = require('fs');
const out = process.argv[2];
const deadline = Number(process.argv[3] || 1800);
const reads = [];
try { process.stdin.setRawMode(true); } catch (e) {}
process.stdout.write('\\x1b[?2004h');
process.stdin.on('data', (b) => { reads.push(b.toString('hex')); });
setTimeout(() => {
  try { fs.writeFileSync(out, JSON.stringify({ count: reads.length, reads })); } catch (e) {}
  process.exit(0);
}, deadline);
`;

function runConsumer(label, sender) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `agentremote-${label}-`));
  const consumerPath = path.join(tempDir, 'consumer.js');
  const outPath = path.join(tempDir, 'reads.json');
  const session = `agentremote-${label}-${process.pid}-${Date.now()}`;
  fs.writeFileSync(consumerPath, RAW_CONSUMER_SRC);
  try {
    const cmd = `${shellQuote(process.execPath)} ${shellQuote(consumerPath)} ${shellQuote(outPath)} 1800`;
    childProcess.execFileSync('tmux', ['new-session', '-d', '-s', session, '-x', '120', '-y', '30', cmd]);
    sleepMs(500); // let the consumer enter raw mode + bracketed paste
    sender(session);
    const raw = waitForFile(outPath, 3500);
    assert.ok(raw, 'consumer produced no output');
    return JSON.parse(raw);
  } finally {
    childProcess.spawnSync('tmux', ['kill-session', '-t', session], { stdio: 'ignore' });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test('two-phase submit delivers text and Enter as SEPARATE reads (TUI submits)', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }

  const result = runConsumer('split', (session) => {
    childProcess.execFileSync('tmux', tmuxSendLiteralArgs(session, 'hello codex test'));
    sleepMs(TMUX_SUBMIT_ENTER_DELAY_MS + 120);
    childProcess.execFileSync('tmux', tmuxSendEnterArgs(session));
  });

  assert.equal(result.count, 2, `expected text + Enter in two reads, got ${JSON.stringify(result)}`);
  assert.ok(!/0d$|0a$/.test(result.reads[0]), `first read must be text with no trailing CR: ${result.reads[0]}`);
  assert.ok(/^0d$|^0a$/.test(result.reads[1]), `second read must be a lone Enter: ${result.reads[1]}`);
});

test('combined single-invocation form FUSES text+Enter into one read (why TUIs need the split)', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }

  const result = runConsumer('fused', (session) => {
    childProcess.execFileSync('tmux', tmuxSendSubmittedTextArgs(session, 'hello codex test'));
  });

  assert.equal(result.count, 1, `combined form should fuse into one read, got ${JSON.stringify(result)}`);
  assert.ok(/0d$|0a$/.test(result.reads[0]), `fused read should end with CR/LF: ${result.reads[0]}`);
});

test('two-phase submit delivers key-looking payloads as literal text', (t) => {
  if (!hasTmux()) {
    t.skip('tmux is not installed');
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentremote-send-test-'));
  const outPath = path.join(tempDir, 'out.txt');
  const session = `agentremote-send-${process.pid}-${Date.now()}`;
  const payload = 'Enter';

  try {
    childProcess.execFileSync('tmux', ['new-session', '-d', '-s', session, `cat > ${shellQuote(outPath)}`]);
    childProcess.execFileSync('tmux', tmuxSendLiteralArgs(session, payload));
    sleepMs(TMUX_SUBMIT_ENTER_DELAY_MS + 80);
    childProcess.execFileSync('tmux', tmuxSendEnterArgs(session));
    sleepMs(80);
    childProcess.execFileSync('tmux', ['send-keys', '-t', session, 'C-d']);
    assert.equal(waitForFile(outPath), `${payload}\n`);
  } finally {
    childProcess.spawnSync('tmux', ['kill-session', '-t', session], { stdio: 'ignore' });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
