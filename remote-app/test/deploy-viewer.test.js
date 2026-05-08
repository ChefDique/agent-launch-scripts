const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hasRequiredTmuxClient,
  noncanonicalGroupedSessions,
  parseTmuxClientLines,
  parseTmuxSessionGroupLines,
  plainTmuxClients,
  viewerSafetyError
} = require('../deploy-viewer');

test('tmux client parser keeps client name and control-mode flag', () => {
  assert.deepEqual(parseTmuxClientLines('tmux-1\t1\nplain\t0\n\n'), [
    { name: 'tmux-1', controlMode: '1' },
    { name: 'plain', controlMode: '0' }
  ]);
});

test('movable deploy layouts require a control-mode tmux client', () => {
  assert.equal(hasRequiredTmuxClient('teams', [{ name: 'plain', controlMode: '0' }]), false);
  assert.equal(hasRequiredTmuxClient('teams', [{ name: 'control', controlMode: '1' }]), true);
  assert.equal(hasRequiredTmuxClient('ittab', [{ name: 'plain', controlMode: '0' }]), false);
  assert.equal(hasRequiredTmuxClient('ittab', [{ name: 'control', controlMode: '1' }]), true);
});

test('non-ittab deploy only requires any tmux client', () => {
  assert.equal(hasRequiredTmuxClient('panes', []), false);
  assert.equal(hasRequiredTmuxClient('panes', [{ name: 'plain', controlMode: '0' }]), true);
});

test('viewer safety catches grouped session aliases before opening iTerm', () => {
  const sessions = parseTmuxSessionGroupLines('chq\tchq\nchq-swarmy\tchq\nsession1\t\n');

  assert.deepEqual(noncanonicalGroupedSessions('chq', sessions), [
    { name: 'chq-swarmy', group: 'chq' }
  ]);
  assert.match(
    viewerSafetyError({ sessionName: 'chq', layout: 'ittab', sessions, clients: [] }),
    /noncanonical grouped tmux sessions exist: chq-swarmy/
  );
});

test('viewer safety catches plain clients before control-mode attach', () => {
  const clients = parseTmuxClientLines('/dev/ttys008\t0\n/dev/ttys009\t1\n');

  assert.deepEqual(plainTmuxClients(clients), [{ name: '/dev/ttys008', controlMode: '0' }]);
  assert.match(
    viewerSafetyError({ sessionName: 'chq', layout: 'ittab', sessions: [{ name: 'chq', group: 'chq' }], clients }),
    /plain tmux clients are attached: \/dev\/ttys008/
  );
  assert.match(
    viewerSafetyError({ sessionName: 'chq', layout: 'teams', sessions: [{ name: 'chq', group: 'chq' }], clients }),
    /plain tmux clients are attached: \/dev\/ttys008/
  );
  assert.equal(
    viewerSafetyError({ sessionName: 'chq', layout: 'panes', sessions: [{ name: 'chq', group: 'chq' }], clients }),
    ''
  );
});
