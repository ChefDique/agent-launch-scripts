const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const os = require('node:os');

const {
  shouldReleaseWindowViewer,
  windowPaneDeadFlagsArgs,
  countLivePanes,
  killPaneArgs,
  killPaneReleasingEmptyWindow
} = require('../pane-control');

function hasTmux() {
  return childProcess.spawnSync('tmux', ['-V'], { encoding: 'utf8' }).status === 0;
}
function tmux(args) {
  return childProcess.execFileSync('tmux', args, { encoding: 'utf8' });
}
function killSession(session) {
  childProcess.spawnSync('tmux', ['kill-session', '-t', session], { stdio: 'ignore' });
}
function throwawaySession(label) {
  return `test_kill_${label}_${process.pid}_${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Pure decision + argv builders
// ---------------------------------------------------------------------------
test('shouldReleaseWindowViewer is true ONLY when exactly one LIVE pane remained', () => {
  assert.equal(shouldReleaseWindowViewer(1), true);   // last live pane → release viewer
  assert.equal(shouldReleaseWindowViewer(2), false);  // live siblings remain → keep viewer
  assert.equal(shouldReleaseWindowViewer(5), false);
});

test('shouldReleaseWindowViewer is false on an unknown/NaN count (fail safe — do not nuke a viewer)', () => {
  assert.equal(shouldReleaseWindowViewer(NaN), false);
  assert.equal(shouldReleaseWindowViewer(undefined), false);
  assert.equal(shouldReleaseWindowViewer(0), false);
});

test('windowPaneDeadFlagsArgs lists per-pane dead flags for the target pane window', () => {
  assert.deepEqual(
    windowPaneDeadFlagsArgs('%5'),
    ['list-panes', '-t', '%5', '-F', '#{pane_dead}']
  );
});

test('countLivePanes counts only non-dead panes (dead remain-on-exit panes excluded)', () => {
  assert.equal(countLivePanes('0\n0\n1\n'), 2);   // two live, one dead
  assert.equal(countLivePanes('1\n1\n'), 0);      // all dead
  assert.equal(countLivePanes('0\n'), 1);         // one live
  assert.equal(countLivePanes(''), 0);
});

test('killPaneArgs targets the coord with kill-pane', () => {
  assert.deepEqual(killPaneArgs('chq:0.2'), ['kill-pane', '-t', 'chq:0.2']);
});

// ---------------------------------------------------------------------------
// BUG A — last-pane kill releases the window viewer; non-last-pane kill keeps it.
// Real throwaway tmux session; the iTerm viewer release is an INJECTED spy so we
// never touch real iTerm.
// ---------------------------------------------------------------------------
test('killing the LAST pane in a window removes the window AND invokes the viewer release', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }
  const session = throwawaySession('last');
  t.after(() => killSession(session));

  // One window, one pane.
  const paneId = tmux(['new-session', '-d', '-s', session, '-x', '120', '-y', '30', '-P', '-F', '#{pane_id}', 'sleep 30']).trim();

  let released = 0;
  const result = killPaneReleasingEmptyWindow({
    paneId,
    coord: `${session}:0.0`,
    releaseViewer: () => { released += 1; }
  });

  assert.equal(result.ok, true, result.error || '');
  assert.equal(result.releasedViewer, true);
  assert.equal(released, 1, 'viewer release must fire exactly once for an emptied window');

  // The session is gone (its last window/pane died).
  assert.equal(childProcess.spawnSync('tmux', ['has-session', '-t', session]).status !== 0, true);
});

test('killing a NON-last pane keeps the window + surviving panes and does NOT release the viewer', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }
  const session = throwawaySession('multi');
  t.after(() => killSession(session));

  // One window, TWO panes.
  tmux(['new-session', '-d', '-s', session, '-x', '120', '-y', '30', 'sleep 30']);
  const secondPane = tmux(['split-window', '-h', '-t', `${session}:0`, '-P', '-F', '#{pane_id}', 'sleep 30']).trim();

  let released = 0;
  const result = killPaneReleasingEmptyWindow({
    paneId: secondPane,
    coord: `${session}:0.1`,
    releaseViewer: () => { released += 1; }
  });

  assert.equal(result.ok, true, result.error || '');
  assert.equal(result.releasedViewer, false);
  assert.equal(released, 0, 'viewer must survive while sibling panes remain');

  // Window + the surviving pane still exist.
  assert.equal(childProcess.spawnSync('tmux', ['has-session', '-t', session]).status, 0);
  const panes = tmux(['list-panes', '-t', session, '-F', '#{pane_id}']).split('\n').filter(Boolean);
  assert.equal(panes.length, 1, `expected 1 surviving pane, got ${panes.length}`);
});

function waitForDeadPane(session, paneId, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const out = childProcess.execFileSync('tmux', ['list-panes', '-t', session, '-F', '#{pane_id} #{pane_dead}'], { encoding: 'utf8' });
    if (out.split('\n').some(l => l.startsWith(`${paneId} 1`))) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
  }
  return false;
}

// H3 — a DEAD remain-on-exit pane must not block viewer release. #{window_panes}
// counts dead panes, so the old gate saw window_panes==2 when the last LIVE agent
// closed → viewer NOT released → [tmux detached] window hangs (exactly BUG A).
test('H3: a dead remain-on-exit pane does NOT block viewer release when the last LIVE pane closes', (t) => {
  if (!hasTmux()) { t.skip('tmux is not installed'); return; }
  const session = throwawaySession('deadblock');
  t.after(() => killSession(session));

  // Window with TWO panes: one live (sleep), one that will die (remain-on-exit + exit).
  const livePane = tmux(['new-session', '-d', '-s', session, '-x', '120', '-y', '30', '-P', '-F', '#{pane_id}', 'sleep 30']).trim();
  const dyingPane = tmux(['split-window', '-h', '-t', `${session}:0`, '-P', '-F', '#{pane_id}', 'sh -c "exit 0"']).trim();
  tmux(['set-option', '-p', '-t', dyingPane, 'remain-on-exit', 'on']);
  // Re-run so the pane actually exits under remain-on-exit (split already ran;
  // respawn to guarantee the dead state, then wait).
  tmux(['respawn-pane', '-k', '-t', dyingPane, 'sh', '-c', 'exit 0']);
  assert.ok(waitForDeadPane(session, dyingPane), 'dying pane should be dead (remain-on-exit)');

  // Now close the last LIVE pane. window_panes is still 2 (1 live + 1 dead), but
  // there are no LIVE panes left, so the viewer MUST be released.
  let released = 0;
  const result = killPaneReleasingEmptyWindow({
    paneId: livePane,
    coord: `${session}:0`,
    releaseViewer: () => { released += 1; }
  });

  assert.equal(result.ok, true, result.error || '');
  assert.equal(released, 1, 'viewer must release: no LIVE panes remain (dead pane must not block it)');
  assert.equal(result.releasedViewer, true);
});
