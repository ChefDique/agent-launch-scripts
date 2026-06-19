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

// Release the window's viewer ONLY when exactly one pane remained before the
// kill (i.e. the kill empties the window). Anything else — including an unknown
// / NaN / zero count — fails safe to "do not release", so a transient query
// failure can never nuke a viewer that still has live panes behind it.
function shouldReleaseWindowViewer(windowPanesBeforeKill) {
  return Number(windowPanesBeforeKill) === 1;
}

function windowPaneCountArgs(paneId) {
  return ['display-message', '-t', String(paneId), '-p', '#{window_panes}'];
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

  // Read the window's pane count BEFORE the kill — afterwards the pane is gone
  // and (if it was last) so is the window, so we could not learn this post-hoc.
  let countBefore = NaN;
  const countRes = runTmux(windowPaneCountArgs(paneId || coord));
  if (countRes.status === 0) {
    const raw = (countRes.stdout || '').trim();
    if (/^\d+$/.test(raw)) countBefore = Number(raw);
  }

  const killRes = runTmux(killPaneArgs(coord || paneId));
  if (killRes.status !== 0) {
    return { ok: false, error: (killRes.stderr || 'kill-pane failed').trim(), releasedViewer: false };
  }

  let releasedViewer = false;
  if (shouldReleaseWindowViewer(countBefore) && typeof releaseViewer === 'function') {
    try { releaseViewer(); releasedViewer = true; } catch (err) {
      return { ok: true, releasedViewer: false, viewerError: err.message };
    }
  }
  return { ok: true, releasedViewer };
}

module.exports = {
  shouldReleaseWindowViewer,
  windowPaneCountArgs,
  killPaneArgs,
  killPaneReleasingEmptyWindow,
  defaultRunTmux
};
