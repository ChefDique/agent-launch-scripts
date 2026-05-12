const { app, BrowserWindow, ipcMain, Menu, session, dialog, globalShortcut, screen, clipboard } = require('electron');
const { execFile, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { normalizeSpawnLayout } = require('./layout-policy');
const { pruneSidecarToLiveSessions, removeSidecarIds, removeSidecarSession, resolveAgentPanes } = require('./pane-resolver');
const { HARNESS_RUNTIME_IDS, normalizeRuntime } = require('./harness-options');
const { computeWindowBounds } = require('./window-geometry');
const { buildITermAttachScript } = require('./iterm-attach');
const { transcriptMessagesForAgent } = require('./agent-transcript-source');
const { getModelsForHarness, getDefaultModelForHarness } = require('./harness-models');
const {
  hasRequiredTmuxClient,
  parseTmuxClientLines,
  parseTmuxSessionGroupLines,
  viewerSafetyError
} = require('./deploy-viewer');
const APP_PACKAGE = require('./package.json');
const { bus: atlasBus } = require('./atlas-event-bus');

// Pin the app name BEFORE anything reads userData paths. Without this, Electron
// defaults to "Electron" and the userData dir at
// ~/Library/Application Support/Electron/ is shared with every other dev
// Electron app on the system — caches and storage cross-contaminate. Pinning
// to "AgentRemote" gives this app its own isolated userData dir so storage,
// V8 code cache, GPU caches, and Local State don't leak in from elsewhere.
app.setName('AgentRemote');

const REPO_ROOT = path.join(__dirname, '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'agents.json');
const SWARMY_ROOT = process.env.SWARMY_ROOT || path.join(os.homedir(), 'ai_projects', 'swarmy');
const SWARMY_RUNTIME_SCRIPT = process.env.AGENTREMOTE_SWARMY_RUNTIME
  || path.join(SWARMY_ROOT, 'scripts', 'agentremote_runtime.py');
const RUNTIME_SESSION = process.env.AGENTREMOTE_TMUX_SESSION || 'chq';
const DEFAULT_LEAD_STARTUP_SLASH = '/lead-gogo';
const ASSETS_DIR = path.join(__dirname, 'assets');
const OUT_LOG = path.join(__dirname, 'out.log');
const DEFAULT_ACRM_ENV_PATH = path.join(os.homedir(), 'ai_projects', 'CorporateHQ', 'ACRM', '.env.local');
const AVATAR_EXTENSIONS = ['svg', 'gif', 'png', 'jpg', 'jpeg', 'webp'];
const USER_CODEX_PETS_DIR = path.join(os.homedir(), '.codex', 'pets');
const BUNDLED_PETS_DIR = path.join(ASSETS_DIR, 'pets');
const PET_WINDOW_FILE = path.join(__dirname, 'pet-window.html');
const PASTED_IMAGES_DIR = path.join(os.tmpdir(), 'agentremote-pasted-images');
const PASTED_IMAGE_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp'
};

async function savePastedImageBuffer(bytes, mimeType = 'image/png') {
  const normalizedMime = String(mimeType || 'image/png').toLowerCase();
  const ext = PASTED_IMAGE_EXTENSIONS[normalizedMime] || 'png';
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    return { ok: false, error: 'image clipboard data empty' };
  }
  if (bytes.length > 25 * 1024 * 1024) {
    return { ok: false, error: 'image paste is larger than 25MB' };
  }

  await fsp.mkdir(PASTED_IMAGES_DIR, { recursive: true });
  const filename = `paste-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const filePath = path.join(PASTED_IMAGES_DIR, filename);
  await fsp.writeFile(filePath, bytes, { flag: 'wx' });
  return { ok: true, path: filePath, mimeType: normalizedMime };
}

// Sidecar written by Swarmy's AgentRemote runtime at pane creation time. Maps agent id → stable
// pane_id (%N notation). AgentRemote reads this to target broadcasts via pane_id
// rather than fragile pane-title grep. pane_id survives agent auto-restart
// (pane_loop relaunches the configured runtime in the SAME pane), so no re-write is needed on
// relaunch — the sidecar entry for a given agent is valid until the session ends.
const SIDECAR_PATH = '/tmp/agent-remote-panes.json';
const MESSAGE_AGENT_PYTHON = process.env.MESSAGE_AGENT_PYTHON || 'python3';
const MESSAGE_AGENT_PANE_RESOLVER = path.join(
  os.homedir(),
  'ai_projects',
  'tools',
  'message-agent',
  'scripts',
  'agentremote_pane_resolver.py'
);
const MESSAGE_AGENT_REGISTRY_PATH = path.join(
  os.homedir(),
  'ai_projects',
  'tools',
  'message-agent',
  'registry',
  'agents.local.json'
);
const AGENT_ID_PATTERN = /^[a-z0-9_-]+$/i;

// Tiny buffer above display.workArea bottom so the window doesn't sit flush
// against the dock / screen bottom when the radial menu grows downward.
// Used by resize-window's bottom-cap logic.
const WORKAREA_BOTTOM_SAFETY = 4;

// Global accelerator for the show/hide toggle. Richard switched from literal
// Control to Cmd 2026-05-02 — Mac muscle memory reaches for Cmd+Shift+Space,
// not Ctrl+Shift+Space. macOS Ctrl is rarely used for app shortcuts; Cmd is
// the convention. Cmd+Space (Spotlight), Cmd+Ctrl+Space (Character Viewer),
// and Cmd+Option+Space (alternate Spotlight) are taken — Cmd+Shift+Space
// is free on stock macOS.
const TOGGLE_ACCELERATOR = 'Cmd+Shift+Space';

let mainWindow;
const petWindows = new Map();
const petWindowConfigs = new Map();
const petMoveTimers = new Map();
const petPointerDragAgents = new Set();
const PET_WINDOW_GEOMETRY = {
  minWidth: 300,
  minHeight: 340,
  maxWidth: 520,
  maxHeight: 620,
  defaultWidth: 340,
  defaultHeight: 360
};
const PET_BUBBLE_EDGE_THRESHOLD = 96;
const PET_WORKAREA_SAFETY = 8;
let isQuitting = false;

// Best-effort append to remote-app/out.log. Used so registration warnings
// (e.g. accelerator already taken) survive across launches without depending
// on how launch-remote.sh routes stdio. Never throws.
function logToOutLog(line) {
  try {
    const ts = new Date().toISOString();
    fs.appendFileSync(OUT_LOG, `[${ts}] ${line}\n`, 'utf8');
  } catch { /* no-op: logging must not break the app */ }
}

function bundledAvatarForId(id) {
  const clean = String(id || '').trim();
  if (!clean) return '';
  for (const ext of AVATAR_EXTENSIONS) {
    const filename = `${clean}.${ext}`;
    if (fs.existsSync(path.join(ASSETS_DIR, filename))) return filename;
  }
  return '';
}

function avatarExtension(filePath) {
  const ext = path.extname(String(filePath || '')).replace(/^\./, '').toLowerCase();
  return AVATAR_EXTENSIONS.includes(ext) ? ext : '';
}

function gitValue(args, fallback = '') {
  try {
    return execFileSync('git', ['-C', REPO_ROOT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500
    }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function appBuildInfo() {
  const branch = gitValue(['branch', '--show-current'], 'unknown');
  const commit = gitValue(['rev-parse', '--short', 'HEAD'], 'nogit');
  const dirty = !!gitValue(['status', '--short'], '');
  return {
    version: APP_PACKAGE.version || app.getVersion(),
    branch,
    commit,
    dirty,
    repoRoot: REPO_ROOT,
    appPath: __dirname,
    display: `v${APP_PACKAGE.version || app.getVersion()} ${branch}@${commit}${dirty ? '*' : ''}`
  };
}

function loadCodexPetsFromDir(dir, source) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => {
        const petDir = path.join(dir, entry.name);
        const manifestPath = path.join(petDir, 'pet.json');
        if (!fs.existsSync(manifestPath)) return null;
        let manifest = {};
        try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
        catch { return null; }
        const petId = String(manifest.id || entry.name || '').trim();
        if (!/^[a-z0-9][a-z0-9_-]*$/i.test(petId)) return null;
        const sheetName = String(manifest.spritesheetPath || 'spritesheet.webp');
        const sheetPath = path.join(petDir, sheetName);
        if (!fs.existsSync(sheetPath)) return null;
        return {
          id: petId,
          displayName: String(manifest.displayName || petId),
          description: String(manifest.description || ''),
          sheetUrl: pathToFileURL(sheetPath).href,
          source
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  } catch {
    return [];
  }
}

function loadCodexPetRoster() {
  const seen = new Set();
  const pets = [];
  for (const pet of [
    ...loadCodexPetsFromDir(USER_CODEX_PETS_DIR, 'codex'),
    ...loadCodexPetsFromDir(BUNDLED_PETS_DIR, 'bundled')
  ]) {
    const key = pet.id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    pets.push(pet);
  }
  return pets;
}

function petStatePath() {
  return path.join(app.getPath('userData'), 'pet-state.json');
}

function emptyPetState() {
  return { visible: {}, selections: {}, bounds: {} };
}

function readPetState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(petStatePath(), 'utf8'));
    return {
      visible: parsed && typeof parsed.visible === 'object' ? parsed.visible : {},
      selections: parsed && typeof parsed.selections === 'object' ? parsed.selections : {},
      bounds: parsed && typeof parsed.bounds === 'object' ? parsed.bounds : {}
    };
  } catch {
    return emptyPetState();
  }
}

function writePetState(state) {
  const next = {
    visible: state && typeof state.visible === 'object' ? state.visible : {},
    selections: state && typeof state.selections === 'object' ? state.selections : {},
    bounds: state && typeof state.bounds === 'object' ? state.bounds : {}
  };
  fs.mkdirSync(path.dirname(petStatePath()), { recursive: true });
  fs.writeFileSync(petStatePath(), JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

function normalizePetId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function agentById(agentId) {
  const wanted = String(agentId || '');
  return loadAgents().find(a => a.id === wanted) || null;
}

function petById(petId) {
  const wanted = normalizePetId(petId);
  return loadCodexPetRoster().find(p => normalizePetId(p.id) === wanted) || null;
}

function defaultPetForAgent(agent) {
  const pets = loadCodexPetRoster();
  if (!agent || pets.length === 0) return null;
  const byId = new Map(pets.map(p => [normalizePetId(p.id), p]));
  const candidates = [
    agent.id,
    agent.displayName,
    agent.runtime === 'openclaw' ? 'openclaw' : '',
    agent.runtime === 'hermes' ? 'hermes' : ''
  ].map(normalizePetId).filter(Boolean);
  for (const candidate of candidates) {
    if (byId.has(candidate)) return byId.get(candidate);
  }
  return pets[0] || null;
}

function defaultPetBounds(agentId) {
  const display = mainWindow && !mainWindow.isDestroyed()
    ? screen.getDisplayMatching(mainWindow.getBounds())
    : screen.getPrimaryDisplay();
  const work = display.workArea;
  let x = work.x + Math.round(work.width / 2) - 200;
  let y = work.y + 80;
  if (mainWindow && !mainWindow.isDestroyed()) {
    const mainBounds = mainWindow.getBounds();
    x = mainBounds.x + Math.max(0, Math.round(mainBounds.width / 2) - 200);
    y = Math.max(work.y + 16, mainBounds.y - 250);
  }
  const offset = Math.max(0, Array.from(petWindows.keys()).indexOf(agentId)) * 26;
  return {
    x: x + offset,
    y: y + offset,
    width: PET_WINDOW_GEOMETRY.defaultWidth,
    height: PET_WINDOW_GEOMETRY.defaultHeight
  };
}

function petWindowDisplayForBounds(bounds = {}) {
  const candidate = {
    x: Number.isFinite(Number(bounds.x)) ? Math.round(Number(bounds.x)) : 0,
    y: Number.isFinite(Number(bounds.y)) ? Math.round(Number(bounds.y)) : 0,
    width: Math.max(1, Number.isFinite(Number(bounds.width)) ? Math.round(Number(bounds.width)) : PET_WINDOW_GEOMETRY.defaultWidth),
    height: Math.max(1, Number.isFinite(Number(bounds.height)) ? Math.round(Number(bounds.height)) : PET_WINDOW_GEOMETRY.defaultHeight)
  };

  try {
    const byBounds = screen.getDisplayMatching(candidate);
    if (byBounds && byBounds.workArea) return byBounds;
  } catch {}

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      const byMain = screen.getDisplayMatching(mainWindow.getBounds());
      if (byMain && byMain.workArea) return byMain;
    } catch {}
  }

  return screen.getPrimaryDisplay();
}

function persistPetBounds(agentId, bounds) {
  const state = readPetState();
  state.bounds[agentId] = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  };
  try { writePetState(state); }
  catch (err) { logToOutLog(`[pet] persist bounds failed for ${agentId}: ${err.message}`); }
}

function notifyPetWindows(channel, ...args) {
  for (const win of petWindows.values()) {
    if (!win || win.isDestroyed()) continue;
    try { win.webContents.send(channel, ...args); }
    catch { /* renderer not ready */ }
  }
}

function notifyMainPetState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try { mainWindow.webContents.send('agent-pet-state-changed', readPetState()); }
  catch { /* renderer not ready */ }
}

function sendToPetWindow(agentId, channel, payload = {}) {
  const win = petWindows.get(String(agentId || ''));
  if (!win || win.isDestroyed()) return;
  try { win.webContents.send(channel, payload); }
  catch { /* renderer not ready */ }
}

function petWindowGeometryPayload(win, { moving = false, direction = 'right' } = {}) {
  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const workArea = display && display.workArea ? display.workArea : null;
  let bubblePlacement = 'above';
  if (workArea) {
    const topGap = bounds.y - workArea.y;
    const bottomGap = (workArea.y + workArea.height) - (bounds.y + bounds.height);
    bubblePlacement = topGap <= PET_BUBBLE_EDGE_THRESHOLD && bottomGap > topGap ? 'below' : 'above';
  }
  return { moving, direction, bounds, workArea, bubblePlacement };
}

function sendPetWindowGeometry(agentId, win, options = {}) {
  if (!win || win.isDestroyed()) return;
  sendToPetWindow(agentId, 'pet-window-bounds', petWindowGeometryPayload(win, options));
}

function clampPetWindowSize(width, height, fallback = {}) {
  return {
    width: Math.max(
      PET_WINDOW_GEOMETRY.minWidth,
      Math.min(PET_WINDOW_GEOMETRY.maxWidth, Number(width) || fallback.width || PET_WINDOW_GEOMETRY.defaultWidth)
    ),
    height: Math.max(
      PET_WINDOW_GEOMETRY.minHeight,
      Math.min(PET_WINDOW_GEOMETRY.maxHeight, Number(height) || fallback.height || PET_WINDOW_GEOMETRY.defaultHeight)
    )
  };
}

function normalizePetWindowBounds(bounds = {}) {
  const size = clampPetWindowSize(bounds.width, bounds.height);
  return { ...bounds, ...size };
}

function clampPetWindowBoundsToWorkArea(bounds, workArea) {
  const normalized = normalizePetWindowBounds(bounds);
  if (!workArea) return normalized;
  return computeWindowBounds(normalized, normalized, workArea, {
    minWidth: PET_WINDOW_GEOMETRY.minWidth,
    minHeight: PET_WINDOW_GEOMETRY.minHeight,
    maxWidth: PET_WINDOW_GEOMETRY.maxWidth,
    maxHeight: PET_WINDOW_GEOMETRY.maxHeight,
    safety: PET_WORKAREA_SAFETY
  });
}

function clampPetWindowBoundsToVisibleDisplay(bounds) {
  const normalized = normalizePetWindowBounds(bounds);
  try {
    const display = petWindowDisplayForBounds(normalized);
    return clampPetWindowBoundsToWorkArea(normalized, display && display.workArea);
  } catch {
    return normalized;
  }
}

function boundsChanged(a, b) {
  return a.x !== b.x || a.y !== b.y || a.width !== b.width || a.height !== b.height;
}

function finitePayloadNumber(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function petMoveWindowFromPointer(agentId, payload = {}) {
  const id = String(agentId || '');
  const win = petWindows.get(id);
  if (!win || win.isDestroyed()) return { ok: false, error: 'pet window not found' };
  const screenX = finitePayloadNumber(payload.screenX);
  const screenY = finitePayloadNumber(payload.screenY);
  const grabOffsetX = finitePayloadNumber(payload.grabOffsetX);
  const grabOffsetY = finitePayloadNumber(payload.grabOffsetY);
  if ([screenX, screenY, grabOffsetX, grabOffsetY].some(value => value == null)) {
    return { ok: false, error: 'invalid drag payload' };
  }
  const current = win.getBounds();
  petPointerDragAgents.add(id);
  const nextBounds = clampPetWindowBoundsToVisibleDisplay({
    x: Math.round(screenX - grabOffsetX),
    y: Math.round(screenY - grabOffsetY),
    width: current.width,
    height: current.height
  });
  win.setBounds(nextBounds, false);
  const direction = payload.direction === 'left' ? 'left' : 'right';
  const movePayload = petWindowGeometryPayload(win, { moving: true, direction });
  sendToPetWindow(id, 'pet-window-moving', movePayload);
  sendToPetWindow(id, 'pet-window-bounds', movePayload);
  return { ok: true, bounds: win.getBounds() };
}

function settlePetWindowBounds(agentId, win) {
  if (!win || win.isDestroyed()) return null;
  const current = win.getBounds();
  const clamped = clampPetWindowBoundsToVisibleDisplay(current);
  if (boundsChanged(current, clamped)) {
    win.setBounds(clamped, false);
  }
  const settled = win.getBounds();
  persistPetBounds(agentId, settled);
  return settled;
}

function hideAgentPetWindow(agentId, { persist = true } = {}) {
  const id = String(agentId || '');
  if (!id) return { ok: false, error: 'agent id required' };
  const win = petWindows.get(id);
  if (persist) {
    const state = readPetState();
    delete state.visible[id];
    try { writePetState(state); } catch (err) { return { ok: false, error: err.message }; }
  }
  if (win && !win.isDestroyed()) win.close();
  petWindows.delete(id);
  petWindowConfigs.delete(id);
  if (persist) notifyMainPetState();
  return { ok: true, state: readPetState() };
}

function supportsPetTranscriptStream(agent) {
  const runtime = String(agent && agent.runtime || '').toLowerCase();
  return runtime === 'claude' || runtime === 'codex';
}

function petStreamConfigForAgent(agent) {
  const transcriptSupported = supportsPetTranscriptStream(agent);
  const chatSourceDisablesPane = ['chat', 'team'].includes(agent.pet_chat_source);
  const transcriptStream = agent.pet_transcript_stream === undefined
    ? transcriptSupported
    : agent.pet_transcript_stream !== false && transcriptSupported;
  const paneStream = agent.pet_pane_stream === undefined
    ? !transcriptStream && !chatSourceDisablesPane
    : agent.pet_pane_stream === true;

  return {
    petTranscriptStream: transcriptStream,
    petPaneStream: paneStream,
    petStreamProfile: agent.pet_stream_profile || 'agent-agnostic-pane-stream-v1',
    petStreamProfileOptions: agent.pet_stream_profile_options || {}
  };
}

function showAgentPetWindow(agentId, petId) {
  const agent = agentById(agentId);
  if (!agent) return { ok: false, error: `unknown agent: ${agentId}` };
  const pet = petById(petId) || defaultPetForAgent(agent);
  if (!pet) return { ok: false, error: `unknown pet: ${petId}` };

  const state = readPetState();
  state.visible[agent.id] = true;
  state.selections[agent.id] = pet.id;
  try { writePetState(state); } catch (err) { return { ok: false, error: err.message }; }

  const config = {
    agent: {
      id: agent.id,
      displayName: agent.displayName || agent.id,
      tmuxTarget: agent.tmuxTarget,
      themeColor: agent.themeColor || '#e07c4c',
      runtime: agent.runtime || '',
      ...petStreamConfigForAgent(agent)
    },
    pet
  };
  petWindowConfigs.set(agent.id, config);

  const existing = petWindows.get(agent.id);
  if (existing && !existing.isDestroyed()) {
    existing.webContents.send('pet-config-updated', config);
    return { ok: true, state: readPetState() };
  }

  const savedBounds = state.bounds[agent.id];
  const bounds = savedBounds && Number.isFinite(savedBounds.x) && Number.isFinite(savedBounds.y)
    ? clampPetWindowBoundsToVisibleDisplay(savedBounds)
    : defaultPetBounds(agent.id);
  const win = new BrowserWindow({
    width: bounds.width || PET_WINDOW_GEOMETRY.defaultWidth,
    height: bounds.height || PET_WINDOW_GEOMETRY.defaultHeight,
    minWidth: PET_WINDOW_GEOMETRY.minWidth,
    minHeight: PET_WINDOW_GEOMETRY.minHeight,
    maxWidth: PET_WINDOW_GEOMETRY.maxWidth,
    maxHeight: PET_WINDOW_GEOMETRY.maxHeight,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    movable: true,
    hasShadow: false,
    skipTaskbar: true,
    title: `AgentRemote Pet ${agent.displayName || agent.id}`,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });
  petWindows.set(agent.id, win);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(PET_WINDOW_FILE, { query: { agentId: agent.id } });
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return;
    settlePetWindowBounds(agent.id, win);
    win.showInactive();
    sendPetWindowGeometry(agent.id, win);
  });
  let lastMoveBounds = win.getBounds();
  win.on('move', () => {
    if (win.isDestroyed()) return;
    const nextBounds = win.getBounds();
    const dx = nextBounds.x - lastMoveBounds.x;
    lastMoveBounds = nextBounds;
    const movePayload = petWindowGeometryPayload(win, {
      moving: true,
      direction: dx < 0 ? 'left' : 'right'
    });
    sendToPetWindow(agent.id, 'pet-window-moving', movePayload);
    sendToPetWindow(agent.id, 'pet-window-bounds', movePayload);
    if (petMoveTimers.has(agent.id)) clearTimeout(petMoveTimers.get(agent.id));
    petMoveTimers.set(agent.id, setTimeout(() => {
      petMoveTimers.delete(agent.id);
      if (petPointerDragAgents.has(agent.id)) return;
      const settledPayload = petWindowGeometryPayload(win, { moving: false });
      sendToPetWindow(agent.id, 'pet-window-moving', settledPayload);
      sendToPetWindow(agent.id, 'pet-window-bounds', settledPayload);
    }, 180));
  });
  win.on('moved', () => {
    if (petPointerDragAgents.has(agent.id)) return;
    if (!win.isDestroyed()) {
      settlePetWindowBounds(agent.id, win);
      const settledPayload = petWindowGeometryPayload(win, { moving: false });
      sendToPetWindow(agent.id, 'pet-window-moving', settledPayload);
      sendToPetWindow(agent.id, 'pet-window-bounds', settledPayload);
    }
  });
  win.on('resize', () => {
    sendPetWindowGeometry(agent.id, win);
  });
  win.on('closed', () => {
    if (petMoveTimers.has(agent.id)) {
      clearTimeout(petMoveTimers.get(agent.id));
      petMoveTimers.delete(agent.id);
    }
    petPointerDragAgents.delete(agent.id);
    petWindows.delete(agent.id);
    petWindowConfigs.delete(agent.id);
    if (isQuitting) return;
    const next = readPetState();
    delete next.visible[agent.id];
    try { writePetState(next); } catch {}
    notifyMainPetState();
  });
  notifyMainPetState();
  return { ok: true, state: readPetState() };
}

function restoreVisiblePetWindows() {
  const state = readPetState();
  for (const [agentId, visible] of Object.entries(state.visible || {})) {
    if (!visible) continue;
    const selectedPetId = state.selections ? state.selections[agentId] : '';
    const res = showAgentPetWindow(agentId, selectedPetId);
    if (!res.ok) logToOutLog(`[pet] restore failed for ${agentId}: ${res.error}`);
  }
}

// ---------------------------------------------------------------------------
// Registry loader
// ---------------------------------------------------------------------------
// Single source of truth for the agent list. Falls back to a minimal hardcoded
// list if the registry can't be read so the window still renders something
// rather than a blank dashboard. Reread on demand (cheap, file is < 2KB).
function loadAgents() {
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data.agents.map(a => {
      const runtime = a.runtime || 'codex';
      const tmuxTarget = a.tmux_target
        || (runtime === 'claude' && a.rename_to
          ? a.rename_to.toLowerCase()
          : String(a.id || a.display_name || '').toLowerCase());
      return {
        id: a.id,
        displayName: a.display_name,
        // Runtime-aware targeting: Claude panes eventually get /rename'd by
        // launch-agent.sh; Codex/Hermes/OpenClaw panes keep the tmux title set by
        // the Swarmy runtime adapter. Explicit tmux_target wins when a registry entry needs to
        // override either convention.
        tmuxTarget,
        cwd: a.cwd || '',           // exposed so the right-click menu can show the current value
        runtime,
        model: a.model || null,
        color: a.color || null,
        themeColor: a.theme_color || null,  // hex string for AgentRemote CSS var generation
        // Auto-restart defaults to true when the field is omitted (matches the
        // shell-side `// true` fallback in Swarmy's AgentRemote runtime loop.
        autoRestart: a.auto_restart !== false,
        // Raw registry value. Kept for launcher/runtime settings; the dock
        // label follows display_name.
        renameTo: a.rename_to || '',
        startupSlash: a.startup_slash || '',
        avatar: a.avatar || bundledAvatarForId(a.id),
        // hidden: true means "kept in registry but hidden from the dock bar".
        // Set via the "Remove from bar" radial action; cleared via "Show hidden".
        hidden: !!a.hidden
      };
    });
  } catch (err) {
    console.error(`[remote] failed to read registry ${REGISTRY_PATH}: ${err.message}`);
    return [];
  }
}

function parseEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const env = {};
    raw.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) return;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    });
    return env;
  } catch {
    return {};
  }
}

function resolveArmoryConfig() {
  const envPath = process.env.AGENTREMOTE_ACRM_ENV || DEFAULT_ACRM_ENV_PATH;
  const fileEnv = parseEnvFile(envPath);
  const supabaseUrl = process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || fileEnv.SUPABASE_URL
    || fileEnv.NEXT_PUBLIC_SUPABASE_URL
    || '';
  const supabaseKey = process.env.SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || fileEnv.SUPABASE_ANON_KEY
    || fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || '';
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, error: `Armory Supabase config missing; checked ${envPath}` };
  }
  return { ok: true, supabaseUrl: supabaseUrl.replace(/\/+$/, ''), supabaseKey };
}

function safeAgentId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function normalizeArmoryAgent(row, localById) {
  const slug = safeAgentId(row.slug || row.name);
  const local = localById.get(slug) || null;
  return {
    id: slug,
    slug: row.slug || slug,
    displayName: row.name || row.slug || slug,
    description: row.description || '',
    category: row.category || '',
    department: row.department || '',
    role: row.role || '',
    model: row.model || '',
    badge: row.badge || '',
    color: row.color || '',
    avatarUrl: row.avatar_url || '',
    isExecutive: !!row.is_executive,
    excludedFromPicker: !!row.excluded_from_picker,
    localState: local ? (local.hidden ? 'hidden' : 'visible') : 'available'
  };
}

async function fetchArmoryAgents() {
  const localAgents = loadAgents().map(a => ({
    id: a.id,
    displayName: a.displayName || a.id,
    runtime: a.runtime || 'codex',
    cwd: a.cwd || '',
    hidden: !!a.hidden,
    avatar: a.avatar || ''
  }));
  const localById = new Map(localAgents.map(agent => [agent.id, agent]));
  const config = resolveArmoryConfig();
  if (!config.ok) {
    return { ok: false, error: config.error, localAgents, armoryAgents: [] };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  const select = 'slug,name,description,category,department,role,model,badge,color,is_executive,avatar_url,excluded_from_picker,is_active';
  const url = `${config.supabaseUrl}/rest/v1/agent_registry?select=${select}&is_active=eq.true&excluded_from_picker=eq.false&order=name.asc`;
  try {
    const response = await fetch(url, {
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`
      },
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Armory request failed ${response.status}: ${text.slice(0, 180)}`);
    }
    const rows = JSON.parse(text);
    const armoryAgents = Array.isArray(rows)
      ? rows.map(row => normalizeArmoryAgent(row, localById)).filter(row => row.id)
      : [];
    return { ok: true, localAgents, armoryAgents };
  } catch (err) {
    return { ok: false, error: err.message, localAgents, armoryAgents: [] };
  } finally {
    clearTimeout(timer);
  }
}

// Atomic write to agents.json: read, parse, mutate, write to temp, rename.
// Preserves the leading _comment / _field_docs blocks at the top of the file.
function writeRegistry(mutator) {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const data = JSON.parse(raw);
  mutator(data);
  const tmp = REGISTRY_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, REGISTRY_PATH);
}

