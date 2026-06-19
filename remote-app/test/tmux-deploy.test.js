const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAgentLoopScript,
  newSessionArgs,
  splitWindowArgs,
  selectLayoutTiledArgs,
  setPaneIdentityArgs,
  setPaneTitleArgs,
  remainOnExitArgs,
  paneDiedHookArgs,
  setSessionLayoutArgs,
  setOwnershipArgs,
  deploySingleWindow,
  sidecarEntryFromDisplay,
  OWNERSHIP_OPTION,
  LEGACY_OWNERSHIP_OPTION,
  OWNERSHIP_VALUE,
  SINGLE_WINDOW_LAYOUT
} = require('../tmux-deploy');

// ---------------------------------------------------------------------------
// Pure argv builders — no shell strings, every dynamic value is a separate argv
// element. These lock the "argv-style execFile only" hard constraint.
// ---------------------------------------------------------------------------

test('newSessionArgs builds a detached single-window session with sizing and pane-id capture', () => {
  const args = newSessionArgs({
    session: 'test_deploy_1',
    windowName: 'agents',
    cwd: '/Users/x/proj',
    command: 'bash /tmp/loop.sh',
    width: 220,
    height: 50
  });
  assert.deepEqual(args, [
    'new-session', '-d',
    '-s', 'test_deploy_1',
    '-n', 'agents',
    '-c', '/Users/x/proj',
    '-x', '220',
    '-y', '50',
    '-P', '-F', '#{pane_id}',
    'bash /tmp/loop.sh'
  ]);
});

test('splitWindowArgs splits the existing single window (not a new window) and captures pane id', () => {
  const args = splitWindowArgs({
    windowTarget: 'test_deploy_1:agents',
    cwd: '/Users/x/proj2',
    command: 'bash /tmp/loop2.sh'
  });
  // -h splits within the SAME window → keeps everything in one window (BUG B lock)
  assert.deepEqual(args, [
    'split-window', '-h',
    '-t', 'test_deploy_1:agents',
    '-c', '/Users/x/proj2',
    '-P', '-F', '#{pane_id}',
    'bash /tmp/loop2.sh'
  ]);
});

test('selectLayoutTiledArgs re-tiles the one window so N panes stay balanced', () => {
  assert.deepEqual(
    selectLayoutTiledArgs('test_deploy_1:agents'),
    ['select-layout', '-t', 'test_deploy_1:agents', 'tiled']
  );
});

test('setPaneIdentityArgs sets @agent-identity per-pane (primary resolver path)', () => {
  assert.deepEqual(
    setPaneIdentityArgs('%5', 'xavier'),
    ['set-option', '-p', '-t', '%5', '@agent-identity', 'xavier']
  );
});

test('setPaneTitleArgs sets the pane title for title-fallback resolution', () => {
  assert.deepEqual(
    setPaneTitleArgs('%5', 'Xavier'),
    ['select-pane', '-t', '%5', '-T', 'Xavier']
  );
});

test('remainOnExitArgs keeps the dead pane so the restart hook can fire', () => {
  assert.deepEqual(
    remainOnExitArgs('%5'),
    ['set-option', '-p', '-t', '%5', 'remain-on-exit', 'on']
  );
});

test('paneDiedHookArgs wires the auto-restart respawn hook on the pane', () => {
  const restartShell = 'bash /tmp/loop.sh --agentremote-should-restart && tmux respawn-pane -k -t %5';
  assert.deepEqual(
    paneDiedHookArgs('%5', restartShell),
    ['set-hook', '-p', '-t', '%5', 'pane-died', `run-shell ${restartShell}`]
  );
});

test('setSessionLayoutArgs stamps @chq_layout=single', () => {
  assert.deepEqual(
    setSessionLayoutArgs('test_deploy_1', 'single'),
    ['set-option', '-t', 'test_deploy_1', '-q', '@chq_layout', 'single']
  );
  assert.equal(SINGLE_WINDOW_LAYOUT, 'single');
});

test('setOwnershipArgs stamps the AgentRemote ownership sentinel', () => {
  assert.deepEqual(
    setOwnershipArgs('test_deploy_1'),
    ['set-option', '-t', 'test_deploy_1', '-q', OWNERSHIP_OPTION, OWNERSHIP_VALUE]
  );
  assert.equal(OWNERSHIP_OPTION, '@agentremote_runtime');
  // Legacy swarmy option is still honored on read so existing sessions keep working.
  assert.equal(LEGACY_OWNERSHIP_OPTION, '@swarmy_runtime');
  assert.equal(OWNERSHIP_VALUE, 'agentremote');
});

