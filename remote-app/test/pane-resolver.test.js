const test = require('node:test');
const assert = require('node:assert/strict');

const { pruneSidecarToLiveSessions, removeSidecarIds, removeSidecarSession, resolveAgentPanes } = require('../pane-resolver');

test('sidecar pane resolves even when the pane title no longer matches the agent target', () => {
  const panes = [
    { coord: 'chq:1.0', paneId: '%44', title: '', command: 'zsh' }
  ];
  const sidecar = {
    claude: { pane_id: '%44', session: 'chq' }
  };
  const agent = { id: 'claude', tmuxTarget: 'neo', displayName: 'Claude' };

  assert.deepEqual(resolveAgentPanes({ agent, panes, sidecar }), [
    { coord: 'chq:1.0', paneId: '%44', title: '', command: 'zsh', matchSource: 'sidecar' }
  ]);
});

test('sidecar and title matches are deduped by stable pane id', () => {
  const panes = [
    { coord: 'chq:0.0', paneId: '%1', title: 'TMUX-MASTA', command: 'claude' }
  ];
  const sidecar = {
    claude: { pane_id: '%1', session: 'chq' }
  };
  const agent = { id: 'claude', tmuxTarget: 'neo' };

  assert.equal(resolveAgentPanes({ agent, panes, sidecar }).length, 1);
});

test('sidecar entries for another session are ignored', () => {
  const panes = [
    { coord: 'other:0.0', paneId: '%44', title: '', command: 'zsh' }
  ];
  const sidecar = {
    claude: { pane_id: '%44', session: 'chq' }
  };
  const agent = { id: 'claude', tmuxTarget: 'neo' };

  assert.deepEqual(resolveAgentPanes({ agent, panes, sidecar }), []);
});

test('stale sidecar pane is ignored when live pane identity belongs to another agent', () => {
  const panes = [
    {
      coord: 'chq:0.0',
      paneId: '%1080',
      title: 'CorporateHQ',
      agentIdentity: 'xavier-codex'
    }
  ];
  const sidecar = {
    'mugatu-claude': { pane_id: '%1080', session: 'chq' }
  };
  const agent = { id: 'mugatu-claude', tmuxTarget: 'mugatu', displayName: 'MUGATU' };

  assert.deepEqual(resolveAgentPanes({ agent, panes, sidecar }), []);
});

test('sidecar still resolves when live pane identity matches the same agent on another runtime suffix', () => {
  const panes = [
    {
      coord: 'chq:0.0',
      paneId: '%1080',
      title: '',
      agentIdentity: 'mugatu-codex'
    }
  ];
  const sidecar = {
    'mugatu-claude': { pane_id: '%1080', session: 'chq' }
  };
  const agent = { id: 'mugatu-claude', tmuxTarget: 'mugatu', displayName: 'MUGATU' };

  assert.deepEqual(resolveAgentPanes({ agent, panes, sidecar }), [
    { coord: 'chq:0.0', paneId: '%1080', title: '', agentIdentity: 'mugatu-codex', matchSource: 'sidecar' }
  ]);
});

test('title fallback is ignored when live pane identity contradicts the selected agent', () => {
  const panes = [
    {
      coord: 'chq:0.0',
      paneId: '%1080',
      title: 'MUGATU',
      agentIdentity: 'xavier-codex'
    }
  ];
  const agent = { id: 'mugatu-claude', tmuxTarget: 'mugatu', displayName: 'MUGATU' };

  assert.deepEqual(resolveAgentPanes({ agent, panes, sidecar: {} }), []);
});

test('sidecar cleanup removes killed agent ids without touching siblings', () => {
  const sidecar = {
    claude: { pane_id: '%44', session: 'chq' },
    gekko: { pane_id: '%19', session: 'chq' }
  };

  assert.deepEqual(removeSidecarIds(sidecar, ['claude']), {
    gekko: { pane_id: '%19', session: 'chq' }
  });
});

test('session cleanup removes only entries for the killed tmux session', () => {
  const sidecar = {
    claude: { pane_id: '%44', session: 'chq' },
    helper: { pane_id: '%9', session: 'other' }
  };

  assert.deepEqual(removeSidecarSession(sidecar, 'chq'), {
    helper: { pane_id: '%9', session: 'other' }
  });
});

test('sidecar pruning removes entries for sessions tmux no longer reports', () => {
  const sidecar = {
    xavier: { pane_id: '%44', session: 'chq' },
    helper: { pane_id: '%9', session: 'session1' },
    legacy: { pane_id: '%10' }
  };

  assert.deepEqual(pruneSidecarToLiveSessions(sidecar, new Set(['session1'])), {
    helper: { pane_id: '%9', session: 'session1' },
    legacy: { pane_id: '%10' }
  });
});

test('sidecar pruning removes entries whose pane id no longer exists', () => {
  const sidecar = {
    xavier: { pane_id: '%44', session: 'chq' },
    stale: { pane_id: '%45', session: 'chq' }
  };

  assert.deepEqual(pruneSidecarToLiveSessions(sidecar, new Set(['chq']), new Set(['%44'])), {
    xavier: { pane_id: '%44', session: 'chq' }
  });
});
