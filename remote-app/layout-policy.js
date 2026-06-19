const LAYOUT_MODES = ['teams', 'ittab', 'panes'];
const DEPLOY_LAYOUTS = ['teams', 'ittab', 'panes'];

// 'single' is the native deploy's canonical one-window layout. It is recognized
// (passes through normalizeSpawnLayout) but intentionally NOT added to
// DEPLOY_LAYOUTS / LAYOUT_MODES yet — the renderer's layout pills are being
// collapsed in a separate change. Keeping the legacy modes recognized avoids
// colliding with that in-flight renderer work; the native spawn path treats
// every layout as one window regardless of the label.
const SINGLE_WINDOW_LAYOUT = 'single';
const RECOGNIZED_LAYOUTS = [...DEPLOY_LAYOUTS, SINGLE_WINDOW_LAYOUT];

const DEFAULT_LAYOUT = 'teams';

function normalizeSpawnLayout(layout) {
  return RECOGNIZED_LAYOUTS.includes(layout) ? layout : DEFAULT_LAYOUT;
}

function layoutModeToDeployLayout(layoutMode) {
  return normalizeSpawnLayout(layoutMode);
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
  tmuxAttachCommand,
  tmuxFocusedAttachCommand
};
