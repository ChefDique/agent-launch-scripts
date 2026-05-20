const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { tmuxSendSubmittedTextArgs } = require('../tmux-send-path');

function hasTmux() {
  const result = childProcess.spawnSync('tmux', ['-V'], { encoding: 'utf8' });
  return result.status === 0;
}

function waitForFile(filePath, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
  }
  return '';
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

test('tmux submitted text path delivers key-looking payloads as literal text', (t) => {
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
    childProcess.execFileSync('tmux', tmuxSendSubmittedTextArgs(session, payload));
    childProcess.execFileSync('tmux', ['send-keys', '-t', session, 'C-d']);
    assert.equal(waitForFile(outPath), `${payload}\n`);
  } finally {
    childProcess.spawnSync('tmux', ['kill-session', '-t', session], { stdio: 'ignore' });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
