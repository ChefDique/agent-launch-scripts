const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { deploySingleWindow, SINGLE_WINDOW_LAYOUT, OWNERSHIP_OPTION, OWNERSHIP_VALUE } = require('../tmux-deploy');

function hasTmux() {
  return childProcess.spawnSync('tmux', ['-V'], { encoding: 'utf8' }).status === 0;
}

function tmux(args) {
  return childProcess.execFileSync('tmux', args, { encoding: 'utf8' });
}

function killSession(session) {
  childProcess.spawnSync('tmux', ['kill-session', '-t', session], { stdio: 'ignore' });
}

// A throwaway session name that can never collide with the live `chq`.
function throwawaySession(label) {
  return `test_deploy_${label}_${process.pid}_${Date.now()}`;
}

// Build a deploy harness pointed at a throwaway session. The per-agent command
// is a long sleep so panes stay alive long enough to inspect; we are testing
// TOPOLOGY (one window, N panes, @agent-identity per pane), not real launches.
function makeAgents(n) {
  const agents = [];
  for (let i = 0; i < n; i += 1) {
    agents.push({
      id: `fake${i}`,
      displayName: `Fake ${i}`,
      cwd: os.tmpdir(),
      command: 'sleep 30'
    });
  }
  return agents;
}

test('native deploy of N agents creates exactly ONE window with N panes, each tagged @agent-identity', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }
  const session = throwawaySession('topology');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentremote-deploy-'));
  t.after(() => { killSession(session); try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

  const result = deploySingleWindow({
    session,
    agents: makeAgents(3),
    registryPath: path.join(tmpDir, 'agents.json'),
    launchAgentPath: path.join(tmpDir, 'launch-agent.sh'),
    sidecarPath: path.join(tmpDir, 'sidecar.json'),
    scriptDir: tmpDir,
    // Inject a command override so the loop wrapper isn't actually used — we
    // just want live panes to inspect topology against.
    commandForAgent: (agent) => agent.command
  });

  assert.equal(result.ok, true, `deploy failed: ${result.error || ''}`);
  assert.equal(result.session, session);

  // Exactly ONE window (BUG B regression lock).
  const windows = tmux(['list-windows', '-t', session, '-F', '#{window_id}']).split('\n').filter(Boolean);
  assert.equal(windows.length, 1, `expected exactly 1 window, got ${windows.length}`);

  // Exactly N panes in that one window.
  const panes = tmux(['list-panes', '-t', session, '-F', '#{pane_id} #{@agent-identity}'])
    .split('\n').filter(Boolean);
  assert.equal(panes.length, 3, `expected 3 panes in the single window, got ${panes.length}`);

  // Every pane carries an @agent-identity (primary resolver path).
  const identities = panes.map(line => line.split(' ').slice(1).join(' ').trim());
  assert.deepEqual([...identities].sort(), ['fake0', 'fake1', 'fake2']);

  // Session is stamped single-window layout + owned by AgentRemote.
  assert.equal(tmux(['show-option', '-t', session, '-v', '-q', '@chq_layout']).trim(), SINGLE_WINDOW_LAYOUT);
  assert.equal(tmux(['show-option', '-t', session, '-v', '-q', OWNERSHIP_OPTION]).trim(), OWNERSHIP_VALUE);
});

test('native deploy of a SINGLE agent still creates one window with one tagged pane', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }
  const session = throwawaySession('single');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentremote-deploy-'));
  t.after(() => { killSession(session); try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

  const result = deploySingleWindow({
    session,
    agents: makeAgents(1),
    registryPath: path.join(tmpDir, 'agents.json'),
    launchAgentPath: path.join(tmpDir, 'launch-agent.sh'),
    sidecarPath: path.join(tmpDir, 'sidecar.json'),
    scriptDir: tmpDir,
    commandForAgent: (agent) => agent.command
  });

  assert.equal(result.ok, true, `deploy failed: ${result.error || ''}`);
  const windows = tmux(['list-windows', '-t', session, '-F', '#{window_id}']).split('\n').filter(Boolean);
  assert.equal(windows.length, 1);
  const panes = tmux(['list-panes', '-t', session, '-F', '#{pane_id} #{@agent-identity}']).split('\n').filter(Boolean);
  assert.equal(panes.length, 1);
  assert.equal(panes[0].split(' ').slice(1).join(' ').trim(), 'fake0');
});

test('native deploy writes the swarmy-shape sidecar (pane_id/session/window/pane) for each agent', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }
  const session = throwawaySession('sidecar');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentremote-deploy-'));
  const sidecarPath = path.join(tmpDir, 'sidecar.json');
  t.after(() => { killSession(session); try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

  deploySingleWindow({
    session,
    agents: makeAgents(2),
    registryPath: path.join(tmpDir, 'agents.json'),
    launchAgentPath: path.join(tmpDir, 'launch-agent.sh'),
    sidecarPath,
    scriptDir: tmpDir,
    commandForAgent: (agent) => agent.command
  });

  const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
  for (const id of ['fake0', 'fake1']) {
    assert.ok(sidecar[id], `sidecar missing ${id}`);
    assert.match(String(sidecar[id].pane_id), /^%\d+$/);
    assert.equal(sidecar[id].session, session);
    assert.strictEqual(typeof sidecar[id].window, 'number');
    assert.strictEqual(typeof sidecar[id].pane, 'number');
  }
});

test('native deploy APPENDS to an existing owned session without spawning a second window', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }
  const session = throwawaySession('append');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentremote-deploy-'));
  t.after(() => { killSession(session); try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

  const base = {
    session,
    registryPath: path.join(tmpDir, 'agents.json'),
    launchAgentPath: path.join(tmpDir, 'launch-agent.sh'),
    sidecarPath: path.join(tmpDir, 'sidecar.json'),
    scriptDir: tmpDir,
    commandForAgent: (agent) => agent.command
  };
  deploySingleWindow({ ...base, agents: makeAgents(1) });
  deploySingleWindow({ ...base, agents: [{ id: 'extra', displayName: 'Extra', cwd: os.tmpdir(), command: 'sleep 30' }] });

  const windows = tmux(['list-windows', '-t', session, '-F', '#{window_id}']).split('\n').filter(Boolean);
  assert.equal(windows.length, 1, `appending must stay in one window, got ${windows.length}`);
  const panes = tmux(['list-panes', '-t', session, '-F', '#{@agent-identity}']).split('\n').filter(Boolean).map(s => s.trim());
  assert.deepEqual([...panes].sort(), ['extra', 'fake0']);
});

test('re-deploying an already-running agent does NOT create a duplicate pane (swarmy parity)', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }
  const session = throwawaySession('nodup');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentremote-deploy-'));
  t.after(() => { killSession(session); try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

  const base = {
    session,
    registryPath: path.join(tmpDir, 'agents.json'),
    launchAgentPath: path.join(tmpDir, 'launch-agent.sh'),
    sidecarPath: path.join(tmpDir, 'sidecar.json'),
    scriptDir: tmpDir,
    commandForAgent: (agent) => agent.command
  };
  deploySingleWindow({ ...base, agents: makeAgents(2) }); // fake0, fake1
  // Re-deploy the SAME two agents — they are already live, so no new panes.
  const second = deploySingleWindow({ ...base, agents: makeAgents(2) });

  assert.equal(second.ok, true, second.error || '');
  const panes = tmux(['list-panes', '-t', session, '-F', '#{@agent-identity}']).split('\n').filter(Boolean).map(s => s.trim());
  assert.deepEqual([...panes].sort(), ['fake0', 'fake1'], `re-deploy must not duplicate panes; got ${panes.join(',')}`);
});
