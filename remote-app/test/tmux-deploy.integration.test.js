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

// B1 — the pane-died auto-restart hook must actually install. The buggy form
// `run-shell <restartShell>` (unquoted) is re-tokenized by tmux set-hook and
// rejected ("too many arguments") because restartShell contains spaces, so no
// hook is stored. This runs the REAL loop-wrapper path (real scriptPath) and
// asserts tmux actually holds a pane-died hook afterwards.
test('B1: native deploy installs a real pane-died respawn hook on each pane', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }
  const session = throwawaySession('hook');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentremote-hook-'));
  t.after(() => { killSession(session); try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

  // Minimal registry + launch-agent stub so the generated loop wrapper is valid.
  const registryPath = path.join(tmpDir, 'agents.json');
  fs.writeFileSync(registryPath, JSON.stringify({ agents: [{ id: 'fake0', display_name: 'Fake 0', auto_restart: true }] }));
  const launchAgentPath = path.join(tmpDir, 'launch-agent.sh');
  fs.writeFileSync(launchAgentPath, '#!/usr/bin/env bash\nexec sleep 30\n');
  fs.chmodSync(launchAgentPath, 0o755);

  // NOTE: no commandForAgent — exercise the real loop-wrapper + hook install path.
  const result = deploySingleWindow({
    session,
    agents: [{ id: 'fake0', displayName: 'Fake 0', cwd: os.tmpdir(), overrides: {} }],
    registryPath,
    launchAgentPath,
    sidecarPath: path.join(tmpDir, 'sidecar.json'),
    scriptDir: tmpDir
  });

  assert.equal(result.ok, true, `deploy failed: ${result.error || ''}`);
  const paneId = result.panes[0].paneId;
  // show-hooks for the pane must contain a pane-died run-shell hook.
  const hooks = tmux(['show-hooks', '-p', '-t', paneId]);
  assert.match(hooks, /pane-died/, `pane-died hook missing — show-hooks:\n${hooks}`);
  assert.match(hooks, /--agentremote-should-restart/, `restart shell missing from hook — show-hooks:\n${hooks}`);
});

// H2 — an agent whose command exits instantly must not yield ok:true with a
// ghost pane + corrupt sidecar. With remain-on-exit the pane lingers dead;
// display-message then returns empty session_name, and the buggy fallback
// (`vals.session != null ? vals.session : session`) keeps '' since '' != null.
test('H2: instant-exit agent does not produce ok:true with a corrupt sidecar entry', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }
  const session = throwawaySession('instantexit');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentremote-ie-'));
  const sidecarPath = path.join(tmpDir, 'sidecar.json');
  t.after(() => { killSession(session); try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

  // `true` exits 0 immediately; with remain-on-exit the pane stays as a dead pane.
  const result = deploySingleWindow({
    session,
    agents: [{ id: 'flash', displayName: 'Flash', cwd: os.tmpdir(), command: 'true' }],
    registryPath: path.join(tmpDir, 'agents.json'),
    launchAgentPath: path.join(tmpDir, 'launch-agent.sh'),
    sidecarPath,
    scriptDir: tmpDir,
    commandForAgent: (agent) => agent.command
  });

  // Must NOT claim success for an agent that never came up.
  assert.equal(result.ok, false, `expected failure for instant-exit agent, got: ${JSON.stringify(result)}`);

  // And must not have written a corrupt sidecar entry (empty session / no window).
  if (fs.existsSync(sidecarPath)) {
    const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
    const entry = sidecar.flash;
    if (entry) {
      assert.notEqual(entry.session, '', `sidecar entry has empty session: ${JSON.stringify(entry)}`);
      assert.equal(typeof entry.window, 'number', `sidecar entry window not a number: ${JSON.stringify(entry)}`);
    }
  }
});

// H1 — re-deploy de-dup must see panes in OTHER windows of the session. The
// Attach button breaks a pane into its own window; with `list-panes -t` (current
// window only) a subsequent re-deploy can't see it and spawns a duplicate.
test('H1: re-deploy does not duplicate an agent whose pane was broken into its own window', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }
  const session = throwawaySession('breakwin');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentremote-bw-'));
  t.after(() => { killSession(session); try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

  const base = {
    session,
    registryPath: path.join(tmpDir, 'agents.json'),
    launchAgentPath: path.join(tmpDir, 'launch-agent.sh'),
    sidecarPath: path.join(tmpDir, 'sidecar.json'),
    scriptDir: tmpDir,
    commandForAgent: (agent) => agent.command
  };
  const first = deploySingleWindow({ ...base, agents: makeAgents(2) }); // fake0, fake1 in window 0
  assert.equal(first.ok, true, first.error || '');

  // Simulate Attach: break fake1's pane into its own window (like main.js does).
  const fake1Pane = first.panes.find(p => p.id === 'fake1').paneId;
  tmux(['break-pane', '-d', '-s', fake1Pane, '-t', `${session}:`]);
  // fake1 is now in a different window than the original.

  // Re-deploy fake1 — it is still live (in another window), so NO new pane.
  const second = deploySingleWindow({ ...base, agents: [{ id: 'fake1', displayName: 'Fake 1', cwd: os.tmpdir(), command: 'sleep 30' }] });
  assert.equal(second.ok, true, second.error || '');

  const ids = tmux(['list-panes', '-s', '-t', session, '-F', '#{@agent-identity}'])
    .split('\n').filter(Boolean).map(s => s.trim()).filter(Boolean);
  const fake1Count = ids.filter(id => id === 'fake1').length;
  assert.equal(fake1Count, 1, `fake1 must not be duplicated across windows; identities=${ids.join(',')}`);
});

// H4 — swarmy tags panes `<id>-<runtime>` (e.g. kenpachi-claude); a native
// re-deploy comparing the RAW id would miss it and spawn a duplicate. De-dup
// must canonicalize (strip the trailing -runtime) on both sides.
test('H4: re-deploy skips an agent already live under a runtime-suffixed identity', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }
  const session = throwawaySession('runtimesuffix');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentremote-rs-'));
  t.after(() => { killSession(session); try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

  const base = {
    session,
    registryPath: path.join(tmpDir, 'agents.json'),
    launchAgentPath: path.join(tmpDir, 'launch-agent.sh'),
    sidecarPath: path.join(tmpDir, 'sidecar.json'),
    scriptDir: tmpDir,
    commandForAgent: (agent) => agent.command
  };
  // First deploy creates the session/window via the real path; then re-tag the
  // pane to a swarmy-style `kenpachi-claude` identity (suffixed runtime).
  const first = deploySingleWindow({ ...base, agents: [{ id: 'kenpachi', displayName: 'Kenpachi', cwd: os.tmpdir(), command: 'sleep 30' }] });
  assert.equal(first.ok, true, first.error || '');
  tmux(['set-option', '-p', '-t', first.panes[0].paneId, '@agent-identity', 'kenpachi-claude']);

  // Native re-deploy of `kenpachi` (raw id) — already live under kenpachi-claude.
  const result = deploySingleWindow({ ...base, agents: [{ id: 'kenpachi', displayName: 'Kenpachi', cwd: os.tmpdir(), command: 'sleep 30' }] });

  assert.equal(result.ok, true, result.error || '');
  assert.deepEqual(result.skipped, ['kenpachi'], `kenpachi should be skipped (already live); result=${JSON.stringify(result)}`);
  const ids = tmux(['list-panes', '-s', '-t', session, '-F', '#{@agent-identity}'])
    .split('\n').filter(Boolean).map(s => s.trim()).filter(Boolean);
  assert.equal(ids.length, 1, `no duplicate pane; identities=${ids.join(',')}`);
});
