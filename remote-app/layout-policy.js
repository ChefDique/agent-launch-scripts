const LAYOUT_MODES = ['teams', 'ittab', 'panes'];
const DEPLOY_LAYOUTS = ['teams', 'ittab', 'panes'];

// 'single' is the native deploy's canonical one-window layout and the only mode
// the renderer sends now (the legacy teams/tabs/panes pills were collapsed in
// this branch). The legacy DEPLOY_LAYOUTS are still recognized so an older
// persisted/sent value normalizes safely; the native spawn path treats every
// layout as one window regardless of the label.
const SINGLE_WINDOW_LAYOUT = 'single';
const RECOGNIZED_LAYOUTS = [...DEPLOY_LAYOUTS, SINGLE_WINDOW_LAYOUT];

const DEFAULT_LAYOUT = 'teams';

function normalizeSpawnLayout(layout) {
  return RECOGNIZED_LAYOUTS.includes(layout) ? layout : DEFAULT_LAYOUT;
}

function layoutModeToDeployLayout(layoutMode) {
  return normalizeSpawnLayout(layoutMode);
}

// Map a layout to one the swarmy python runtime accepts (its argparse choices are
// ittab|panes|teams — `single` would exit 2). Only used by the hidden
// AGENTREMOTE_SPAWN=swarmy fallback path; the native path sends 'single'. `single`
// maps to `panes` (one balanced grid window), the closest swarmy equivalent.
function swarmyLayoutFor(layout) {
  if (layout === SINGLE_WINDOW_LAYOUT) return 'panes';
  return DEPLOY_LAYOUTS.includes(layout) ? layout : 'panes';
}

function tmuxAttachCommand(sessionName, layout, options = {}) {
  const safeSession = String(sessionName || '').trim();
  const movable = layout === 'ittab' || layout === 'teams' || layout === SINGLE_WINDOW_LAYOUT || options.brokeOut === true;
  return movable
    ? `tmux -CC attach -t ${safeSession}`
    : `tmux attach -t ${safeSession}`;
}

function tmuxFocusedAttachCommand(sessionName, coord) {
  const safeSession = String(sessionName || '').trim();
  const safeCoord = String(coord || '').trim();
  return `tmux select-pane -t ${safeCoord}; tmux -CC attach -t ${safeSession}`;
}

module.exports = {
  DEFAULT_LAYOUT,
  DEPLOY_LAYOUTS,
  LAYOUT_MODES,
  RECOGNIZED_LAYOUTS,
  SINGLE_WINDOW_LAYOUT,
  layoutModeToDeployLayout,
  normalizeSpawnLayout,
  swarmyLayoutFor,
  tmuxAttachCommand,
  tmuxFocusedAttachCommand
};
