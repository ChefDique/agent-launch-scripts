function paneKey(pane) {
  return pane && (pane.paneId || pane.coord);
}

function sidecarSessionMatches(pane, sidecarEntry) {
  if (!sidecarEntry || !sidecarEntry.session) return true;
  return typeof pane.coord === 'string' && pane.coord.startsWith(`${sidecarEntry.session}:`);
}

function resolveAgentPanes({ agent, panes = [], sidecar = {} } = {}) {
  if (!agent || !agent.id) return [];

  const resolved = [];
  const seen = new Set();
  const paneById = {};

  for (const pane of panes) {
    if (pane && pane.paneId) paneById[pane.paneId] = pane;
  }

  const add = (pane, matchSource) => {
    if (!pane) return;
    const key = paneKey(pane);
    if (!key || seen.has(key)) return;
    seen.add(key);
    resolved.push({ ...pane, matchSource });
  };

  const sidecarEntry = sidecar[agent.id];
  if (sidecarEntry && sidecarEntry.pane_id) {
    const pane = paneById[sidecarEntry.pane_id];
    if (pane && sidecarSessionMatches(pane, sidecarEntry)) {
      add(pane, 'sidecar');
    }
  }

  const needle = String(agent.tmuxTarget || '').toLowerCase();
  if (needle) {
    for (const pane of panes) {
      const title = String(pane.title || '').toLowerCase();
      if (title.includes(needle)) add(pane, 'title');
    }
  }

  return resolved;
}

function removeSidecarIds(sidecar = {}, ids = []) {
  const remove = new Set(ids);
  const next = {};
  for (const [id, entry] of Object.entries(sidecar || {})) {
    if (!remove.has(id)) next[id] = entry;
  }
  return next;
}

function removeSidecarSession(sidecar = {}, sessionName) {
  const next = {};
  for (const [id, entry] of Object.entries(sidecar || {})) {
    if (!entry || entry.session !== sessionName) next[id] = entry;
  }
  return next;
}

function pruneSidecarToLiveSessions(sidecar = {}, liveSessions = new Set()) {
  const sessions = liveSessions instanceof Set ? liveSessions : new Set(liveSessions || []);
  const next = {};
  for (const [id, entry] of Object.entries(sidecar || {})) {
    if (!entry || !entry.session || sessions.has(entry.session)) next[id] = entry;
  }
  return next;
}

module.exports = {
  pruneSidecarToLiveSessions,
  removeSidecarIds,
  removeSidecarSession,
  resolveAgentPanes
};
