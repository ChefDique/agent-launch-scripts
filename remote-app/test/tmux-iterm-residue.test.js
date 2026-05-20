const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ITERM_CONTROL_MODE_RESIDUE_OPTIONS,
  tmuxListWindowIdsArgs,
  tmuxUnsetSessionOptionArgs,
  tmuxUnsetWindowOptionArgs,
  validateTmuxTarget,
  validateTmuxUserOption
} = require('../tmux-iterm-residue');

test('iTerm control-mode residue helper clears hidden and buried tmux user options', () => {
  assert.deepEqual(ITERM_CONTROL_MODE_RESIDUE_OPTIONS, ['@hidden', '@buried_indexes']);
  assert.deepEqual(tmuxListWindowIdsArgs('chq'), ['list-windows', '-t', 'chq', '-F', '#{window_id}']);
  assert.deepEqual(tmuxUnsetSessionOptionArgs('chq', '@hidden'), ['set-option', '-q', '-u', '-t', 'chq', '@hidden']);
  assert.deepEqual(tmuxUnsetWindowOptionArgs('@42', '@buried_indexes'), [
    'set-option',
    '-q',
    '-w',
    '-u',
    '-t',
    '@42',
    '@buried_indexes'
  ]);
});

test('tmux residue helper rejects suspicious targets and options', () => {
  assert.equal(validateTmuxTarget('chq:2.0'), 'chq:2.0');
  assert.equal(validateTmuxTarget('%12'), '%12');
  assert.equal(validateTmuxUserOption('@hidden'), '@hidden');
  assert.throws(() => validateTmuxTarget('chq; rm -rf /'), /invalid tmux target/);
  assert.throws(() => validateTmuxTarget(''), /invalid tmux target/);
  assert.throws(() => validateTmuxUserOption('hidden'), /invalid tmux user option/);
  assert.throws(() => validateTmuxUserOption('@hidden;bad'), /invalid tmux user option/);
});
