const ITERM_CONTROL_MODE_RESIDUE_OPTIONS = ['@hidden', '@buried_indexes'];

function validateTmuxTarget(value, label = 'tmux target') {
  const target = String(value || '').trim();
  if (!target || !/^[a-z0-9_%:@,./-]+$/i.test(target)) {
    throw new Error(`invalid ${label}`);
  }
  return target;
}

function validateTmuxUserOption(value) {
  const option = String(value || '').trim();
  if (!/^@[a-z0-9_-]+$/i.test(option)) {
    throw new Error('invalid tmux user option');
  }
  return option;
}

function tmuxListWindowIdsArgs(sessionName) {
  return ['list-windows', '-t', validateTmuxTarget(sessionName, 'tmux session'), '-F', '#{window_id}'];
}

function tmuxUnsetSessionOptionArgs(sessionName, option) {
  return [
    'set-option',
    '-q',
    '-u',
    '-t',
    validateTmuxTarget(sessionName, 'tmux session'),
    validateTmuxUserOption(option)
  ];
}

function tmuxUnsetWindowOptionArgs(windowTarget, option) {
  return [
    'set-option',
    '-q',
    '-w',
    '-u',
    '-t',
    validateTmuxTarget(windowTarget, 'tmux window'),
    validateTmuxUserOption(option)
  ];
}

module.exports = {
  ITERM_CONTROL_MODE_RESIDUE_OPTIONS,
  tmuxListWindowIdsArgs,
  tmuxUnsetSessionOptionArgs,
  tmuxUnsetWindowOptionArgs,
  validateTmuxTarget,
  validateTmuxUserOption
};