test('deploySingleWindow stamps BOTH ownership tags so swarmy-delegated Stop/Attach still own a freshly native-created session', () => {
  const calls = [];
  let paneSeq = 0;
  const runTmux = (args) => {
    calls.push(args);
    if (args[0] === 'has-session') return { status: 1, stdout: '', stderr: '' }; // fresh session
    if (args[0] === 'new-session' || args[0] === 'split-window') return { status: 0, stdout: `%${++paneSeq}`, stderr: '' };
    if (args[0] === 'display-message') return { status: 0, stdout: '0', stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  };
  const res = deploySingleWindow({
    session: 'test_deploy_own',
    agents: [{ id: 'xavier', cwd: '/tmp' }, { id: 'gekko', cwd: '/tmp' }],
    sidecarPath: null,
    commandForAgent: () => 'true',
    runTmux,
    readSidecar: () => ({}),
    writeSidecar: () => {}
  });
  assert.equal(res.ok, true);
  const setOpts = calls.filter(a => a[0] === 'set-option');
  const hasNative = setOpts.some(a => a.includes('@agentremote_runtime') && a.includes(OWNERSHIP_VALUE));
  const hasLegacy = setOpts.some(a => a.includes(LEGACY_OWNERSHIP_OPTION) && a.includes(OWNERSHIP_VALUE));
  assert.ok(hasNative, 'native ownership tag @agentremote_runtime must be set');
  assert.ok(hasLegacy, 'legacy @swarmy_runtime must be set so swarmy Stop/Attach accept the native session');
});

// ---------------------------------------------------------------------------
// Loop wrapper — faithful parity with swarmy write_agent_loop_script: it must
// honor auto_restart from the registry, exec launch-agent.sh with AGENT_REGISTRY,
// and forward SWARMY_*_OVERRIDE env (launch-agent.sh's contract var names).
// ---------------------------------------------------------------------------

test('buildAgentLoopScript execs launch-agent.sh with the agent id and AGENT_REGISTRY', () => {
  const script = buildAgentLoopScript({
    agentId: 'xavier',
    registryPath: '/repo/agents.json',
    launchAgentPath: '/repo/launch-agent.sh',
    cwd: '/Users/x/CorporateHQ',
    overrides: {}
  });
  assert.match(script, /^#!\/usr\/bin\/env bash/);
  assert.match(script, /AGENT_ID='xavier'/);
  assert.match(script, /REGISTRY='\/repo\/agents\.json'/);
  assert.match(script, /LAUNCH_AGENT='\/repo\/launch-agent\.sh'/);
  assert.match(script, /exec env AGENT_REGISTRY="\$\{REGISTRY\}" bash "\$\{LAUNCH_AGENT\}" "\$\{AGENT_ID\}"/);
  // auto_restart gate must read the registry, defaulting to true (swarmy parity).
  assert.match(script, /--agentremote-should-restart/);
  assert.match(script, /auto_restart/);
});

test('buildAgentLoopScript forwards runtime overrides as SWARMY_*_OVERRIDE exports (launch-agent.sh contract)', () => {
  const script = buildAgentLoopScript({
    agentId: 'gekko',
    registryPath: '/repo/agents.json',
    launchAgentPath: '/repo/launch-agent.sh',
    cwd: '/Users/x/trading',
    overrides: { runtime: 'claude', model: 'opus', reasoning_effort: 'high' }
  });
  assert.match(script, /export SWARMY_RUNTIME_OVERRIDE='claude'/);
  assert.match(script, /export SWARMY_MODEL_OVERRIDE='opus'/);
  assert.match(script, /export SWARMY_REASONING_EFFORT_OVERRIDE='high'/);
});

test('buildAgentLoopScript omits override exports that are not set', () => {
  const script = buildAgentLoopScript({
    agentId: 'lucius',
    registryPath: '/repo/agents.json',
    launchAgentPath: '/repo/launch-agent.sh',
    cwd: '/Users/x/rnd',
    overrides: {}
  });
  assert.ok(!/SWARMY_RUNTIME_OVERRIDE/.test(script));
  assert.ok(!/SWARMY_MODEL_OVERRIDE/.test(script));
});

test('buildAgentLoopScript escapes single quotes in paths/values (no shell injection)', () => {
  const script = buildAgentLoopScript({
    agentId: 'a',
    registryPath: "/repo/it's/agents.json",
    launchAgentPath: '/repo/launch-agent.sh',
    cwd: '/tmp',
    overrides: {}
  });
  // single quote closed, escaped, reopened — the shlex.quote idiom
  assert.match(script, /REGISTRY='\/repo\/it'\\''s\/agents\.json'/);
});

// ---------------------------------------------------------------------------
// Sidecar shape — must match swarmy update_sidecar so pane-resolver keeps working:
// pane_id (str), session (str), window (int), pane (int) are load-bearing.
// ---------------------------------------------------------------------------

test('sidecarEntryFromDisplay produces the swarmy-shape entry (window/pane coerced to int)', () => {
  const entry = sidecarEntryFromDisplay({
    paneId: '%7',
    session: 'test_deploy_1',
    window: '0',
    pane: '2',
    team: 'default',
    runtimeMetadata: { runtime: 'codex' }
  });
  assert.equal(entry.pane_id, '%7');
  assert.equal(entry.session, 'test_deploy_1');
  assert.strictEqual(entry.window, 0);
  assert.strictEqual(entry.pane, 2);
  assert.equal(entry.team, 'default');
  assert.deepEqual(entry.runtime_metadata, { runtime: 'codex' });
  assert.equal(entry.runtime_source, 'agentremote');
  assert.equal(entry.runtime_dispatch, 'tmux-deploy');
  assert.match(entry.updated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});