// ---------------------------------------------------------------------------
// Pane sidecar helpers
// ---------------------------------------------------------------------------
// readPaneSidecar() — parse /tmp/agent-remote-panes.json written by Swarmy's runtime adapter.
// Returns an object keyed by agent id, or {} if the file is missing / unreadable.
// Shape: { "xavier": { pane_id: "%5", session: "chq", window: 0, pane: 2, updated_at: "..." }, ... }
function readPaneSidecar() {
  try {
    const raw = fs.readFileSync(SIDECAR_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// IPC: renderer can request the sidecar directly (e.g. for diagnostic display).
ipcMain.handle('get-pane-sidecar', () => readPaneSidecar());

function writePaneSidecar(data) {
  const tmp = `${SIDECAR_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data || {}, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, SIDECAR_PATH);
}

function removePaneSidecarIds(ids) {
  try {
    const current = readPaneSidecar();
    const removed = (Array.isArray(ids) ? ids : [])
      .map(id => String(id || '').trim().toLowerCase())
      .filter(id => current && Object.prototype.hasOwnProperty.call(current, id));
    const next = removeSidecarIds(current, removed);
    writePaneSidecar(next);
    for (const id of removed) syncMessageAgentPaneEntry(id);
  } catch (err) {
    logToOutLog(`[sidecar] cleanup failed for ${ids.join(',')}: ${err.message}`);
  }
}

function syncMessageAgentPaneEntry(agentId) {
  const safeId = String(agentId || '').trim().toLowerCase();
  if (!AGENT_ID_PATTERN.test(safeId)) {
    logToOutLog(`[message-agent] skipping pane sync: invalid agent id ${agentId}`);
    return;
  }

  if (!fs.existsSync(MESSAGE_AGENT_PANE_RESOLVER)) {
    logToOutLog(`[message-agent] warning: helper not found at ${MESSAGE_AGENT_PANE_RESOLVER}`);
    return;
  }

  execFile(
    MESSAGE_AGENT_PYTHON,
    [
      MESSAGE_AGENT_PANE_RESOLVER,
      'sync',
      '--agent-id',
      safeId,
      '--sidecar',
      SIDECAR_PATH,
      '--registry',
      MESSAGE_AGENT_REGISTRY_PATH
    ],
    (err, stdout, stderr) => {
      if (err) {
        const extra = String((stderr || err.message || '').toString()).trim();
        logToOutLog(`[message-agent] warning: sync failed for ${safeId}: ${extra || 'unknown error'}`);
        return;
      }
      try {
        JSON.parse(stdout || '{}');
      } catch {
        logToOutLog(`[message-agent] warning: non-json sync response for ${safeId}`);
      }
    }
  );
}

function removePaneSidecarSession(sessionName) {
  try {
    const current = readPaneSidecar();
    const next = removeSidecarSession(current, sessionName);
    const removed = [];
    for (const [id, entry] of Object.entries(current || {})) {
      if (entry && entry.session === sessionName) removed.push(id);
    }
    writePaneSidecar(next);
    for (const id of removed) syncMessageAgentPaneEntry(id);
  } catch (err) {
    logToOutLog(`[sidecar] cleanup failed for session ${sessionName}: ${err.message}`);
  }
}

function prunePaneSidecarForLiveSessions(panes) {
  try {
    const liveSessions = new Set((panes || [])
      .map(pane => String(pane.coord || '').split(':')[0])
      .filter(Boolean));
    const livePaneIds = new Set((panes || [])
      .map(pane => pane.paneId)
      .filter(Boolean));
    const current = readPaneSidecar();
    const next = pruneSidecarToLiveSessions(current, liveSessions, livePaneIds);
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      writePaneSidecar(next);
      for (const [id] of Object.entries(current || {})) {
        if (!next[id]) syncMessageAgentPaneEntry(id);
      }
    }
  } catch (err) {
    logToOutLog(`[sidecar] live-session prune failed: ${err.message}`);
  }
}

async function resolveLiveAgentPanes(agent) {
  const panes = await listPanes();
  return resolveAgentPanes({ agent, panes, sidecar: readPaneSidecar() });
}

function createWindow() {
  // Nuke every flavor of stale state on launch so renderer edits show up
  // immediately without manual cache surgery. clearCache() alone only flushes
  // the HTTP cache; V8 code cache + storage (localStorage / sessionStorage /
  // IndexedDB) survive between launches and are the usual culprits when a
  // CSS/JS edit "doesn't take" until reboot.
  const sess = session.defaultSession;
  sess.clearCache();
  // clearCodeCaches has no required filter — empty urls array clears all.
  if (typeof sess.clearCodeCaches === 'function') {
    sess.clearCodeCaches({ urls: [] });
  }
  // Storage flush — preserves cookies (none here, but cheap defense in depth).
  sess.clearStorageData({
    storages: ['localstorage', 'sessionstorage', 'indexdb', 'shadercache']
  }).catch(() => { /* no-op: cleanup is best-effort */ });

  // Permission handler for the F-key voice feature (added 2026-05-03). The
  // renderer calls navigator.mediaDevices.getUserMedia({audio:true}) on the
  // first hold-to-record. Electron's default permission policy denies
  // 'media' / 'microphone' / 'audioCapture' on file:// origins, which would
  // pre-empt the macOS prompt and cause an immediate NotAllowedError. We
  // explicitly allow these for our own renderer; macOS still gates with its
  // own Mic permission prompt for the Electron binary on first request.
  // 'speechRecognition' is the Chromium permission token for
  // webkitSpeechRecognition in Electron 28+.
  sess.setPermissionRequestHandler((webContents, permission, callback) => {
    if (['media', 'microphone', 'audioCapture', 'speechRecognition'].includes(permission)) {
      return callback(true);
    }
    callback(false);
  });
  // Do NOT install setPermissionCheckHandler — it intercepts the implicit
  // permission checks Chromium runs while loading file:// resources (notably
  // <object data="assets/*.svg">), which would silently blank the avatars.
  // The request handler above is sufficient to gate the user-prompt-eligible
  // mic permission.

  mainWindow = new BrowserWindow({
    width: 620,
    height: 240,
    minWidth: 380,
    minHeight: 180,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      logToOutLog('main window did-finish-load — forcing show at cursor display');
      showAtCursorDisplay();
    }, 50);
  });
  mainWindow.once('ready-to-show', () => {
    logToOutLog('main window ready-to-show — forcing show at cursor display');
    showAtCursorDisplay();
  });
  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return;
    logToOutLog('main window startup timer — forcing show at cursor display');
    showAtCursorDisplay();
  }, 1000);
  mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
    logToOutLog(`[renderer ${level}] ${message} @ ${source.split('/').pop()}:${line}`);
  });

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Reload', click: () => { mainWindow.webContents.reloadIgnoringCache(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit(); } }
  ]);
  mainWindow.webContents.on('context-menu', () => {
    // Suppress the default Reload/Quit menu when the right-click was on an
    // agent tile (the renderer pings us via IPC right before opening its
    // radial menu). 250ms grace covers the gap between the DOM contextmenu
    // event and Electron's native context-menu event.
    if (lastTileRightClickAt && Date.now() - lastTileRightClickAt < 250) return;
    contextMenu.popup();
  });

  // AtlasEventBus — wire renderer send so bus.emit() forwards typed events
  // to the renderer via the 'atlas-event' channel. Detach on window close so
  // we don't hold a stale webContents reference after the window is destroyed.
  atlasBus.attach((...args) => {
    try { mainWindow.webContents.send(...args); } catch {}
  });
  mainWindow.on('closed', () => {
    atlasBus.detach();
  });
}

// Set by renderer just before it opens the radial menu so the native
// context-menu handler above can skip its popup. See comment there.
let lastTileRightClickAt = 0;
ipcMain.on('tile-rightclick-suppress', () => { lastTileRightClickAt = Date.now(); });

app.whenReady().then(() => {
  createWindow();
  registerGlobalShortcut();
  registerSignalToggle();
  watchToggleFile();
  startChatWatcher();
  restoreVisiblePetWindows();
});
app.on('window-all-closed', () => { app.quit(); });
// globalShortcut bindings are process-wide and survive renderer crashes —
// Electron explicitly requires unregisterAll() before quit so the OS
// releases the accelerator. Without this, a leftover binding can persist
// until the entire process tree is reaped.
app.on('will-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});

// ---------------------------------------------------------------------------
// Global show/hide toggle
// ---------------------------------------------------------------------------
// Behavior on accelerator fire:
//   - hidden  → show + focus + relocate to the cursor's display so it
//               surfaces wherever Richard is currently looking
//   - shown + focused   → hide
//   - shown + unfocused → focus (no reposition; just bring it forward)
//
// If the OS reports the accelerator as taken (another app holds it), log a
// warning to out.log and continue — Richard can free the binding later
// without us crashing.
function registerGlobalShortcut() {
  const ok = globalShortcut.register(TOGGLE_ACCELERATOR, toggleWindow);
  if (!ok) {
    logToOutLog(`globalShortcut.register("${TOGGLE_ACCELERATOR}") returned false — accelerator may already be claimed by another app. Toggle keybinding inactive this session.`);
    return;
  }
  logToOutLog(`globalShortcut registered: ${TOGGLE_ACCELERATOR}`);
}

function toggleWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) {
    showAtCursorDisplay();
    focusChatInput();
    return;
  }
  if (mainWindow.isFocused()) {
    mainWindow.hide();
    return;
  }
  // Visible but unfocused → focus and drop cursor in chat input.
  mainWindow.focus();
  focusChatInput();
}

// Tell the renderer to focus the chat input. Fires after any shortcut-driven
// summon or focus so the cursor lands ready to type — Richard wants summon →
// type immediately, no extra click. Renderer listens via ipcRenderer.on.
function focusChatInput() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try { mainWindow.webContents.send('focus-chat-input'); }
  catch { /* renderer not ready yet — first show; renderer also listens to
              window focus events as a fallback */ }
}

// ---------------------------------------------------------------------------
// SIGUSR1 signal toggle — fallback for when macOS Accessibility / Input
// Monitoring permission hasn't been granted to the Electron binary, which
// causes globalShortcut event taps to fire registration-OK but never receive
// events. Sending SIGUSR1 to the main Electron process calls toggleWindow()
// directly, bypassing the OS input stack entirely.
//
// Usage (from terminal):  kill -SIGUSR1 $(pgrep -f "Electron.app.*MacOS/Electron")
// Or via launch-remote.sh toggle subcommand.
//
// Note: Electron/Node's SIGUSR1 is normally used by the debugger protocol.
// We hijack it here deliberately. If remote debugging is needed, use SIGUSR2 or
// the --inspect flag instead.
function registerSignalToggle() {
  process.on('SIGUSR1', () => {
    logToOutLog('SIGUSR1 received — toggling window via signal (keyboard shortcut fallback)');
    toggleWindow();
  });
  logToOutLog('SIGUSR1 signal handler registered (toggle fallback)');
}

// ---------------------------------------------------------------------------
// File-watch toggle — second fallback. Watches for a sentinel file at
// remote-app/.toggle. Any write/creation of that file triggers toggleWindow().
// The file is deleted immediately after consumption so the next write triggers
// again. Use-case: scripts / keybinding managers that can write files but
// can't easily send Unix signals.
//
// Usage: touch /path/to/remote-app/.toggle
const TOGGLE_FILE = path.join(__dirname, '.toggle');
function watchToggleFile() {
  // Clean up any leftover sentinel from a previous run.
  try { fs.unlinkSync(TOGGLE_FILE); } catch { /* no-op */ }

  // fs.watch on a non-existent path throws; watch the directory instead and
  // filter for our filename. This also picks up creates, not just writes.
  fs.watch(__dirname, (eventType, filename) => {
    if (filename !== '.toggle') return;
    if (!fs.existsSync(TOGGLE_FILE)) return;
    try { fs.unlinkSync(TOGGLE_FILE); } catch { /* already consumed */ }
    logToOutLog('Toggle file detected — toggling window via file-watch (keyboard shortcut fallback)');
    toggleWindow();
  });
}

// Re-position the window so it surfaces on the display where Richard is
// currently working, then show + focus. The global shortcut should follow the
// cursor/active monitor, not force the HUD back to the laptop/primary display.
function showAtCursorDisplay() {
  try {
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const work = display.workArea;
    const [winW, winH] = mainWindow.getSize();
    const x = Math.round(work.x + (work.width  - winW) / 2);
    const y = Math.round(work.y + work.height * 0.3);
    logToOutLog(`showAtCursorDisplay: cursor=${JSON.stringify(cursor)} workArea=${JSON.stringify(work)} next=${JSON.stringify({ x, y, width: winW, height: winH })}`);
    mainWindow.setBounds({ x, y, width: winW, height: winH });
  } catch (err) {
    // If anything goes sideways with multi-display geometry, just show in place.
    logToOutLog(`showAtCursorDisplay: geometry call failed (${err.message}); showing in current position`);
  }
  mainWindow.show();
  mainWindow.focus();
}

// ---------------------------------------------------------------------------
// Registry IPC — renderer asks for the agent list at boot AND after add/remove
// ---------------------------------------------------------------------------
ipcMain.handle('get-agents', () => loadAgents());
ipcMain.handle('get-harness-models', (_event, runtime) => ({
  models: getModelsForHarness(runtime),
  default: getDefaultModelForHarness(runtime)
}));
ipcMain.handle('app-build-info', () => appBuildInfo());

ipcMain.handle('list-codex-pets', () => {
  try {
    return { ok: true, pets: loadCodexPetRoster() };
  } catch (err) {
    return { ok: false, error: err.message, pets: [] };
  }
});

ipcMain.handle('agent-pet-state', () => {
  try {
    return { ok: true, state: readPetState() };
  } catch (err) {
    return { ok: false, error: err.message, state: emptyPetState() };
  }
});

ipcMain.handle('load-agent-pet-state', () => {
  try {
    return { ok: true, state: readPetState() };
  } catch (err) {
    return { ok: false, error: err.message, state: emptyPetState() };
  }
});

ipcMain.handle('set-agent-pet-selection', (_event, payload = {}) => {
  try {
    const agentId = typeof payload.agentId === 'string' ? payload.agentId.trim() : '';
    const originalAgentId = typeof payload.originalAgentId === 'string' ? payload.originalAgentId.trim() : '';
    const petId = typeof payload.petId === 'string' ? payload.petId.trim() : '';
    if (!/^[a-z0-9_-]+$/i.test(agentId)) throw new Error('agent id required');
    const agent = agentById(agentId);
    if (!agent) throw new Error(`unknown agent: ${agentId}`);
    const pet = petId ? petById(petId) : null;
    if (petId && !pet) throw new Error(`unknown pet: ${petId}`);

    const state = readPetState();
    if (originalAgentId && originalAgentId !== agentId) {
      if (state.selections[originalAgentId] && !state.selections[agentId]) {
        state.selections[agentId] = state.selections[originalAgentId];
      }
      if (state.visible[originalAgentId] && !state.visible[agentId]) {
        state.visible[agentId] = true;
      }
      if (state.bounds[originalAgentId] && !state.bounds[agentId]) {
        state.bounds[agentId] = state.bounds[originalAgentId];
      }
      delete state.selections[originalAgentId];
      delete state.visible[originalAgentId];
      delete state.bounds[originalAgentId];
    }
    if (pet) state.selections[agentId] = pet.id;
    else delete state.selections[agentId];
    const nextState = writePetState(state);

    const win = petWindows.get(agentId);
    if (win && !win.isDestroyed()) {
      showAgentPetWindow(agentId, pet ? pet.id : '');
    } else {
      notifyMainPetState();
    }
    return { ok: true, state: nextState };
  } catch (err) {
    return { ok: false, error: err.message, state: readPetState() };
  }
});

ipcMain.handle('show-agent-pet', (_event, payload = {}) => {
  const agentId = typeof payload.agentId === 'string' ? payload.agentId : '';
  const petId = typeof payload.petId === 'string' ? payload.petId : '';
  return showAgentPetWindow(agentId, petId);
});

ipcMain.handle('hide-agent-pet', (_event, payload = {}) => {
  const agentId = typeof payload.agentId === 'string' ? payload.agentId : '';
  return hideAgentPetWindow(agentId);
});

ipcMain.handle('get-agent-pet-config', (_event, payload = {}) => {
  const agentId = typeof payload.agentId === 'string' ? payload.agentId : '';
  const config = petWindowConfigs.get(agentId);
  if (config) return { ok: true, config };

  const state = readPetState();
  const selectedPetId = state.selections[agentId];
  if (!state.visible[agentId] || !selectedPetId) {
    return { ok: false, error: 'pet window is not active' };
  }
  const agent = agentById(agentId);
  const pet = petById(selectedPetId);
  if (!agent || !pet) return { ok: false, error: 'missing agent or pet' };
  return {
    ok: true,
    config: {
      agent: {
        id: agent.id,
        displayName: agent.displayName || agent.id,
        tmuxTarget: agent.tmuxTarget,
        themeColor: agent.themeColor || '#e07c4c',
        runtime: agent.runtime || '',
        ...petStreamConfigForAgent(agent)
      },
      pet
    }
  };
});

ipcMain.handle('pet-send-message', async (_event, payload = {}) => {
  const agent = agentById(payload.agentId);
  if (!agent) return { ok: false, sent: 0, error: `unknown agent: ${payload.agentId}` };
  return broadcastMessage({
    message: payload.message,
    selectedAgents: [agent],
    isAll: false
  });
});

ipcMain.handle('pet-transcript-tail', async (_event, payload = {}) => {
  try {
    const agent = agentById(payload.agentId);
    if (!agent) return { ok: false, error: `unknown agent: ${payload.agentId}`, messages: [] };
    return transcriptMessagesForAgent(agent, {
      maxMessages: Number.isFinite(Number(payload.maxMessages)) ? Number(payload.maxMessages) : 8
    });
  } catch (err) {
    return { ok: false, error: err.message, messages: [] };
  }
});

ipcMain.handle('pet-resize-window', (_event, payload = {}) => {
  const agentId = typeof payload.agentId === 'string' ? payload.agentId : '';
  const win = petWindows.get(agentId);
  if (!win || win.isDestroyed()) return { ok: false, error: 'pet window not found' };
  const bounds = win.getBounds();
  const { width, height } = clampPetWindowSize(payload.width, payload.height, bounds);
  const nextWidth = Math.round(width);
  const nextHeight = Math.round(height);
  let x = bounds.x;
  let y = bounds.y;
  if (payload.anchorX === 'center') {
    x = Math.round(bounds.x + bounds.width / 2 - nextWidth / 2);
  }
  if (payload.anchorY === 'bottom') {
    y = Math.round(bounds.y + bounds.height - nextHeight);
  }
  const nextBounds = clampPetWindowBoundsToVisibleDisplay({
    x,
    y,
    width: nextWidth,
    height: nextHeight
  });
  win.setBounds(nextBounds);
  persistPetBounds(agentId, win.getBounds());
  sendPetWindowGeometry(agentId, win);
  return { ok: true, bounds: win.getBounds() };
});

ipcMain.on('pet-drag-window', (_event, payload = {}) => {
  const agentId = typeof payload.agentId === 'string' ? payload.agentId : '';
  if (!agentId) return;
  petMoveWindowFromPointer(agentId, payload);
});

ipcMain.on('pet-drag-end', (_event, payload = {}) => {
  const agentId = typeof payload.agentId === 'string' ? payload.agentId : '';
  if (agentId) petPointerDragAgents.delete(agentId);
  const win = petWindows.get(agentId);
  if (!agentId || !win || win.isDestroyed()) return;
  settlePetWindowBounds(agentId, win);
  const settledPayload = petWindowGeometryPayload(win, { moving: false });
  sendToPetWindow(agentId, 'pet-window-moving', settledPayload);
  sendToPetWindow(agentId, 'pet-window-bounds', settledPayload);
});

ipcMain.on('pet-set-mood', (_event, payload = {}) => {
  const agentId = typeof payload.agentId === 'string' ? payload.agentId : '';
  if (!agentId) return;
  sendToPetWindow(agentId, 'pet-mood', {
    mood: typeof payload.mood === 'string' ? payload.mood : 'idle',
    ms: Number.isFinite(payload.ms) ? payload.ms : 0
  });
});

ipcMain.handle('pet-close-window', (_event, payload = {}) => {
  return hideAgentPetWindow(payload.agentId);
});

ipcMain.handle('list-armory-agents', () => fetchArmoryAgents());

// Resize the BrowserWindow to fit the rendered DOM. Renderer measures itself
// then sends {width, height}. Cap to a sensible max so the window can't
// accidentally explode if a CSS bug returns an absurd height; ALSO cap
// downward so the radial menu (which grows the window into the dead space
// below the panel) can't push the bottom edge off-screen behind the dock.
//
// Cap-and-overflow (drag-to-bottom scenario): when the window is already
// flush with the dock, the renderer's requested height exceeds available
// downward room, and we clamp to the workArea bottom — orbs at the bottom
// of the cluster might clip but the panel and the upper orbs stay visible.
// This is the v2.4 mirror of the v2.3 upward cap (which was needed because
// the menu opened above the panel). Multi-monitor: getDisplayNearestPoint
// with the window's top-CENTER picks the right screen even if the window
// straddles a monitor boundary.
//
// v2.4 simplification: removed the resize-window-anchored handler and the
// get-window-headroom query that supported the upward-grow / panel-slide
// ladder. Window now grows downward only (top-left fixed); a single
// cap-to-bottom is all the geometry we need. Removed state:
//   - WORKAREA_TOP_SAFETY (renamed to BOTTOM_SAFETY at top of file)
//   - anchorOriginalBounds, appliedDownExtTotal (anchor-restore state)
ipcMain.on('resize-window', (event, { width, height }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const current = mainWindow.getBounds();
  try {
    const refPoint = { x: current.x + Math.round(current.width / 2), y: current.y + Math.round(current.height / 2) };
    const display = screen.getDisplayNearestPoint(refPoint);
    const bounds = computeWindowBounds(current, { width, height }, display.workArea, {
      safety: WORKAREA_BOTTOM_SAFETY
    });
    mainWindow.setBounds(bounds, false);
  } catch (err) {
    logToOutLog(`resize-window: display geometry failed (${err.message}); resizing without reposition`);
    const bounds = computeWindowBounds(current, { width, height }, null, {
      safety: WORKAREA_BOTTOM_SAFETY
    });
    mainWindow.setBounds({ ...current, width: bounds.width, height: bounds.height }, false);
  }
});

// ---------------------------------------------------------------------------
// Broadcast IPC — hardened against shell injection
// ---------------------------------------------------------------------------
// Old code interpolated the user's message + the agent's tmuxTarget directly
// into a string passed to exec(). A `"` in the message broke quoting; a `$X`
// expanded as a shell var; a backtick ran a subcommand. Pane titles with
// regex metachars also broke `grep`. Both are gone.
//
// New flow:
//   1. Resolve target panes by listing all panes once (execFile, no shell)
//      and matching pane title in JS — case-insensitive substring against
//      the agent's tmuxTarget. The pane title may have a leading spinner
//      glyph from claude (e.g. "⠐ GEKKO"), so substring beats anchored regex.
//   2. For each match, run `tmux send-keys -t <coord> <message> C-m` via
//      execFile([...]) — argv array, no shell. The message is one argv entry
//      so quoting / metachars are safe.
// Local whisper transcription. Web SpeechRecognition fails with `network`
// in Electron (bundled Chromium has no Google speech-to-text API key, unlike
// regular Chrome). We capture audio in the renderer via MediaRecorder, send
// the webm blob here as base64, write it to /tmp, shell out to the local
// `whisper` CLI, and return the transcript text. Same architecture as
// ~/ai_projects/voicetype/.
const WHISPER_BIN = '/Users/richardadair/Library/Python/3.9/bin/whisper';
const WHISPER_MODEL = 'base';

ipcMain.handle('transcribe-voice', async (_event, audioBufferB64) => {
  if (!audioBufferB64) return '';
  const tmpDir = os.tmpdir();
  const stamp = Date.now();
  const stem = `agentremote-voice-${stamp}`;
  const webmPath = path.join(tmpDir, `${stem}.webm`);
  const txtPath = path.join(tmpDir, `${stem}.txt`);
  const voiceStartedAt = new Date().toISOString();
  atlasBus.emit('voice_recording_started', { language: 'en' }, { source: 'stt' });
  try {
    fs.writeFileSync(webmPath, Buffer.from(audioBufferB64, 'base64'));
  } catch (err) {
    logToOutLog(`[voice] write audio failed: ${err.message}`);
    return '';
  }
  return new Promise((resolve) => {
    const args = [webmPath, '--model', WHISPER_MODEL, '--output_format', 'txt', '--output_dir', tmpDir, '--language', 'en', '--fp16', 'False'];
    execFile(WHISPER_BIN, args, { timeout: 60_000 }, (err) => {
      let text = '';
      if (err) {
        logToOutLog(`[voice] whisper failed: ${err.message}`);
      } else {
        try { text = fs.readFileSync(txtPath, 'utf8'); } catch (e) {
          logToOutLog(`[voice] whisper output read failed: ${e.message}`);
        }
      }
      try { fs.unlinkSync(webmPath); } catch {}
      try { fs.unlinkSync(txtPath); } catch {}
      const trimmed = (text || '').trim();
      const voiceEndedAt = new Date().toISOString();
      if (trimmed) {
        atlasBus.emit('voice_transcript_ready', {
          text: trimmed,
          startedAt: voiceStartedAt,
          endedAt: voiceEndedAt,
          partial: false
        }, { source: 'stt' });
      }
      resolve(trimmed);
    });
  });
});

async function resolveBroadcastTargets({ selectedAgents, isAll }) {
  let targets = [];
  targets = await listPanes();

  // Read the sidecar written by Swarmy's AgentRemote runtime at pane creation time.
  // Keys are agents.json ids; values carry the stable pane_id (%N).
  const sidecar = readPaneSidecar();

  // "All" means every selected registry agent, not every tmux pane on the
  // machine. Legacy callers may send isAll with an empty selectedAgents array;
  // in that case fall back to the registry roster.
  const agentsToResolve = (selectedAgents && selectedAgents.length)
    ? selectedAgents
    : (isAll ? loadAgents() : []);

  let sendTo = [];
  const unresolved = [];
  for (const agent of agentsToResolve) {
    const matches = resolveAgentPanes({ agent, panes: targets, sidecar });
    if (matches.length > 0) {
      matches.forEach(m => sendTo.push(m.coord));
    } else {
      unresolved.push(agent.id);
      console.warn(`[broadcast] no pane matches agent=${agent.id} (sidecar + title miss)`);
    }
  }

  return {
    coords: [...new Set(sendTo)],
    unresolved,
    livePaneCount: targets.length,
    requestedAgentCount: agentsToResolve.length
  };
}

function sendKeysToCoord(coord, message) {
  // First type the literal message, then press Return as separate keystrokes.
  // The stagger matters for full-screen agent TUIs: tmux can accept the literal
  // text before the app has processed it, causing one submit key to land early
  // and leave the text sitting in the input box. A second Return is harmless
  // after a successful submit, but recovers the common "typed but not sent"
  // state Richard sees in AgentRemote.
  return new Promise((resolve, reject) => {
    execFile('tmux', ['send-keys', '-t', coord, '-l', message], (err, _o, ser) => {
      if (err) return reject(new Error(ser || err.message));
      setTimeout(() => {
        execFile('tmux', ['send-keys', '-t', coord, 'C-m'], (err2, _o2, ser2) => {
          if (err2) return reject(new Error(ser2 || err2.message));
          setTimeout(() => {
            execFile('tmux', ['send-keys', '-t', coord, 'Enter'], (err3, _o3, ser3) => {
              if (err3) return reject(new Error(ser3 || err3.message));
              resolve(coord);
            });
          }, 140);
        });
      }, 180);
    });
  });
}

async function broadcastMessage({ message, selectedAgents, isAll } = {}) {
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) return { ok: false, sent: 0, error: 'message required' };
  if (!isAll && (!selectedAgents || selectedAgents.length === 0)) {
    return { ok: false, sent: 0, error: 'no selected agents' };
  }

  let resolved;
  try {
    resolved = await resolveBroadcastTargets({ selectedAgents, isAll });
  } catch (err) {
    console.error(`[broadcast] tmux list-panes failed: ${err.message}`);
    return { ok: false, sent: 0, error: err.message || 'tmux list-panes failed' };
  }

  if (resolved.coords.length === 0) {
    atlasBus.emit('message_failed', {
      text,
      targets: (selectedAgents || []).map(a => a.id || String(a)),
      error: 'no running panes matched the selected agents'
    });
    return {
      ok: false,
      sent: 0,
      attempted: 0,
      unresolved: resolved.unresolved,
      livePaneCount: resolved.livePaneCount,
      requestedAgentCount: resolved.requestedAgentCount,
      error: 'no running panes matched the selected agents'
    };
  }

  const results = await Promise.allSettled(resolved.coords.map(coord => sendKeysToCoord(coord, text)));
  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failures = results
    .filter(r => r.status === 'rejected')
    .map(r => r.reason && r.reason.message ? r.reason.message : String(r.reason));

  failures.forEach(err => console.error(`[broadcast] send failed: ${err}`));

  if (sent > 0) {
    atlasBus.emit('message_sent', {
      text,
      targets: (selectedAgents || []).map(a => a.id || String(a)),
      coords: resolved.coords,
      sentCount: sent
    });
  } else {
    atlasBus.emit('message_failed', {
      text,
      targets: (selectedAgents || []).map(a => a.id || String(a)),
      error: failures[0] || 'send failed'
    });
  }

  return {
    ok: sent > 0,
    sent,
    attempted: resolved.coords.length,
    unresolved: resolved.unresolved,
    livePaneCount: resolved.livePaneCount,
    requestedAgentCount: resolved.requestedAgentCount,
    failures,
    error: sent > 0 ? '' : (failures[0] || 'send failed')
  };
}

ipcMain.handle('broadcast-message', async (_event, payload) => broadcastMessage(payload));

ipcMain.on('broadcast-message', async (event, payload) => {
  const result = await broadcastMessage(payload);
  try { event.reply('broadcast-message-result', result); } catch { /* legacy fire-and-forget */ }
});

ipcMain.handle('save-pasted-image', async (_event, payload = {}) => {
  const mimeType = String(payload.mimeType || 'image/png').toLowerCase();
  const encoded = String(payload.base64 || '');
  if (!encoded) return { ok: false, error: 'image clipboard data missing' };

  const bytes = Buffer.from(encoded, 'base64');
  return savePastedImageBuffer(bytes, mimeType);
});

ipcMain.handle('save-native-clipboard-image', async () => {
  const image = clipboard.readImage();
  if (!image || image.isEmpty()) {
    return { ok: false, error: 'clipboard has no image' };
  }
  return savePastedImageBuffer(image.toPNG(), 'image/png');
});

ipcMain.handle('read-clipboard-text', async () => ({
  ok: true,
  text: clipboard.readText() || ''
}));

// listPanes() — promise wrapper around `tmux list-panes -a -F '...'`. Returns
// [{ coord, title }, ...]. Uses a tab separator inside the format string so
// pane titles containing spaces don't break the parse.
function listPanes() {
  return new Promise((resolve, reject) => {
    // pane_id is the %23-style stable id; coord is session:window.pane (mutable
    // when panes shift). Both are needed: coord for tmux subcommands keyed by
    // position, pane_id for matching against $TMUX_PANE-keyed PIDFILEs that
    // launch-agent.sh writes to /tmp.
    const fmt = '#{session_name}:#{window_index}.#{pane_index}\t#{pane_id}\t#{pane_title}';
    execFile('tmux', ['list-panes', '-a', '-F', fmt], (err, stdout, stderr) => {
      if (err) {
        // No tmux server running is a benign "no targets" — return empty.
        if (/no server running/i.test(stderr || '')) return resolve([]);
        return reject(new Error(stderr || err.message));
      }
      const out = stdout.split('\n').filter(Boolean).map(line => {
        const parts = line.split('\t');
        if (parts.length < 3) return null;
        return { coord: parts[0], paneId: parts[1], title: parts[2] };
      }).filter(Boolean);
      resolve(out);
    });
  });
}

function safeTmuxWindowLabel(agent, fallbackId) {
  const raw = String((agent && (agent.displayName || agent.id)) || fallbackId || 'agent').trim();
  const cleaned = raw.replace(/[^a-z0-9_.:@+ -]+/gi, '').replace(/\s+/g, ' ').trim();
  return (cleaned || String(fallbackId || 'agent')).slice(0, 48);
}

async function labelTmuxPaneWindow(match, label) {
  if (!match || !label) return;
  const windowTarget = String(match.coord || '').split('.')[0];
  if (/^[a-z0-9_:.-]+$/i.test(windowTarget)) {
    await new Promise(resolve => {
      execFile('tmux', ['rename-window', '-t', windowTarget, label], err => {
        if (err) logToOutLog(`[attach] rename-window failed for ${windowTarget}: ${err.message}`);
        resolve();
      });
    });
  }
  if (match.paneId && /^%[0-9]+$/.test(match.paneId)) {
    await new Promise(resolve => {
      execFile('tmux', ['select-pane', '-t', match.paneId, '-T', label], err => {
        if (err) logToOutLog(`[attach] pane title failed for ${match.paneId}: ${err.message}`);
        resolve();
      });
    });
  }
}

function updatePaneSidecarEntry(agentId, match) {
  if (!agentId || !match || !match.paneId || !match.coord) return;
  const parsed = /^([^:]+):([0-9]+)\.([0-9]+)$/.exec(String(match.coord || ''));
  if (!parsed) return;
  try {
    const sidecar = readPaneSidecar();
    sidecar[agentId] = {
      ...(sidecar[agentId] || {}),
      pane_id: match.paneId,
      session: parsed[1],
      window: Number(parsed[2]),
      pane: Number(parsed[3]),
      updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    };
    writePaneSidecar(sidecar);
  } catch (err) {
    logToOutLog(`[sidecar] update failed for ${agentId}: ${err.message}`);
  }
}

// pane-status — return [{ id, running, attached }] for each registry agent.
// Used by the renderer's 3s status-dot poller. Substring match against pane
// titles, same rule as broadcast resolution.
//
// `attached` is true when the agent's tmux session has at least one client
// (someone is looking at it through a tmux client / iTerm tab). When running
// is true but attached is false, the renderer renders a "headless" yellow
// dot — the agent process is alive but no terminal is currently watching it.
//
// Cost: one list-panes call + one list-clients per distinct session. We
// dedupe sessions across agents (5 chq-pane agents → 1 list-clients call).
ipcMain.handle('pane-status', async () => {
  const agents = loadAgents();
  let panes = [];
  try { panes = await listPanes(); } catch {
    return agents.map(a => ({ id: a.id, running: false, attached: false }));
  }
  prunePaneSidecarForLiveSessions(panes);

  const sidecar = readPaneSidecar();

  // Match each agent → its pane (if any), then derive the session.
  // Strategy 1: stable pane_id via sidecar. Strategy 2: pane-title fallback.
  const matches = agents.map(a => {
    const pane = resolveAgentPanes({ agent: a, panes, sidecar })[0];
    if (!pane) return { id: a.id, running: false, session: null };
    const session = pane.coord.split(':')[0];
    return { id: a.id, running: true, session };
  });

  // Dedupe sessions for the list-clients pass.
  const sessions = [...new Set(matches.map(m => m.session).filter(Boolean))];
  const attachedBySession = {};
  await Promise.all(sessions.map(s => new Promise(resolve => {
    if (!/^[a-z0-9_-]+$/i.test(s)) { attachedBySession[s] = false; return resolve(); }
    execFile('tmux', ['list-clients', '-t', s, '-F', '#{client_name}'], (err, stdout) => {
      if (err) { attachedBySession[s] = false; return resolve(); }
      attachedBySession[s] = stdout.split('\n').some(l => l.trim().length > 0);
      resolve();
    });
  })));

  const statusResult = matches.map(m => ({
    id: m.id,
    running: m.running,
    attached: m.session ? !!attachedBySession[m.session] : false
  }));

  // Emit agent_running for each pane that is currently live.
  for (const s of statusResult) {
    if (s.running) {
      atlasBus.emit('agent_running', { agentId: s.id }, { agentId: s.id });
    }
  }

  return statusResult;
});

function execFileP(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

function swarmyRuntimeArgs(...args) {
  return [
    SWARMY_RUNTIME_SCRIPT,
    '--session',
    RUNTIME_SESSION,
    '--registry',
    REGISTRY_PATH,
    '--sidecar',
    SIDECAR_PATH,
    ...args
  ];
}

function shellQuoteArg(value) {
  return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
}

function shellQuoteCommand(args) {
  return args.map(shellQuoteArg).join(' ');
}

function swarmyRuntimeAttachCommand() {
  return shellQuoteCommand(['python3', ...swarmyRuntimeArgs('attach')]);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function listTmuxClients(sessionName) {
  try {
    const { stdout } = await execFileP('tmux', ['list-clients', '-t', sessionName, '-F', '#{client_name}\t#{client_control_mode}']);
    return parseTmuxClientLines(stdout);
  } catch {
    return [];
  }
}

async function listTmuxSessionGroups() {
  try {
    const { stdout } = await execFileP('tmux', ['list-sessions', '-F', '#{session_name}\t#{session_group}']);
    return parseTmuxSessionGroupLines(stdout);
  } catch {
    return [];
  }
}

async function viewerSafetyState(layout, sessionName = RUNTIME_SESSION) {
  const [clients, sessions] = await Promise.all([
    listTmuxClients(sessionName),
    listTmuxSessionGroups()
  ]);
  const error = viewerSafetyError({ sessionName, layout, sessions, clients });
  return { error, clients, sessions };
}

async function waitForDeployViewer(layout, attempts = 10) {
  for (let i = 0; i < attempts; i += 1) {
    const clients = await listTmuxClients(RUNTIME_SESSION);
    if (hasRequiredTmuxClient(layout, clients)) return clients;
    await delay(250);
  }
  return listTmuxClients(RUNTIME_SESSION);
}

async function spawnAgents(payload) {
  // Back-compat: payload may be a bare array of agent ids (legacy renderer)
  // or { agents, layout } (post-v2.5 settings popover with layout checkboxes).
  const agents = Array.isArray(payload) ? payload : (payload && payload.agents);
  const layoutRaw = (payload && payload.layout) || '';
  const safeAgents = (agents || []).filter(a => /^[a-z0-9_-]+$/i.test(a));
  if (safeAgents.length === 0) return { ok: false, error: 'no deployable agents selected' };
  const runtimeOverrides = {};
  const rawRuntimeOverrides = payload && typeof payload.runtimeOverrides === 'object'
    ? payload.runtimeOverrides
    : {};
  for (const agentId of safeAgents) {
    const rawSpec = rawRuntimeOverrides[agentId];
    const spec = typeof rawSpec === 'string'
      ? { runtime: rawSpec }
      : (rawSpec && typeof rawSpec === 'object' ? rawSpec : null);
    if (!spec) continue;
    const runtime = normalizeRuntime(spec.runtime);
    runtimeOverrides[agentId] = { runtime };
    for (const key of ['model', 'reasoning_effort', 'provider', 'sandbox', 'approval_policy']) {
      if (spec[key] === undefined || spec[key] === null) continue;
      const value = String(spec[key]).trim();
      if (value && !/[\r\n]/.test(value)) runtimeOverrides[agentId][key] = value;
    }
  }

  // Whitelist layout — passed through to Swarmy's AgentRemote runtime adapter.
  // Fallback is teams, because the operator default is grouped iTerm
  // control-mode team windows rather than one crowded split-pane tmux window.
  const layout = normalizeSpawnLayout(layoutRaw);

  // Emit agent_spawn_requested for each agent before launch.
  for (const agentId of safeAgents) {
    atlasBus.emit('agent_spawn_requested', { role: agentId, mode: layout }, { agentId });
  }

  let stdout = '';
  try {
    const runtimeArgs = ['add', '--layout', layout];
    if (Object.keys(runtimeOverrides).length > 0) {
      runtimeArgs.push('--runtime-overrides-json', JSON.stringify(runtimeOverrides));
    }
    runtimeArgs.push(...safeAgents);
    const result = await execFileP('python3', swarmyRuntimeArgs(...runtimeArgs), {
      env: { ...process.env, TMUX_AUTO_ATTACH: '0', CHQ_LAYOUT: layout }
    });
    stdout = result.stdout || '';
  } catch (err) {
    const msg = err.stderr || err.message || 'swarmy runtime add failed';
    console.error(`[spawn] swarmy runtime add failed: ${msg}`);
    logToOutLog(`[spawn] swarmy runtime add failed: ${msg}`);
    return { ok: false, error: msg.trim(), agents: safeAgents, layout };
  }
  console.log(`[spawn] ${stdout.trim()}`);

  // Bug Richard reported 2026-05-03: clicking Deploy multiple times piled
  // every batch into a fresh iTerm tab. We now reuse an existing viewer only
  // when tmux proves it is attached in the right mode. For teams/ittab, plain
  // tmux attach is not enough; the operator path requires control mode so
  // iTerm materializes the tmux windows.
  let { error: viewerError, clients, sessions } = await viewerSafetyState(layout, RUNTIME_SESSION);
  if (viewerError) {
    logToOutLog(`[spawn] ${viewerError}`);
    return { ok: false, error: viewerError, agents: safeAgents, layout, clients, sessions, needsViewerCleanup: true, stdout };
  }
  if (hasRequiredTmuxClient(layout, clients)) {
    execFile('osascript', ['-e', 'tell application "iTerm" to activate'], () => {});
    return { ok: true, agents: safeAgents, layout, reusedViewer: true, clients, stdout };
  }

  // No required viewer attached — open a fresh iTerm tab/window, then write
  // the attach command into the newly created session.
  const apple = buildITermAttachScript(swarmyRuntimeAttachCommand());
  try {
    await execFileP('osascript', ['-e', apple]);
  } catch (err) {
    const msg = err.stderr || err.message || 'osascript attach failed';
    console.error(`[spawn] osascript attach failed: ${msg}`);
    logToOutLog(`[spawn] osascript attach failed: ${msg}`);
    return { ok: false, error: msg.trim(), agents: safeAgents, layout, stdout };
  }

  clients = await waitForDeployViewer(layout);
  if (!hasRequiredTmuxClient(layout, clients)) {
    const error = ['teams', 'ittab'].includes(layout)
      ? 'deploy created chq panes but no iTerm control-mode client attached'
      : 'deploy created chq panes but no tmux client attached';
    logToOutLog(`[spawn] ${error}; clients=${JSON.stringify(clients)}`);
    return { ok: false, error, agents: safeAgents, layout, clients, stdout };
  }

  return { ok: true, agents: safeAgents, layout, reusedViewer: false, clients, stdout };
}

// ---------------------------------------------------------------------------
// Spawn IPC — hardened against shell injection
// ---------------------------------------------------------------------------
// Use Swarmy's runtime `add` command — it creates the session
// if missing OR appends panes to an existing one. The old `start` path bailed
// with "Session already exists" when chq was already up, which was the root
// cause of the "Deploy doesn't work after first deploy" bug — clicking an
// agent button once chq existed was a silent no-op.
ipcMain.handle('spawn-agents', async (_event, payload) => spawnAgents(payload));
ipcMain.on('spawn-agents', async (event, payload) => {
  const result = await spawnAgents(payload);
  try { event.reply('spawn-agents-result', result); } catch { /* legacy fire-and-forget */ }
});

// ---------------------------------------------------------------------------
// Add-agent IPC — append a registry entry + copy an optional avatar image into assets/
// ---------------------------------------------------------------------------
// Inputs come from the in-app Add Agent form. The renderer has already done
// shape validation (id present, no conflicts) but we re-validate here because
// IPC is a trust boundary.
//
// Returns { ok: true } or { ok: false, error }.
ipcMain.handle('add-agent', async (event, payload) => {
  try {
    const id = String(payload.id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(id)) throw new Error('id must be lowercase alphanumeric / underscore / hyphen');
    const displayName = String(payload.displayName || '').trim();
    if (!displayName) throw new Error('display_name required');
    const cwd = String(payload.cwd || '').trim();
    if (!cwd) throw new Error('cwd required');
    const color = String(payload.color || 'cyan').trim();
    const themeColor = payload.themeColor && /^#[0-9a-fA-F]{3,8}$/.test(String(payload.themeColor))
      ? String(payload.themeColor).trim()
      : null;
    const startupSlash = (payload.startupSlash === undefined || payload.startupSlash === null)
      ? DEFAULT_LEAD_STARTUP_SLASH
      : String(payload.startupSlash).trim();
    const autoRestart = payload.autoRestart === false ? false : true;
    const rawRuntime = String(payload.runtime || 'codex').trim().toLowerCase();
    const runtime = normalizeRuntime(rawRuntime);
    if (rawRuntime && !HARNESS_RUNTIME_IDS.includes(rawRuntime)) {
      throw new Error('runtime must be codex, claude, hermes, or openclaw');
    }
    const explicitModel = payload.model ? String(payload.model).trim() : '';
    const avatarSrc = payload.avatarSrc ? String(payload.avatarSrc) : null;

    // Guard against id collisions.
    const existing = loadAgents();
    if (existing.some(a => a.id === id)) throw new Error(`agent id "${id}" already exists`);

    // Copy avatar if provided. If not, the renderer falls back to the selected
    // harness mascot.
    let avatarFilename = null;
    if (avatarSrc && fs.existsSync(avatarSrc)) {
      const ext = avatarExtension(avatarSrc);
      if (!ext) throw new Error('avatar must be svg, gif, png, jpg, jpeg, or webp');
      avatarFilename = `${id}.${ext}`;
      fs.copyFileSync(avatarSrc, path.join(ASSETS_DIR, avatarFilename));
    }

    // Append to agents.json atomically.
    writeRegistry(data => {
      const entry = {
        id,
        display_name: displayName,
        runtime,
        cwd,
        color,
        startup_slash: startupSlash
      };
      // Explicit model from the form (now that the add-agent UI exposes a
      // per-harness dropdown) takes precedence over applyRuntimePolicy's
      // defaults; the policy only patches missing/wrong-runtime values.
      if (explicitModel) entry.model = explicitModel;
      applyRuntimePolicy(entry, runtime);
      if (themeColor) entry.theme_color = themeColor;
      if (!autoRestart) entry.auto_restart = false;
      if (avatarFilename) entry.avatar = avatarFilename;
      data.agents.push(entry);
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Reorder-agents IPC — receives an array of agent ids in the user's desired
// dock order. Reshuffles `data.agents` in place to match. Validates that the
// provided id list is a permutation of the current registry (no adds, no drops,
// no duplicates) — drag-and-drop should never mutate membership, only order.
//
// Renderer flow: user drags a tile, drops it. We compute the new id array,
// invoke this IPC, and on success re-render the dock from the freshly-read
// registry so the persisted order is what the user sees.
ipcMain.handle('reorder-agents', async (event, ids) => {
  try {
    if (!Array.isArray(ids)) throw new Error('ids must be an array');
    const cleanIds = ids.map(s => String(s || '').trim().toLowerCase());
    if (cleanIds.some(id => !/^[a-z0-9_-]+$/.test(id))) throw new Error('invalid id in list');
    if (new Set(cleanIds).size !== cleanIds.length) throw new Error('duplicate ids in list');

    writeRegistry(data => {
      const current = (data.agents || []).map(a => a.id);
      // Membership check: provided list must contain exactly the same ids as
      // the current registry. Any drop/add through this IPC would silently
      // delete an entry, which is the wrong tool for the job (use add-agent /
      // remove-agent for membership changes).
      const a = [...cleanIds].sort();
      const b = [...current].sort();
      if (a.length !== b.length || a.some((id, i) => id !== b[i])) {
        throw new Error('id list is not a permutation of the registry');
      }
      // Reorder in place: build a lookup, then map the requested order.
      const byId = Object.fromEntries(data.agents.map(entry => [entry.id, entry]));
      data.agents = cleanIds.map(id => byId[id]);
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Remove-agent IPC — strip from agents.json. Avatar assets stay in remote-app/assets/
// so re-adding an agent finds the avatar still there (an earlier auto-archive
// to deprecated/assets/ silently vanished avatars on re-add). Asset cleanup is
// a separate concern — handle it manually or via a future "prune unused" cmd.
//
// We also don't touch the agent's actual project dir or its running tmux pane.
// "Remove" = registry-delete only. To kill the pane, use the restart-agent IPC.
ipcMain.handle('remove-agent', async (event, id) => {
  try {
    const safeId = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid id');

    writeRegistry(data => {
      const before = data.agents.length;
      data.agents = data.agents.filter(a => a.id !== safeId);
      if (data.agents.length === before) throw new Error(`agent id "${safeId}" not found`);
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Hide-agent IPC — sets hidden:true on the registry entry. The agent stays in
// agents.json (so launch scripts can still find it) but vanishes from the dock
// bar. Reversible via unhide-agent. This is the "Remove from bar" radial action.
ipcMain.handle('hide-agent', async (event, id) => {
  try {
    const safeId = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid id');
    writeRegistry(data => {
      const entry = (data.agents || []).find(a => a.id === safeId);
      if (!entry) throw new Error(`agent id "${safeId}" not found`);
      entry.hidden = true;
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Unhide-agent IPC — removes the hidden flag from a registry entry, making the
// tile reappear in the dock bar. Invoked from the "Show hidden" affordance.
ipcMain.handle('unhide-agent', async (event, id) => {
  try {
    const safeId = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid id');
    writeRegistry(data => {
      const entry = (data.agents || []).find(a => a.id === safeId);
      if (!entry) throw new Error(`agent id "${safeId}" not found`);
      delete entry.hidden;
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Restart-agent IPC — non-destructive. Sends Ctrl-C to the agent's tmux pane;
// Swarmy's runtime loop respawns the configured runtime in 3s. We route through
// the resolved pane id because pane titles can change after provider startup.
//
// Returns { ok: true, message } if a pane was found and SIGINT was sent.
// { ok: false, error } if the agent isn't running anywhere.
ipcMain.handle('restart-agent', async (event, id) => {
  try {
    const safeId = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid id');

    const agents = loadAgents();
    const agent = agents.find(a => a.id === safeId);
    if (!agent) throw new Error(`agent "${safeId}" not in registry`);

    const match = (await resolveLiveAgentPanes(agent))[0];
    if (!match) throw new Error(`${agent.displayName || safeId} isn't running in ${RUNTIME_SESSION} — Deploy it first`);

    await new Promise((resolve, reject) => {
      execFile('tmux', ['send-keys', '-t', match.coord, 'C-c'], (err, _o, ser) => {
        if (err) return reject(new Error(ser || err.message));
        resolve();
      });
    });
    return { ok: true, message: `sent SIGINT to ${match.coord} — restart loop will respawn in ~3s` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Update-agent IPC — partial PATCH of a registry entry. The right-click menu
// uses this to toggle auto_restart and edit display_name / color / startup_slash.
// Whitelist the writable fields so a renderer bug can't clobber load-bearing
// keys like id or cwd. Booleans are coerced; strings are trimmed.
const UPDATABLE_FIELDS = {
  auto_restart:  v => Boolean(v),
  display_name:  v => {
    const name = String(v || '').trim();
    if (!name) throw new Error('display_name required');
    return name;
  },
  color:         v => String(v || '').trim().toLowerCase(),
  theme_color:   v => (/^#[0-9a-fA-F]{3,8}$/.test(String(v || '').trim()) ? String(v).trim() : null),
  runtime:       v => {
    const runtime = String(v || '').trim().toLowerCase();
    return HARNESS_RUNTIME_IDS.includes(runtime) ? runtime : null;
  },
  model:         v => String(v || '').trim(),
  reasoning_effort: v => String(v || '').trim(),
  sandbox:       v => String(v || '').trim(),
  approval_policy: v => String(v || '').trim(),
  rename_to:     v => String(v || '').trim(),
  startup_slash: v => String(v || '').trim()
};

function applyRuntimePolicy(entry, runtime) {
  if (runtime === 'claude') {
    entry.allow_claude_runtime = true;
    delete entry.profile_preset;
    delete entry.sandbox;
    delete entry.approval_policy;
    if (!entry.model || entry.model.startsWith('gpt-') || entry.model.includes('codex')) {
      entry.model = getDefaultModelForHarness('claude') || 'claude-opus-4-7[1m]';
    }
    if (!entry.reasoning_effort || entry.reasoning_effort === 'high' || entry.reasoning_effort === 'medium' || entry.reasoning_effort === 'low') {
      entry.reasoning_effort = 'max';
    }
    return;
  }

  delete entry.allow_claude_runtime;
  if (runtime === 'codex') {
    if (!entry.model) entry.model = getDefaultModelForHarness('codex') || 'gpt-5.5';
    if (!entry.reasoning_effort) entry.reasoning_effort = 'high';
    if (!entry.sandbox) entry.sandbox = 'danger-full-access';
    if (!entry.approval_policy) entry.approval_policy = 'never';
  }
}

ipcMain.handle('update-agent-form', async (event, payload = {}) => {
  try {
    const originalId = String(payload.originalId || payload.id || '').trim().toLowerCase();
    const safeId = String(payload.id || '').trim().toLowerCase();
    const hasExplicitRuntime = Object.prototype.hasOwnProperty.call(payload, 'runtime');
    if (!/^[a-z0-9_-]+$/.test(originalId)) throw new Error('invalid original id');
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid id');
    const displayName = String(payload.displayName || '').trim();
    if (!displayName) throw new Error('display_name required');
    const cwd = String(payload.cwd || '').trim();
    if (!cwd) throw new Error('cwd required');
    let runtime = null;
    if (hasExplicitRuntime) {
      const rawRuntime = String(payload.runtime || '').trim().toLowerCase();
      runtime = normalizeRuntime(rawRuntime);
      if (rawRuntime && !HARNESS_RUNTIME_IDS.includes(rawRuntime)) {
        throw new Error('runtime must be codex, claude, hermes, or openclaw');
      }
    }
    const themeColor = payload.themeColor && /^#[0-9a-fA-F]{3,8}$/.test(String(payload.themeColor))
      ? String(payload.themeColor).trim()
      : null;
    const startupSlash = (payload.startupSlash === undefined || payload.startupSlash === null)
      ? ''
      : String(payload.startupSlash).trim();
    const autoRestart = payload.autoRestart === false ? false : true;
    const explicitModel = payload.model ? String(payload.model).trim() : '';
    const avatarSrc = payload.avatarSrc ? String(payload.avatarSrc) : null;
    let avatarFilename = null;
    if (avatarSrc && fs.existsSync(avatarSrc)) {
      const ext = avatarExtension(avatarSrc);
      if (!ext) throw new Error('avatar must be svg, gif, png, jpg, jpeg, or webp');
      avatarFilename = `${safeId}.${ext}`;
      fs.copyFileSync(avatarSrc, path.join(ASSETS_DIR, avatarFilename));
    }

    if (safeId !== originalId) {
      const existingAgents = loadAgents();
      if (existingAgents.some(a => a.id === safeId)) throw new Error(`agent id "${safeId}" already exists`);
      const originalAgent = existingAgents.find(a => a.id === originalId);
      if (!originalAgent) throw new Error(`agent "${originalId}" not in registry`);
      const liveMatches = await resolveLiveAgentPanes(originalAgent);
      if (liveMatches.length > 0) throw new Error('stop this agent before changing its id');
    }

    let updatedEntry = null;
    writeRegistry(data => {
      const entry = (data.agents || []).find(a => a.id === originalId);
      if (!entry) throw new Error(`agent "${originalId}" not in registry`);
      const oldId = entry.id;
      if (safeId !== oldId && !avatarFilename && !entry.avatar) {
        const oldBundledAvatar = bundledAvatarForId(oldId);
        if (oldBundledAvatar) entry.avatar = oldBundledAvatar;
      }
      entry.id = safeId;
      entry.display_name = displayName;
      entry.cwd = cwd;
      // Set explicit model BEFORE applyRuntimePolicy so the policy preserves it.
      if (explicitModel) entry.model = explicitModel;
      if (hasExplicitRuntime && runtime) {
        entry.runtime = runtime;
        applyRuntimePolicy(entry, runtime);
      }
      entry.startup_slash = startupSlash;
      if (themeColor) entry.theme_color = themeColor;
      else delete entry.theme_color;
      if (autoRestart) delete entry.auto_restart;
      else entry.auto_restart = false;
      if (avatarFilename) entry.avatar = avatarFilename;
      updatedEntry = entry;
    });
    return { ok: true, entry: updatedEntry };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('update-agent', async (event, { id, patch } = {}) => {
  try {
    const safeId = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid id');
    if (!patch || typeof patch !== 'object') throw new Error('patch required');

    // Filter the patch down to whitelisted fields with coerced values.
    const cleanPatch = {};
    for (const [k, v] of Object.entries(patch)) {
      const coerce = UPDATABLE_FIELDS[k];
      if (!coerce) continue;
      const coerced = coerce(v);
      if (k === 'runtime' && !coerced) throw new Error('runtime must be codex, claude, hermes, or openclaw');
      cleanPatch[k] = coerced;
    }
    if (Object.keys(cleanPatch).length === 0) throw new Error('no updatable fields in patch');

    let updatedEntry = null;
    writeRegistry(data => {
      const entry = (data.agents || []).find(a => a.id === safeId);
      if (!entry) throw new Error(`agent "${safeId}" not in registry`);
      Object.assign(entry, cleanPatch);
      if (cleanPatch.runtime) applyRuntimePolicy(entry, cleanPatch.runtime);
      updatedEntry = entry;
    });
    return { ok: true, entry: updatedEntry };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Avatar IPC for the settings popover (existing-agent edit). Add-agent and
// rename go through update-agent-form which has its own copy logic; this
// handler is the per-agent partial-update path that mirrors update-agent for
// the file-copy semantics avatars need.
ipcMain.handle('set-agent-avatar', async (_event, payload = {}) => {
  try {
    const safeId = String(payload.id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid agent id');
    const avatarSrc = payload.avatarSrc ? String(payload.avatarSrc) : '';
    if (!avatarSrc) throw new Error('avatarSrc required');
    if (!fs.existsSync(avatarSrc)) throw new Error(`avatar source missing: ${avatarSrc}`);
    const ext = avatarExtension(avatarSrc);
    if (!ext) throw new Error('avatar must be svg, gif, png, jpg, jpeg, or webp');
    const avatarFilename = `${safeId}.${ext}`;
    fs.copyFileSync(avatarSrc, path.join(ASSETS_DIR, avatarFilename));
    let updatedEntry = null;
    writeRegistry(data => {
      const entry = (data.agents || []).find(a => a.id === safeId);
      if (!entry) throw new Error(`agent "${safeId}" not in registry`);
      entry.avatar = avatarFilename;
      updatedEntry = entry;
    });
    return { ok: true, entry: updatedEntry };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// File pickers for the Add Agent form.
async function pickAvatarFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pick agent avatar',
    filters: [
      { name: 'Images and GIFs', extensions: AVATAR_EXTENSIONS },
      { name: 'SVG', extensions: ['svg'] },
      { name: 'GIF', extensions: ['gif'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
    ],
    properties: ['openFile']
  });
  return result.canceled ? null : result.filePaths[0];
}

ipcMain.handle('pick-avatar', pickAvatarFile);
ipcMain.handle('pick-svg', pickAvatarFile);

// Read a local image file and return it as a base64 data URL so the renderer
// can load it into an HTMLImageElement without file:// protocol access.
ipcMain.handle('read-image-as-data-url', async (_event, filePath) => {
  try {
    const safeFilePath = String(filePath || '').trim();
    if (!safeFilePath) return { ok: false, error: 'no file path' };
    const ext = avatarExtension(safeFilePath);
    if (!ext) return { ok: false, error: 'unsupported image type' };
    const mimeMap = { svg: 'image/svg+xml', gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
    const mime = mimeMap[ext] || 'image/png';
    const data = await fsp.readFile(safeFilePath);
    return { ok: true, dataUrl: `data:${mime};base64,${data.toString('base64')}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('pick-cwd', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pick agent working directory',
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// ---------------------------------------------------------------------------
// Per-agent context-menu IPC (right-click fan-out actions)
// ---------------------------------------------------------------------------

// update-agent-cwd — change the cwd field of an existing registry entry. Used
// by the right-click "CWD: …" action: opens pick-cwd, then this writes back.
// Validation: entry must exist; cwd must be a non-empty string. We don't try
// to verify the dir exists here (Richard might be picking a path that he'll
// create later), but we tilde-collapse it for storage so the registry stays
// portable across machines.
ipcMain.handle('update-agent-cwd', async (event, { id, cwd }) => {
  try {
    const safeId = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid id');
    let next = String(cwd || '').trim();
    if (!next) throw new Error('cwd required');
    // Tilde-collapse if under $HOME so the registry value stays portable.
    const home = process.env.HOME;
    if (home && next.startsWith(home + '/')) next = '~' + next.slice(home.length);
    else if (home && next === home) next = '~';

    let updated = false;
    writeRegistry(data => {
      const entry = data.agents.find(a => a.id === safeId);
      if (!entry) throw new Error(`agent "${safeId}" not in registry`);
      entry.cwd = next;
      updated = true;
    });
    return { ok: true, cwd: next };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Reap the auto-inject background subshells launch-agent.sh wrote to
// /tmp/<agent>-bg-<paneIdSlashSubbed>.pids. PIDFILE format mirrors the shell
// side: the pane id has every `%` substituted with `_` (so `%23` becomes
// `_23`). Order matters per CLAUDE.md "stale-pid cleanup": SIGKILL the
// subshell BEFORE its sleep child — killing sleep first unblocks bash, which
// then runs `tmux send-keys` into nothing (or worse, into a re-spawned pane
// mid-boot). pkill -9 -P targets the subshell's children.
//
// This is the same cleanup launch-agent.sh runs at the START of each
// iteration; we run it at kill time so the bg jobs don't outlive the pane.
async function reapAgentBgPids(agentId, paneId) {
  if (!agentId || !paneId) return;
  const safePane = paneId.replace(/%/g, '_');
  const pidfile = path.join('/tmp', `${agentId}-bg-${safePane}.pids`);
  let raw;
  try { raw = fs.readFileSync(pidfile, 'utf8'); }
  catch { return; }   // no PIDFILE = nothing to reap
  const pids = raw.split('\n').map(s => s.trim()).filter(s => /^\d+$/.test(s));
  for (const pid of pids) {
    await new Promise(resolve => {
      execFile('kill', ['-9', pid], () => resolve());   // ignore errors — pid may already be dead
    });
    await new Promise(resolve => {
      execFile('pkill', ['-9', '-P', pid], () => resolve());
    });
  }
  try { fs.unlinkSync(pidfile); } catch { /* already gone */ }
}

// kill-pane — destructive: tmux kill-pane on the agent's pane. Different from
// restart-agent (Ctrl-C, restart loop respawns). kill-pane removes the bash
// while-loop entirely — the pane is gone from chq until the user re-deploys.
// Before killing the pane, reaps the auto-inject bg subshells so they don't
// outlive their owner pane and litter /tmp with orphaned PIDFILEs.
ipcMain.handle('kill-pane', async (event, id) => {
  try {
    const safeId = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid id');

    const agentList = loadAgents();
    const agent = agentList.find(a => a.id === safeId);
    if (!agent) throw new Error(`agent "${safeId}" not in registry`);

    const matches = await resolveLiveAgentPanes(agent);
    if (matches.length === 0) throw new Error(`${agent.displayName || safeId} isn't running in chq — Deploy it first`);

    // Kill all matching panes (in case there are multiple — e.g. if the same
    // agent ended up duplicated across windows). Each kill-pane is its own
    // execFile call, no shell. Reap bg pids BEFORE killing the pane.
    await teardownPipePaneForAgent(safeId);
    for (const m of matches) {
      await reapAgentBgPids(safeId, m.paneId);
      await new Promise((resolve, reject) => {
        execFile('tmux', ['kill-pane', '-t', m.coord], (err, _o, ser) => {
          if (err) return reject(new Error(ser || err.message));
          resolve();
        });
      });
    }
    removePaneSidecarIds([safeId]);
    return { ok: true, killed: matches.map(m => m.coord) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// attach-pane — focus the user's cursor onto the agent's tmux pane while
// preserving AgentRemote's "double wrapped" viewing contract:
//
//   agent process -> tmux pane -> solo tmux window -> iTerm control-mode surface
//
// ALS-010 collapsed the previous three controls (Attach orb + Detach-to-window
// + Detach-to-split) into this single layout-aware action. Behaviour:
//
//   0. NEW (ALS-010): if the agent's pane is sharing its tmux window with
//      other panes, silently `tmux break-pane -d -s <paneId>` it into a new
//      window first. Solo-windowed panes pass through untouched (regression
//      check #4 in the AC). break-pane preserves the entire pane process
//      tree — the bash auto-restart loop (and whatever it spawned) survives
//      with a stable pane_id; only the coord (session:window.pane) updates.
//
//   1. Run `tmux select-pane -t <coord>` on the (possibly new) coord so
//      server-side state reflects the desired active pane. select-pane with
//      a fully-qualified coord (session:window.pane) switches the active
//      window AND pane in one call — works across `teams`, `panes`, and
//      `ittab` layouts.
//
//   2. Reuse the existing iTerm control-mode viewer when present. If no
  //      control-mode viewer exists, launch Swarmy's AgentRemote runtime attach, which uses
//      `tmux -CC attach` for the ittab layout. Do not open a normal
//      `tmux attach -t chq` viewer here; it collapses multiple agent panes into
//      one split-pane terminal and breaks Richard's arrange/resize workflow.
//
// The previous implementation chained `tmux attach \; select-pane` or opened
// a native iTerm split running normal attach. Both are wrong for AgentRemote.
// Select the pane/window server-side first, then focus or create the
// control-mode viewer.
ipcMain.handle('attach-pane', async (event, id) => {
  try {
    const safeId = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid id');

    const agentList = loadAgents();
    const agent = agentList.find(a => a.id === safeId);
    if (!agent) throw new Error(`agent "${safeId}" not in registry`);

    let panes = await listPanes();
    let match = resolveAgentPanes({ agent, panes, sidecar: readPaneSidecar() })[0];
    if (!match) throw new Error(`${agent.displayName || safeId} isn't running in chq — Deploy it first`);

    // Defense in depth: ensure the coord came back in the expected shape
    // (session:window.pane like "chq:0.3") before letting it land in an
    // osascript string. Belt + suspenders — listPanes already constructs it,
    // but if a future tmux version returns something exotic, refuse rather
    // than interpolate.
    if (!/^[a-z0-9_:.-]+$/i.test(match.coord)) {
      throw new Error(`refusing to attach to suspicious coord: ${match.coord}`);
    }
    const sessionName = match.coord.split(':')[0];
    if (!/^[a-z0-9_-]+$/i.test(sessionName)) {
      throw new Error(`refusing to attach to suspicious session: ${sessionName}`);
    }

    // Step 0 (ALS-010) — if the agent shares its tmux window with sibling
    // panes, break it out so the iTerm window we render fills with just this
    // agent. We count siblings by filtering listPanes output to the same
    // session:window prefix as match.coord. paneId (e.g. "%5") is stable
    // across the break and is what we re-resolve the new coord by.
    const sourceWindowPrefix = match.coord.split('.')[0];      // "chq:0"
    const sameWindowPanes = panes.filter(p => p.coord.startsWith(`${sourceWindowPrefix}.`));
    const isMultiPaneWindow = sameWindowPanes.length > 1;
    let breakPaneResult = null;
    if (isMultiPaneWindow) {
      if (!match.paneId || !/^%[0-9]+$/.test(match.paneId)) {
        throw new Error(`refusing to break-pane on suspicious pane_id: ${match.paneId}`);
      }
      // -d keeps focus on the original window; we'll select the new pane
      // explicitly in step 1. -t '<session>:' pins the new window into the
      // source session — without this, break-pane defaults to the attached
      // client's session, which can dump the agent into the wrong session
      // if the user is currently attached elsewhere. sessionName is already
      // alphabet-validated above. Server-side, no AppleScript involved.
      await new Promise((resolve, reject) => {
        execFile('tmux', ['break-pane', '-d', '-s', match.paneId, '-t', `${sessionName}:`], (err, _o, ser) => {
          if (err) return reject(new Error(ser || err.message));
          resolve();
        });
      });
      // Re-resolve coord — break-pane moved the pane to a new window, so the
      // session:window.pane id changed. paneId is stable, so re-list and find
      // by paneId rather than re-grepping by title (avoids needle-collision
      // edge cases if two agents share a substring).
      const refreshed = await listPanes();
      const updated = refreshed.find(p => p.paneId === match.paneId);
      if (!updated) {
        throw new Error(`break-pane succeeded but pane ${match.paneId} not found in refreshed list`);
      }
      if (!/^[a-z0-9_:.-]+$/i.test(updated.coord)) {
        throw new Error(`refusing post-break coord: ${updated.coord}`);
      }
      breakPaneResult = { fromCoord: match.coord, toCoord: updated.coord };
      match = updated;                                          // continue with new coord
    }

    const attachLabel = safeTmuxWindowLabel(agent, safeId);
    await labelTmuxPaneWindow(match, attachLabel);
    updatePaneSidecarEntry(safeId, match);
    syncMessageAgentPaneEntry(safeId);

    // Step 1 — set active pane server-side. Works across panes/windows/ittab.
    // Prefer the stable pane id so stale window coordinates cannot send Attach
    // to a neighboring pane after a prior break-pane or iTerm control-mode move.
    const selectTarget = match.paneId && /^%[0-9]+$/.test(match.paneId) ? match.paneId : match.coord;
    await new Promise((resolve, reject) => {
      execFile('tmux', ['select-pane', '-t', selectTarget], (err, _o, ser) => {
        if (err) return reject(new Error(ser || err.message));
        resolve();
      });
    });
    const windowTarget = match.coord.split('.')[0];
    await new Promise((resolve, reject) => {
      execFile('tmux', ['select-window', '-t', windowTarget], (err, _o, ser) => {
        if (err) return reject(new Error(ser || err.message));
        resolve();
      });
    });

    let { error: viewerError, clients, sessions } = await viewerSafetyState('ittab', sessionName);
    if (viewerError) {
      throw new Error(viewerError);
    }
    if (!hasRequiredTmuxClient('ittab', clients)) {
      const apple = buildITermAttachScript(swarmyRuntimeAttachCommand());
      await new Promise((resolve, reject) => {
        execFile('osascript', ['-e', apple], (err, _o, ser) => {
          if (err) return reject(new Error(ser || err.message));
          resolve();
        });
      });
      clients = await waitForDeployViewer('ittab');
      sessions = await listTmuxSessionGroups();
      viewerError = viewerSafetyError({ sessionName, layout: 'ittab', sessions, clients });
      if (viewerError) {
        throw new Error(viewerError);
      }
      if (!hasRequiredTmuxClient('ittab', clients)) {
        throw new Error('control-mode iTerm viewer did not attach');
      }
    } else {
      const controlModeClients = clients.filter(client => {
        return String(client.controlMode) === '1' && /^\/dev\/ttys[0-9]+$/.test(String(client.name || ''));
      });
      if (controlModeClients.length === 0) {
        throw new Error('control-mode iTerm viewer is present but no switchable client tty was found');
      }
      for (const client of controlModeClients) {
        await new Promise((resolve, reject) => {
          execFile('tmux', ['switch-client', '-c', client.name, '-t', windowTarget], (err, _o, ser) => {
            if (err) return reject(new Error(ser || err.message));
            resolve();
          });
        });
      }
      await new Promise((resolve, reject) => {
        execFile('osascript', ['-e', 'tell application "iTerm" to activate'], (err, _o, ser) => {
          if (err) return reject(new Error(ser || err.message));
          resolve();
        });
      });
    }

    return { ok: true, coord: match.coord, mode: 'control-mode-focus', brokeOut: !!breakPaneResult };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// kill-session — destructive: tear down the AgentRemote runtime session via
// Swarmy's runtime adapter. This is the panel-level
// counterpart to the per-agent kill-pane IPC.
//
// Why we need this: Swarmy's AgentRemote runtime stashes the user's chosen layout in
// @chq_layout at session-start time, and cmd_add reads it back on every
// subsequent Deploy. So once a session is running in (e.g.) `panes` mode,
// flipping the WINDOWS pill in the panel and re-Deploying re-uses the
// existing session under the OLD layout. To actually switch layouts the user
// has to stop the session first, then re-Deploy. This handler is what the
// little ✕ next to the layout-pills calls.
//
// Returns { ok: true, killed: true } on success, { ok: true, killed: false }
// if there was no session to kill (already gone), { ok: false, error } on
// genuine failure (e.g. tmux not installed).
ipcMain.handle('kill-session', async () => {
  return new Promise((resolve) => {
    execFile('python3', swarmyRuntimeArgs('stop'), (err, _o, ser) => {
      if (err) {
        // "no server running" or "session not found" — both are benign:
        // there was nothing to kill, the desired end-state already holds.
        const msg = ser || err.message || '';
        if (/no server running|can't find session|session not found/i.test(msg)) {
          removePaneSidecarSession(RUNTIME_SESSION);
          return resolve({ ok: true, killed: false });
        }
        return resolve({ ok: false, error: msg });
      }
      removePaneSidecarSession(RUNTIME_SESSION);
      resolve({ ok: true, killed: true });
    });
  });
});

// get-session-layout — returns the value stashed in tmux's @chq_layout option
// at session start time (one of 'teams' | 'panes' | 'ittab'), or '' if no
// session is running.
//
// If the session exists but @chq_layout was never set (legacy session, or
// session created outside Swarmy's AgentRemote runtime), returns 'unknown' — a sentinel that
// tells the renderer "session is up but I can't tell what layout" so the
// stop button still enables but the mismatch hint stays off.
//
// Used by the renderer to show a visual hint on the layout-pills when the
// user's currently-selected pill differs from the running session's layout —
// telegraphs "your pill choice won't take effect until you tear down the
// running session". Polled alongside pane-status on the 3s status loop.
ipcMain.handle('get-session-layout', async () => {
  return new Promise((resolve) => {
    execFile('python3', swarmyRuntimeArgs('layout'), (err, stdout) => {
      if (err) {
        return resolve('');
      }
      const v = (stdout || '').trim();
      if (v) return resolve(v);
      execFile('tmux', ['has-session', '-t', RUNTIME_SESSION], (err2) => {
        if (err2) return resolve('');                 // genuinely no session
        return resolve('unknown');                    // session up, layout unstashed
      });
    });
  });
});

// ALS-010 (2026-05-03): the standalone `detach-pane-to-window` and
// `detach-pane-to-split` IPC handlers were retired. Their behaviour is now
// subsumed into `attach-pane` above, which auto-runs `tmux break-pane -d`
// when the agent shares a window with siblings. The two settings-popover
// buttons that drove them were removed at the same time. If you need
// power-user split layouts, reach for `tmux` directly — AgentRemote's
// surface intentionally exposes one Attach action and stops there.

// ---------------------------------------------------------------------------
// Team-chat overlay — native JSONL chat substrate
// ---------------------------------------------------------------------------
// The chat overlay (Cmd+T in renderer) renders a NATIVE chat surface that
// reads/writes ~/.message-agent/channels/team/messages.jsonl directly. No
// HTTP server, no webview — Path 1 per Swarmy's shared-channels spec.
//
// Wire format (one envelope per line, append-only, O_APPEND-safe):
//   {
//     "channel": "team",
//     "correlation_id": "<uuid4>",
//     "from": "richard",
//     "message": "<body>",
//     "timestamp": "<ISO8601 UTC Z>",
//     "to": "team",
//     "type": "message"
//   }
//
// Three IPC handlers:
//   chat-tail-init   → read entire file, return all envelopes + EOF byte offset
//   chat-tail-read   → read from caller's offset to EOF, return new envelopes + new offset
//   chat-post        → append a new envelope authored as `from: "richard"`
//
// Live tail: fs.watch fires chat-tail-changed to the renderer; renderer pulls
// via chat-tail-read with its cached offset. The renderer also runs an 8s
// heartbeat fallback in case fs.watch goes silent on a flaky filesystem.
// Watcher events are debounced 50ms — one append can land as multiple events.

const TEAM_CHAT_PATH = path.join(os.homedir(), '.message-agent', 'channels', 'team', 'messages.jsonl');

// Ensure the parent directory exists so a fresh install can create the file
// on first append. Idempotent — recursive:true won't error if the dir is
// already there. Best-effort: a chmod / disk error here is rare and would
// surface again at append time with a clearer message.
async function ensureChatDir() {
  try {
    await fsp.mkdir(path.dirname(TEAM_CHAT_PATH), { recursive: true });
  } catch (err) {
    // Permission denied or something more exotic — the append call will
    // re-raise with the same error. We just don't want to crash here.
    logToOutLog(`ensureChatDir: mkdir failed (${err.message}); continuing`);
  }
}

// Parse one JSONL byte buffer into { envelopes, leftover }. The leftover is
// any trailing bytes that don't end in a newline — kept for the next read so
// we don't drop the half-written final line of a concurrent appender. Lines
// that fail JSON.parse are skipped with a console.warn (they're presumably
// corrupt rather than partial — partial lines never have a trailing newline).
function parseJsonlBuffer(buf) {
  const text = buf.toString('utf8');
  const newlineEnd = text.lastIndexOf('\n');
  let parsable, leftoverStr;
  if (newlineEnd === -1) {
    parsable = '';
    leftoverStr = text;
  } else {
    parsable = text.slice(0, newlineEnd);
    leftoverStr = text.slice(newlineEnd + 1);
  }
  const envelopes = [];
  if (parsable) {
    for (const line of parsable.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        envelopes.push(JSON.parse(trimmed));
      } catch (err) {
        console.warn(`[chat] skipping malformed JSONL line: ${err.message}`);
      }
    }
  }
  // leftover byte length matters for offset accounting — UTF-8 means the
  // string-slice length isn't the byte count. Convert back to bytes.
  const leftoverBytes = Buffer.byteLength(leftoverStr, 'utf8');
  return { envelopes, leftoverBytes };
}

// chat-tail-init — read entire file, return everything + the EOF offset.
// Caller caches the offset and uses it on subsequent chat-tail-read calls.
// File-not-found is treated as an empty channel (no error).
ipcMain.handle('chat-tail-init', async () => {
  try {
    await ensureChatDir();
    let buf;
    try {
      buf = await fsp.readFile(TEAM_CHAT_PATH);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { ok: true, envelopes: [], offset: 0 };
      }
      throw err;
    }
    const { envelopes, leftoverBytes } = parseJsonlBuffer(buf);
    // Offset = total bytes minus any trailing partial-line bytes. Next read
    // will start at the partial line and re-attempt to parse it once the
    // appender finishes.
    const offset = buf.length - leftoverBytes;
    return { ok: true, envelopes, offset };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

// chat-tail-read — read from caller's offset to EOF, return new envelopes
// + the new offset. If the file shrunk (e.g. someone truncated it), reset
// offset to 0 and return everything.
ipcMain.handle('chat-tail-read', async (_event, payload = {}) => {
  try {
    const askedOffset = Number.isFinite(payload.offset) ? Math.max(0, Math.floor(payload.offset)) : 0;

    let stat;
    try {
      stat = await fsp.stat(TEAM_CHAT_PATH);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { ok: true, envelopes: [], offset: 0 };
      }
      throw err;
    }
    const size = stat.size;
    if (size === askedOffset) {
      return { ok: true, envelopes: [], offset: askedOffset };
    }
    // File shrunk → re-read from 0. Don't try to recover the caller's offset.
    let startOffset = askedOffset;
    if (size < askedOffset) {
      startOffset = 0;
    }

    const fh = await fsp.open(TEAM_CHAT_PATH, 'r');
    try {
      const length = size - startOffset;
      const buf = Buffer.alloc(length);
      await fh.read(buf, 0, length, startOffset);
      const { envelopes, leftoverBytes } = parseJsonlBuffer(buf);
      const newOffset = size - leftoverBytes;
      return { ok: true, envelopes, offset: newOffset };
    } finally {
      await fh.close();
    }
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('pet-pane-tail', async (_event, payload = {}) => {
  try {
    const safeId = String(payload.agentId || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid agent id');

    const agentList = loadAgents();
    const agent = agentList.find(a => a.id === safeId);
    if (!agent) throw new Error(`agent "${safeId}" not in registry`);

    const matches = await resolveLiveAgentPanes(agent);
    const match = matches[0];
    if (!match) throw new Error(`${agent.displayName || safeId} is not running`);

    const target = match.paneId && /^%[0-9]+$/.test(match.paneId) ? match.paneId : match.coord;
    const stdout = await new Promise((resolve, reject) => {
      execFile('tmux', ['capture-pane', '-p', '-J', '-S', '-80', '-t', target], (err, out, ser) => {
        if (err) return reject(new Error(ser || err.message));
        resolve(out || '');
      });
    });
    const lines = stdout
      .split('\n')
      .map(line => line.replace(/\s+$/g, ''))
      .filter(line => line.trim())
      .slice(-18);

    return {
      ok: true,
      source: 'tmux',
      coord: match.coord,
      paneId: match.paneId,
      title: match.title,
      lines
    };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

// chat-post — append a new envelope to messages.jsonl as from: "richard".
// `to` defaults to "team". Uses fs.promises.appendFile, which uses O_APPEND
// under the hood — safe for concurrent appenders writing single lines under
// PIPE_BUF (4KB on macOS). Long messages above PIPE_BUF would need an explicit
// flock, but realistically chat lines stay under that ceiling.
ipcMain.handle('chat-post', async (_event, payload = {}) => {
  try {
    const messageRaw = payload.message;
    if (typeof messageRaw !== 'string' || !messageRaw.trim()) {
      throw new Error('message body required');
    }
    const message = messageRaw.trim();
    const to = (typeof payload.to === 'string' && payload.to.trim()) ? payload.to.trim() : 'team';

    // ISO8601 UTC with the trailing 'Z'. Trim millis to match the conventions
    // used by other agents writing into the channel (envelope inspection of
    // existing lines shows seconds-precision Z timestamps).
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    const envelope = {
      channel: 'team',
      correlation_id: crypto.randomUUID(),
      from: 'richard',
      message,
      timestamp,
      to,
      type: 'message'
    };

    await ensureChatDir();
    await fsp.appendFile(TEAM_CHAT_PATH, JSON.stringify(envelope) + '\n', { flag: 'a' });
    return { ok: true, envelope };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

// Live tail via fs.watch. Watcher is set up at app-ready time so the renderer
// gets change events whether the overlay is open or not (renderer ignores
// events while hidden). Debounced 50ms to coalesce rapid writes.
//
// fs.watch on a non-existent file throws, so we watch the parent directory
// and filter for our filename. Same trick as watchToggleFile().
let chatWatchDebounce = null;
let chatWatcher = null;
function startChatWatcher() {
  const dir = path.dirname(TEAM_CHAT_PATH);
  const filename = path.basename(TEAM_CHAT_PATH);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    logToOutLog(`startChatWatcher: mkdir ${dir} failed (${err.message}); skipping watcher`);
    return;
  }
  try {
    chatWatcher = fs.watch(dir, { persistent: false }, (eventType, name) => {
      if (name !== filename) return;
      if (chatWatchDebounce) clearTimeout(chatWatchDebounce);
      chatWatchDebounce = setTimeout(() => {
        chatWatchDebounce = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
          try { mainWindow.webContents.send('chat-tail-changed'); }
          catch { /* renderer not ready yet — heartbeat fallback covers it */ }
        }
        notifyPetWindows('chat-tail-changed');
      }, 50);
    });
    chatWatcher.on('error', (err) => {
      logToOutLog(`chat fs.watch error: ${err.message}`);
    });
  } catch (err) {
    logToOutLog(`startChatWatcher: fs.watch failed (${err.message}); heartbeat fallback in renderer covers it`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// Council IPC handlers (ACRM-533 T5)
//
// Councils are bounded-membership ephemeral group brainstorms. Richard invokes
// `/council <names> [about <topic>] --brief <path>` from the Councils tab.
// `council-spawn.sh` does the actual tmux+claude launch; these handlers
// validate, generate IDs, call the script, and return status strings.
// ─────────────────────────────────────────────────────────────────────────────

const COUNCILS_BASE = path.join(os.homedir(), '.message-agent', 'councils');
const COUNCIL_SPAWN_SH = path.join(REPO_ROOT, 'council-spawn.sh');

// Generate a council-id: c-<6 hex chars> derived from 3 crypto bytes.
function generateCouncilId() {
  try { return 'c-' + crypto.randomBytes(3).toString('hex'); }
  catch { return 'c-' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); }
}

// Validate and normalize a list of raw member name tokens.
// Returns { ok: true, members: ['xavier', ...] } or { ok: false, error: '...' }
function validateCouncilMembers(rawNames) {
  const knownIds = new Set(loadAgents().map(a => String(a.id || '').trim().toLowerCase()));

  const claudePrefixed = [];
  const unknown = [];
  const members = [];

  for (const raw of rawNames) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    if (name.startsWith('claude-')) {
      // Reject claude- prefix — bare names only (S121 rename directive)
      claudePrefixed.push(raw.trim());
      continue;
    }
    if (!knownIds.has(name)) {
      unknown.push(name);
      continue;
    }
    if (!members.includes(name)) members.push(name);
  }

  if (claudePrefixed.length > 0) {
    const hints = claudePrefixed.map(n => `${n.replace(/^claude-/i, '')} (not ${n})`).join(', ');
    return { ok: false, error: `Use bare names: ${hints} per S121 rename` };
  }
  if (unknown.length > 0) {
    return { ok: false, error: `Unknown identities: ${unknown.join(', ')}` };
  }
  if (members.length < 1) {
    return { ok: false, error: 'At least one council member is required' };
  }
  return { ok: true, members };
}

// council-spawn — validate args, generate a council-id, invoke council-spawn.sh
ipcMain.handle('council-spawn', async (_event, payload = {}) => {
  try {
    const { namesRaw, briefPath, displayTopic } = payload;

    // Brief path is required — operator hand-curates it (COUNCIL.md hard constraint)
    if (!briefPath || !briefPath.trim()) {
      return { ok: false, error: 'Topic brief path required — hand-curate per COUNCIL.md' };
    }
    const resolvedBrief = briefPath.trim().replace(/^~/, os.homedir());
    if (!fs.existsSync(resolvedBrief)) {
      return { ok: false, error: `Topic brief not found: ${briefPath.trim()}` };
    }

    // Parse + validate member names
    if (!namesRaw || !namesRaw.trim()) {
      return { ok: false, error: 'Council member names required' };
    }
    // Accept comma OR space-separated names
    const rawTokens = namesRaw.trim().split(/[\s,]+/).filter(Boolean);
    const validation = validateCouncilMembers(rawTokens);
    if (!validation.ok) return { ok: false, error: validation.error };

    const councilId = generateCouncilId();
    const membersArg = validation.members.join(',');

    // Ensure council dirs exist (council-spawn.sh also creates them, but
    // creating here lets us write the display topic early for the UI)
    const councilDir = path.join(COUNCILS_BASE, councilId);
    await fsp.mkdir(path.join(councilDir, 'sentinels'), { recursive: true });
    if (displayTopic) {
      await fsp.writeFile(path.join(councilDir, 'topic.txt'), displayTopic.trim() + '\n', 'utf8');
    }
    await fsp.writeFile(path.join(councilDir, 'transcript.jsonl'), '', { flag: 'a' });

    // Invoke council-spawn.sh — it creates tmux windows and settings files
    await new Promise((resolve, reject) => {
      const proc = require('child_process').execFile(
        'bash',
        [COUNCIL_SPAWN_SH, councilId, membersArg, resolvedBrief],
        { timeout: 15000 },
        (err, stdout, stderr) => {
          if (err) reject(new Error(stderr.trim() || err.message));
          else resolve({ stdout, stderr });
        }
      );
    });

    const membersList = validation.members.join(', ');
    const statusMsg = `Council ${councilId} spawned with ${membersList} — open subtab`;
    logToOutLog(`council-spawn: ${statusMsg}`);
    return { ok: true, councilId, members: validation.members, status: statusMsg };
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    logToOutLog(`council-spawn error: ${msg}`);
    return { ok: false, error: msg };
  }
});

// council-disperse — signal router daemon (sentinel file) + kill tmux windows
ipcMain.handle('council-disperse', async (_event, payload = {}) => {
  try {
    const { councilId } = payload;
    if (!councilId || !/^c-[0-9a-f]{6}$/i.test(councilId)) {
      return { ok: false, error: `Invalid council id: ${councilId}` };
    }

    const councilDir = path.join(COUNCILS_BASE, councilId);

    // Write DISPERSE sentinel — the router daemon fs.watches this dir
    // and stops routing when it sees this file (T3/ACRM-531 contract)
    await fsp.mkdir(councilDir, { recursive: true });
    await fsp.writeFile(path.join(councilDir, 'DISPERSE'), new Date().toISOString() + '\n', 'utf8');

    // Kill tmux windows named council-<id>-* across all sessions
    let killedWindows = [];
    try {
      // List all windows: session:window-name
      const { execFileSync } = require('child_process');
      const listOut = execFileSync('tmux', [
        'list-windows', '-a', '-F', '#{session_name}:#{window_name}'
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 });

      const prefix = `council-${councilId}-`;
      for (const line of listOut.split('\n')) {
        const [sessName, winName] = line.trim().split(':');
        if (!winName || !winName.startsWith(prefix)) continue;
        try {
          execFileSync('tmux', ['kill-window', '-t', `${sessName}:${winName}`], { timeout: 3000 });
          killedWindows.push(winName);
        } catch { /* window may already be gone */ }
      }
    } catch { /* tmux not running or no sessions — that's fine */ }

    const statusMsg = `Council ${councilId} dispersed — transcript retained 7 days`;
    logToOutLog(`council-disperse: ${statusMsg} (killed windows: ${killedWindows.join(', ') || 'none'})`);
    return { ok: true, councilId, killedWindows, status: statusMsg };
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    logToOutLog(`council-disperse error: ${msg}`);
    return { ok: false, error: msg };
  }
});

// council-list — enumerate active councils (dirs with transcript.jsonl, no DISPERSE sentinel)
ipcMain.handle('council-list', async () => {
  try {
    await fsp.mkdir(COUNCILS_BASE, { recursive: true });
    const entries = await fsp.readdir(COUNCILS_BASE, { withFileTypes: true });
    const councils = [];
    for (const e of entries) {
      if (!e.isDirectory() || !/^c-[0-9a-f]{6}$/i.test(e.name)) continue;
      const cDir = path.join(COUNCILS_BASE, e.name);
      const dispersed = fs.existsSync(path.join(cDir, 'DISPERSE'));
      let topic = '';
      try { topic = (await fsp.readFile(path.join(cDir, 'topic.txt'), 'utf8')).trim(); } catch {}
      // Derive member list from settings-*.json files created by council-spawn.sh
      let members = [];
      try {
        const files = await fsp.readdir(cDir);
        members = files
          .filter(f => f.startsWith('settings-') && f.endsWith('.json'))
          .map(f => f.replace(/^settings-/, '').replace(/\.json$/, ''));
      } catch {}
      councils.push({ id: e.name, dispersed, topic, members });
    }
    return { ok: true, councils };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err), councils: [] };
  }
});

// council-transcript-read — read council JSONL (filtered to type=council_message)
ipcMain.handle('council-transcript-read', async (_event, payload = {}) => {
  try {
    const { councilId, offset = 0 } = payload;
    if (!councilId) return { ok: false, error: 'councilId required', lines: [] };
    const txPath = path.join(COUNCILS_BASE, councilId, 'transcript.jsonl');
    if (!fs.existsSync(txPath)) return { ok: true, lines: [], newOffset: 0 };
    const stat = await fsp.stat(txPath);
    if (stat.size <= offset) return { ok: true, lines: [], newOffset: offset };
    const fh = await fsp.open(txPath, 'r');
    let buf;
    try {
      buf = Buffer.alloc(stat.size - offset);
      await fh.read(buf, 0, buf.length, offset);
    } finally { await fh.close(); }
    const rawLines = buf.toString('utf8').split('\n').filter(l => l.trim());
    const parsed = rawLines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    return { ok: true, lines: parsed, newOffset: stat.size };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err), lines: [] };
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (chatWatchDebounce) { clearTimeout(chatWatchDebounce); chatWatchDebounce = null; }
  if (chatWatcher) { try { chatWatcher.close(); } catch { /* already closed */ } chatWatcher = null; }
  for (const win of petWindows.values()) {
    try { if (win && !win.isDestroyed()) win.close(); } catch {}
  }
  petWindows.clear();
  petWindowConfigs.clear();
  // Tear down all live pipe-pane registrations so we don't leave zombie
  // tmux pipe-pane entries if the user closes AgentRemote without collapsing.
  teardownAllPipePanes();
});

// ---------------------------------------------------------------------------
// xterm.js per-agent terminal viewer (ALS-005)
// ---------------------------------------------------------------------------
// Architecture:
//   expand: mkfifo /tmp/agent-remote-pipe-<id>  →  tmux pipe-pane -t <pane_id>
//           to that FIFO  →  fs.createReadStream opens the FIFO in non-blocking
//           mode  →  bytes forwarded to renderer via 'pane-output:<id>' IPC
//   collapse: unlink FIFO + tmux pipe-pane -t <pane_id> (no second arg = stop)
//   stdin: renderer sends 'pane-input' {id, data}  →  tmux send-keys -t <pane_id> <data>
//
// One entry in activePipeReaders per streamed agent. Keyed by agent id.
// Value: { fifoPath, readStream, paneId, consumers }

const activePipeReaders = {};
const DEFAULT_PIPE_CONSUMER = 'terminal';

// Build the FIFO path for an agent id.
function pipeFifoPath(agentId) {
  return path.join('/tmp', `agent-remote-pipe-${agentId}`);
}

// Resolve the live tmux pane for an agent. Prefers the sidecar's stable
// pane_id, then falls back to title matching through the shared resolver.
async function resolvePaneForAgentId(agentId) {
  const agents = loadAgents();
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return null;
  return (await resolveLiveAgentPanes(agent))[0] || null;
}

function normalizePanePipeRequest(payload, defaultConsumer = DEFAULT_PIPE_CONSUMER) {
  const rawAgentId = payload && typeof payload === 'object' ? payload.agentId : payload;
  const rawConsumer = payload && typeof payload === 'object' ? payload.consumer : defaultConsumer;
  const safeId = String(rawAgentId || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid agent id');
  const consumer = String(rawConsumer || defaultConsumer)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || defaultConsumer;
  return { safeId, consumer };
}

function ensurePipeConsumers(entry) {
  if (!entry) return new Set();
  if (!(entry.consumers instanceof Set)) entry.consumers = new Set([DEFAULT_PIPE_CONSUMER]);
  return entry.consumers;
}

// start-pane-pipe — called by renderer when a terminal tile or pet stream opens.
// 1. Reuses an existing pipe for this agent when another consumer already owns it.
// 2. Creates a FIFO at /tmp/agent-remote-pipe-<id>.
// 3. Registers tmux pipe-pane -t <pane_id> to write to that FIFO.
// 4. Opens a read-stream on the FIFO and forwards bytes via IPC.
ipcMain.handle('start-pane-pipe', async (_event, payload) => {
  try {
    const { safeId, consumer } = normalizePanePipeRequest(payload);

    const pane = await resolvePaneForAgentId(safeId);
    const paneId = pane && pane.paneId;
    if (!paneId) throw new Error(`no running pane for agent "${safeId}" — Deploy it first`);

    const existing = activePipeReaders[safeId];
    if (existing && existing.paneId === paneId && existing.readStream && !existing.readStream.destroyed) {
      const consumers = ensurePipeConsumers(existing);
      consumers.add(consumer);
      logToOutLog(`[pipe:${safeId}] reused on ${paneId} for ${consumer}; consumers=${consumers.size}`);
      return { ok: true, reused: true, consumers: consumers.size };
    }

    // Clean up a stale or retargeted pipe for this agent before opening a new one.
    await teardownPipePaneForAgent(safeId);

    const fifoPath = pipeFifoPath(safeId);

    // Remove any leftover FIFO from a prior run.
    try { fs.unlinkSync(fifoPath); } catch { /* no-op */ }

    // Create the FIFO.
    await new Promise((resolve, reject) => {
      execFile('mkfifo', [fifoPath], (err, _o, ser) => {
        if (err) return reject(new Error(`mkfifo failed: ${ser || err.message}`));
        resolve();
      });
    });

    // Open the FIFO for reading BEFORE registering pipe-pane. On macOS,
    // opening a FIFO for reading blocks until a writer appears. Since
    // createReadStream is async (uses the libuv thread pool), it queues the
    // open() in the background — the event loop stays free. When pipe-pane's
    // "cat" subprocess opens the FIFO for writing, both ends unblock and data
    // starts flowing.
    //
    // Opening in the wrong order (pipe-pane first, then createReadStream) would
    // deadlock: pipe-pane's "cat" blocks waiting for a reader that hasn't
    // arrived yet, and the pipe-pane execFile callback never fires.
    const readStream = fs.createReadStream(fifoPath, { flags: 'r', autoClose: true });

    readStream.on('data', (chunk) => {
      const payload = chunk.toString('base64');
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send(`pane-output:${safeId}`, payload);
        } catch { /* renderer gone — stream still drains */ }
      }
      // Keep floating pet windows in sync with the same stream.
      notifyPetWindows(`pane-output:${safeId}`, payload);
    });
    readStream.on('error', (err) => {
      // FIFO was unlinked (collapse) or tmux pipe closed — this is expected on teardown.
      logToOutLog(`[pipe:${safeId}] read stream error: ${err.message}`);
    });

    // Now register pipe-pane. tmux runs "cat > <fifo>" in a subshell, which
    // opens the FIFO for writing (unblocking the reader above) and forwards
    // all pane output bytes. "cat >" (not ">>") is correct for FIFOs — they
    // don't accumulate data, so append vs replace is irrelevant. The fifoPath
    // is safe: it's /tmp/agent-remote-pipe-<id> where id is [a-z0-9_-]+.
    await new Promise((resolve, reject) => {
      execFile('tmux', ['pipe-pane', '-t', paneId, `cat > ${fifoPath}`], (err, _o, ser) => {
        if (err) {
          // Clean up the stream + FIFO before throwing.
          try { readStream.destroy(); } catch { /* already closed */ }
          try { fs.unlinkSync(fifoPath); } catch { /* no-op */ }
          return reject(new Error(`pipe-pane failed: ${ser || err.message}`));
        }
        resolve();
      });
    });

    activePipeReaders[safeId] = { fifoPath, readStream, paneId, consumers: new Set([consumer]) };
    logToOutLog(`[pipe:${safeId}] started on ${paneId} → ${fifoPath} for ${consumer}`);
    return { ok: true, consumers: 1 };
  } catch (err) {
    logToOutLog(`[pipe] start-pane-pipe failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

// stop-pane-pipe — called by renderer when a tile is collapsed.
ipcMain.handle('stop-pane-pipe', async (_event, payload) => {
  const { safeId, consumer } = normalizePanePipeRequest(payload);
  const entry = activePipeReaders[safeId];
  if (entry) {
    const consumers = ensurePipeConsumers(entry);
    consumers.delete(consumer);
    if (consumers.size > 0) {
      logToOutLog(`[pipe:${safeId}] retained after ${consumer} stop; consumers=${consumers.size}`);
      return { ok: true, retained: true, consumers: consumers.size };
    }
  }
  await teardownPipePaneForAgent(safeId);
  return { ok: true };
});

// pane-input — renderer sends keystrokes typed into the xterm.
// Forwards raw text via tmux send-keys -l (literal, no special-key expansion)
// so the agent's TUI sees the characters as-is.
ipcMain.on('pane-input', (_event, { id, data }) => {
  const safeId = String(id || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(safeId)) return;
  const entry = activePipeReaders[safeId];
  if (!entry || !entry.paneId) return;
  if (typeof data !== 'string' || data.length === 0) return;

  // Handle special sequences: Enter key (\r or \n) → send as Enter keystroke
  // so the agent's readline/TUI sees a real Return. All other bytes via -l (literal).
  // xterm.js sends \r for Enter, \x7f for backspace, etc.
  const parts = data.split(/(\r|\n)/);
  let pending = '';
  for (const part of parts) {
    if (part === '\r' || part === '\n') {
      if (pending.length > 0) {
        execFile('tmux', ['send-keys', '-t', entry.paneId, '-l', pending], () => {});
        pending = '';
      }
      execFile('tmux', ['send-keys', '-t', entry.paneId, 'Enter'], () => {});
    } else {
      pending += part;
    }
  }
  if (pending.length > 0) {
    execFile('tmux', ['send-keys', '-t', entry.paneId, '-l', pending], () => {});
  }
});

// Tear down pipe for one agent: stop read stream, unlink FIFO, stop tmux pipe-pane.
async function teardownPipePaneForAgent(agentId) {
  const entry = activePipeReaders[agentId];
  if (!entry) return;
  delete activePipeReaders[agentId];

  // Close the read stream first so the FIFO unlink doesn't block.
  try { entry.readStream.destroy(); } catch { /* already closed */ }

  // Stop tmux pipe-pane (no second arg = stop piping).
  if (entry.paneId) {
    await new Promise(resolve => {
      execFile('tmux', ['pipe-pane', '-t', entry.paneId], () => resolve());
    });
  }

  // Remove the FIFO.
  try { fs.unlinkSync(entry.fifoPath); } catch { /* already gone */ }

  logToOutLog(`[pipe:${agentId}] torn down`);
}

// ---------------------------------------------------------------------------
// AtlasEventBus — renderer-originated IPC bridge (ARB-003)
// ---------------------------------------------------------------------------
// These handlers receive events from the renderer and re-emit them through
// the typed AtlasEventBus so both main-process subscribers and other renderer
// windows see a consistent event stream.

ipcMain.on('atlas:agent-selected', (_event, payload = {}) => {
  atlasBus.emit('agent_selected', payload, { agentId: payload.agentId, source: 'renderer' });
});

ipcMain.on('atlas:agent-deselected', (_event, payload = {}) => {
  atlasBus.emit('agent_deselected', payload, { agentId: payload.agentId, source: 'renderer' });
});

ipcMain.on('atlas:voice-start', (_event, payload = {}) => {
  atlasBus.emit('voice_recording_started', payload, { source: 'renderer' });
});

ipcMain.on('atlas:voice-stop', (_event, payload = {}) => {
  atlasBus.emit('voice_recording_stopped', payload, { source: 'renderer' });
});

ipcMain.on('atlas:capability-validate', (_event, payload = {}) => {
  atlasBus.emit('capability_validated', payload, { agentId: payload.agentId, source: 'renderer' });
});

ipcMain.handle('atlas:get-event-log', () => atlasBus.getLog());

// Tear down all active pipe readers (called on before-quit).
function teardownAllPipePanes() {
  const ids = Object.keys(activePipeReaders);
  for (const id of ids) {
    const entry = activePipeReaders[id];
    if (!entry) continue;
    delete activePipeReaders[id];
    try { entry.readStream.destroy(); } catch { /* already closed */ }
    if (entry.paneId) {
      execFile('tmux', ['pipe-pane', '-t', entry.paneId], () => {});
    }
    try { fs.unlinkSync(entry.fifoPath); } catch { /* already gone */ }
  }
}
