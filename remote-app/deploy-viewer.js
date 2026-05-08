function parseTmuxClientLines(output) {
  return String(output || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [name = '', controlMode = '0'] = line.split('\t');
      return { name, controlMode };
    });
}

function hasRequiredTmuxClient(layout, clients) {
  const list = Array.isArray(clients) ? clients : [];
  if (String(layout || '') === 'ittab') {
    return list.some(client => String(client.controlMode) === '1');
  }
  return list.length > 0;
}

function parseTmuxSessionGroupLines(output) {
  return String(output || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [name = '', group = ''] = line.split('\t');
      return { name, group };
    });
}

function noncanonicalGroupedSessions(sessionName, sessions) {
  const canonical = String(sessionName || '').trim();
  if (!canonical) return [];
  return (Array.isArray(sessions) ? sessions : []).filter(session => {
    return session && session.group === canonical && session.name !== canonical;
  });
}

function plainTmuxClients(clients) {
  return (Array.isArray(clients) ? clients : []).filter(client => {
    return String(client.controlMode) !== '1';
  });
}

function viewerSafetyError({ sessionName = 'chq', layout = 'ittab', sessions = [], clients = [] } = {}) {
  const grouped = noncanonicalGroupedSessions(sessionName, sessions);
  if (grouped.length > 0) {
    return `refusing to open AgentRemote viewer while noncanonical grouped tmux sessions exist: ${grouped.map(s => s.name).join(', ')}`;
  }
  if (String(layout || '') === 'ittab') {
    const plain = plainTmuxClients(clients);
    if (plain.length > 0) {
      return `refusing to open AgentRemote control-mode viewer while plain tmux clients are attached: ${plain.map(c => c.name).join(', ')}`;
    }
  }
  return '';
}

module.exports = {
  hasRequiredTmuxClient,
  noncanonicalGroupedSessions,
  parseTmuxClientLines,
  parseTmuxSessionGroupLines,
  plainTmuxClients,
  viewerSafetyError
};
