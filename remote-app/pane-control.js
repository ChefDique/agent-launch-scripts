// pane-control.js — per-pane lifecycle helpers extracted from main.js.
//
// BUG A fix lives here: when "Close" kills the LAST pane in a tmux window, the
// enclosing iTerm control-mode native window is left showing `[tmux detached]`.
// killPaneReleasingEmptyWindow reads the window's pane count BEFORE killing, then
// releases that window's iTerm viewer only when the kill empties the window —
// gated so a multi-agent (single-window) layout keeps the shared window/viewer
// for the remaining panes.
//
// Side effects are injectable (runTmux, releaseViewer) so this is unit-testable
// against isolated throwaway tmux sessions and never touches real iTerm.

const childProcess = require('child_process');

// ---------------------------------------------------------------------------
// Pure decision + argv builders (no shell strings)
// ---------------------------------------------------------------------------

// Release the window's viewer ONLY when exactly one LIVE pane remained before the
// kill (i.e. killing it leaves the window with no live agent). Anything else —
// including an unknown / NaN / zero count — fails safe to "do not release", so a
// transient query failure can never nuke a viewer that still has live panes.
//
// NB: this counts LIVE panes, not raw #{window_panes}. A dead remain-on-exit pane
// (crashed/unrespawned agent) must NOT keep the viewer pinned — otherwise closing
// the last live agent leaves a `[tmux detached]` window hanging (BUG A / H3).
function shouldReleaseWindowViewer(liveWindowPanesBeforeKill) {
  return Number(liveWindowPanesBeforeKill) === 1;
}

// List the dead-flag for every pane in the SAME window as the target pane, so the
// caller can count live panes. `-s`-less: pane targets scope list-panes to that
// pane's window by default.
function windowPaneDeadFlagsArgs(paneId) {
  return ['list-panes', '-t', String(paneId), '-F', '#{pane_dead}'];
}

// Count live (non-dead) panes from windowPaneDeadFlagsArgs stdout.
function countLivePanes(stdout) {
  return String(stdout || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter(flag => flag !== '1')
    .length;
}

function killPaneArgs(coord) {
  return ['kill-pane', '-t', String(coord)];
}

function defaultRunTmux(args) {
  const res = childProcess.spawnSync('tmux', args, { encoding: 'utf8' });
  return {
    status: typeof res.status === 'number' ? res.status : (res.error ? 1 : 0),
    stdout: res.stdout || '',
    stderr: res.stderr || (res.error ? String(res.error.message) : '')
  };
}

// ---------------------------------------------------------------------------
// killPaneReleasingEmptyWindow — kill one pane; if it was the last in its
// window, release that window's iTerm viewer. Returns { ok, releasedViewer }.
//
// `releaseViewer` is the injected effect (in production: hide/close the marked
// AgentRemote iTerm viewer via osascript). It is only ever called when the
// killed pane emptied its window.
// ---------------------------------------------------------------------------
function killPaneReleasingEmptyWindow(opts = {}) {
  const { paneId, coord, releaseViewer = null, runTmux = defaultRunTmux } = opts;
  const target = paneId || coord;
  if (!target) return { ok: false, error: 'no pane target', releasedViewer: false };

  // Count LIVE panes in the target's window BEFORE the kill — afterwards the pane
  // is gone (and if it was the last live one, possibly the window too), so we
  // can't learn this post-hoc. Counting live (not raw) panes means a dead
  // remain-on-exit sibling does not pin the viewer open (H3 / BUG A).
  let liveBefore = NaN;
  const flagsRes = runTmux(windowPaneDeadFlagsArgs(paneId || coord));
  if (flagsRes.status === 0) {
    liveBefore = countLivePanes(flagsRes.stdout);
  }

  const killRes = runTmux(killPaneArgs(coord || paneId));
  if (killRes.status !== 0) {
    return { ok: false, error: (killRes.stderr || 'kill-pane failed').trim(), releasedViewer: false };
  }

  let releasedViewer = false;
  if (shouldReleaseWindowViewer(liveBefore) && typeof releaseViewer === 'function') {
    try { releaseViewer(); releasedViewer = true; } catch (err) {
      return { ok: true, releasedViewer: false, viewerError: err.message };
    }
  }
  return { ok: true, releasedViewer };
}

module.exports = {
  shouldReleaseWindowViewer,
  windowPaneDeadFlagsArgs,
  countLivePanes,
  killPaneArgs,
  killPaneReleasingEmptyWindow,
  defaultRunTmux
};
