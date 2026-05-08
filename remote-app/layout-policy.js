const LAYOUT_MODES = ['teams', 'ittab', 'panes'];
const DEPLOY_LAYOUTS = ['teams', 'ittab', 'panes'];

const DEFAULT_LAYOUT = 'teams';

function normalizeSpawnLayout(layout) {
  return DEPLOY_LAYOUTS.includes(layout) ? layout : DEFAULT_LAYOUT;
}

function layoutModeToDeployLayout(layoutMode) {
  return normalizeSpawnLayout(layoutMode);
}

function tmuxAttachCommand(sessionName, layout, options = {}) {
  const safeSession = String(sessionName || '').trim();
  const movable = layout === 'ittab' || layout === 'teams' || options.brokeOut === true;
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
  layoutModeToDeployLayout,
  normalizeSpawnLayout,
  tmuxAttachCommand,
  tmuxFocusedAttachCommand
};
