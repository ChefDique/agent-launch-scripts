const test = require('node:test');
const assert = require('node:assert/strict');

const { hasRequiredTmuxClient, parseTmuxClientLines } = require('../deploy-viewer');

test('tmux client parser keeps client name and control-mode flag', () => {
  assert.deepEqual(parseTmuxClientLines('tmux-1\t1\nplain\t0\n\n'), [
    { name: 'tmux-1', controlMode: '1' },
    { name: 'plain', controlMode: '0' }
  ]);
});

test('ittab deploy requires a control-mode tmux client', () => {
  assert.equal(hasRequiredTmuxClient('ittab', [{ name: 'plain', controlMode: '0' }]), false);
  assert.equal(hasRequiredTmuxClient('ittab', [{ name: 'control', controlMode: '1' }]), true);
});

test('non-ittab deploy only requires any tmux client', () => {
  assert.equal(hasRequiredTmuxClient('panes', []), false);
  assert.equal(hasRequiredTmuxClient('panes', [{ name: 'plain', controlMode: '0' }]), true);
});
