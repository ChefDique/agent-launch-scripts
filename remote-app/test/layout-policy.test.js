const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEPLOY_LAYOUTS,
  LAYOUT_MODES,
  layoutModeToDeployLayout,
  normalizeSpawnLayout,
  tmuxAttachCommand,
  tmuxFocusedAttachCommand
} = require('../layout-policy');

test('EACH/ittab remains the deploy layout instead of degrading to plain windows', () => {
  assert.equal(layoutModeToDeployLayout('ittab'), 'ittab');
});

test('deploy picker exposes separate-tabs and even-panes layouts', () => {
  assert.deepEqual(DEPLOY_LAYOUTS, ['ittab', 'panes']);
});

test('spawn layout fallback is the movable ittab layout', () => {
  assert.equal(normalizeSpawnLayout('panes'), 'panes');
  assert.equal(normalizeSpawnLayout('windows'), 'ittab');
  assert.equal(normalizeSpawnLayout('bogus'), 'ittab');
  assert.equal(normalizeSpawnLayout(''), 'ittab');
  assert.equal(normalizeSpawnLayout(null), 'ittab');
});

test('renderer layout modes match the spawn whitelist', () => {
  assert.deepEqual(LAYOUT_MODES, ['ittab', 'panes']);
});

test('attach uses iTerm control mode for movable window layouts and break-outs', () => {
  assert.equal(tmuxAttachCommand('chq', 'ittab'), 'tmux -CC attach -t chq');
  assert.equal(tmuxAttachCommand('chq', 'panes', { brokeOut: true }), 'tmux -CC attach -t chq');
  assert.equal(tmuxAttachCommand('chq', 'panes'), 'tmux attach -t chq');
});

test('focused attach selects the target pane before control-mode tmux attach', () => {
  assert.equal(tmuxFocusedAttachCommand('chq', 'chq:2.0'), 'tmux select-pane -t chq:2.0; tmux -CC attach -t chq');
  assert.equal(tmuxFocusedAttachCommand('chq', '%136'), 'tmux select-pane -t %136; tmux -CC attach -t chq');
});
