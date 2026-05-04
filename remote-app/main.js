const { app, BrowserWindow, ipcMain, Menu, session, dialog, globalShortcut, screen } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const crypto = require('crypto');

// Pin the app name BEFORE anything reads userData paths. Without this, Electron
// defaults to "Electron" and the userData dir at
// ~/Library/Application Support/Electron/ is shared with every other dev
// Electron app on the system — caches and storage cross-contaminate. Pinning
// to "AgentRemote" gives this app its own isolated userData dir so storage,
// V8 code cache, GPU caches, and Local State don't leak in from elsewhere.
app.setName('AgentRemote');

const REPO_ROOT = path.join(__dirname, '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'agents.json');
const CHQ_SCRIPT = path.join(REPO_ROOT, 'chq-tmux.sh');
const ASSETS_DIR = path.join(__dirname, 'assets');
const OUT_LOG = path.join(__dirname, 'out.log');

// Sidecar written by chq-tmux.sh at pane creation time. Maps agent id → stable
// pane_id (%N notation). AgentRemote reads this to target broadcasts via pane_id
// rather than fragile pane-title grep. pane_id survives agent auto-restart
// (pane_loop relaunches claude in the SAME pane), so no re-write is needed on
// relaunch — the sidecar entry for a given agent is valid until the session ends.
const SIDECAR_PATH = '/tmp/agent-remote-panes.json';

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

// Best-effort append to remote-app/out.log. Used so registration warnings
// (e.g. accelerator already taken) survive across launches without depending
// on how launch-remote.sh routes stdio. Never throws.
function logToOutLog(line) {
  try {
    const ts = new Date().toISOString();
    fs.appendFileSync(OUT_LOG, `[${ts}] ${line}\n`, 'utf8');
  } catch { /* no-op: logging must not break the app */ }
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
    return data.agents.map(a => ({
      id: a.id,
      displayName: a.display_name,
      // tmux pane title after claude's /rename runs. launch-agent.sh sends
      // `/rename $RENAME_TO` where RENAME_TO is rename_to from the registry
      // (or display_name uppercased as the fallback). The pane title becomes
      // that string verbatim, so the substring needle is its lowercased form.
      // Explicit tmux_target wins if a registry entry needs to override.
      tmuxTarget: a.tmux_target
        || (a.rename_to ? a.rename_to.toLowerCase() : a.display_name.toLowerCase()),
      cwd: a.cwd || '',           // exposed so the right-click menu can show the current value
      color: a.color || null,
      // Auto-restart defaults to true when the field is omitted (matches the
      // shell-side `// true` jq fallback in chq-tmux.sh's pane_loop).
      autoRestart: a.auto_restart !== false,
      // Expose the RAW registry value (empty string when the user hasn't set
      // an override). The renderer uses this to drive the dock label: any
      // non-empty value wins, otherwise the renderer falls back to
      // displayLabelFor() (mixed-case displayName + the overlordswarmy → Swarmy
      // alias). The /rename actually-sent-to-tmux default (display_name
      // uppercased, mirroring launch-agent.sh) is surfaced via the renderer's
      // input placeholder, so the user can still see what the empty fallback
      // resolves to. Was previously eagerly resolved here, which prevented the
      // renderer from telling "user explicitly set it to XAVIER" apart from
      // "user set nothing and main filled in XAVIER".
      renameTo: a.rename_to || '',
      startupSlash: a.startup_slash || '',
      avatar: a.avatar || `${a.id}.svg`
    }));
  } catch (err) {
    console.error(`[remote] failed to read registry ${REGISTRY_PATH}: ${err.message}`);
    return [];
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
// readPaneSidecar() — parse /tmp/agent-remote-panes.json written by chq-tmux.sh.
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
  mainWindow.center();
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
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
});
app.on('window-all-closed', () => { app.quit(); });
// globalShortcut bindings are process-wide and survive renderer crashes —
// Electron explicitly requires unregisterAll() before quit so the OS
// releases the accelerator. Without this, a leftover binding can persist
// until the entire process tree is reaped.
app.on('will-quit', () => { globalShortcut.unregisterAll(); });

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

// Re-position the window so it surfaces on the display the cursor is on,
// then show + focus. Center horizontally; place the panel at ~30% of the
// display height so it sits comfortably above center on a typical screen
// (Richard's been using it as a floating HUD).
function showAtCursorDisplay() {
  try {
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const work = display.workArea;
    const [winW, winH] = mainWindow.getSize();
    const x = Math.round(work.x + (work.width  - winW) / 2);
    const y = Math.round(work.y + work.height * 0.3);
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

  const wRaw = Math.max(380, Math.min(1200, Math.round(width || 620)));
  const hRaw = Math.max(180, Math.min(900, Math.round(height || 240)));

  // Cap height so cur.y + height stays within display.workArea.bottom. If
  // the display lookup fails (rare multi-monitor edge case), skip the cap
  // and let macOS handle clamping.
  let h = hRaw;
  try {
    const cur = mainWindow.getBounds();
    const refPoint = { x: cur.x + Math.round(cur.width / 2), y: cur.y };
    const display = screen.getDisplayNearestPoint(refPoint);
    const maxBottom = display.workArea.y + display.workArea.height - WORKAREA_BOTTOM_SAFETY;
    const maxHeight = Math.max(180, maxBottom - cur.y);
    h = Math.min(hRaw, maxHeight);
  } catch (err) {
    logToOutLog(`resize-window: bottom-cap lookup failed (${err.message}); using uncapped height`);
  }

  mainWindow.setContentSize(wRaw, h, true);
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
      resolve((text || '').trim());
    });
  });
});

ipcMain.on('broadcast-message', async (event, { message, selectedAgents, isAll }) => {
  if (!message || (!isAll && (!selectedAgents || selectedAgents.length === 0))) return;

  let targets = [];
  try {
    targets = await listPanes();
  } catch (err) {
    console.error(`[broadcast] tmux list-panes failed: ${err.message}`);
    return;
  }

  // Build a pane_id → coord lookup from the live list-panes output.
  // Used to resolve a sidecar pane_id to a current send-keys coord.
  const paneIdToCoord = {};
  for (const t of targets) {
    if (t.paneId) paneIdToCoord[t.paneId] = t.coord;
  }

  // Read the sidecar written by chq-tmux.sh at pane creation time.
  // Keys are agents.json ids; values carry the stable pane_id (%N).
  const sidecar = readPaneSidecar();

  let sendTo = [];
  if (isAll) {
    sendTo = targets.map(t => t.coord);
  } else {
    for (const agent of selectedAgents) {
      // Strategy 1: resolve via sidecar pane_id — stable across renames.
      const sidecarEntry = sidecar[agent.id];
      if (sidecarEntry && sidecarEntry.pane_id && paneIdToCoord[sidecarEntry.pane_id]) {
        sendTo.push(paneIdToCoord[sidecarEntry.pane_id]);
        continue;
      }
      // Strategy 2: fall back to pane-title substring match (covers panes not
      // yet in the sidecar — e.g. static agent-factory entries that chq-tmux.sh
      // doesn't register, or sessions started before this version was deployed).
      const needle = (agent.tmuxTarget || '').toLowerCase();
      if (!needle) continue;
      const match = targets.find(t => t.title.toLowerCase().includes(needle));
      if (match) {
        sendTo.push(match.coord);
      } else {
        console.warn(`[broadcast] no pane matches agent=${agent.id} (sidecar miss + tmuxTarget=${needle} miss)`);
      }
    }
  }

  for (const coord of sendTo) {
    // Two send-keys calls: first types the literal message (so claude's TUI
    // input box receives the characters), then presses Enter as a separate
    // keystroke to submit. A single combined call (`message Enter`) typed
    // the text but didn't submit reliably against claude's TUI — Richard
    // reported the input sat in the box unsubmitted. The launch-agent.sh
    // auto-inject sequence uses the same split-call pattern (matches the
    // legacy per-agent scripts that worked).
    execFile('tmux', ['send-keys', '-t', coord, '-l', message], (err, _o, ser) => {
      if (err) {
        console.error(`[broadcast] send-keys (text) ${coord} failed: ${ser || err.message}`);
        return;
      }
      execFile('tmux', ['send-keys', '-t', coord, 'Enter'], (err2, _o2, ser2) => {
        if (err2) console.error(`[broadcast] send-keys (Enter) ${coord} failed: ${ser2 || err2.message}`);
      });
    });
  }
});

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

  // Build pane_id → pane lookup for sidecar resolution.
  const paneById = {};
  for (const p of panes) {
    if (p.paneId) paneById[p.paneId] = p;
  }
  const sidecar = readPaneSidecar();

  // Match each agent → its pane (if any), then derive the session.
  // Strategy 1: stable pane_id via sidecar. Strategy 2: pane-title fallback.
  const matches = agents.map(a => {
    // Sidecar path — preferred (stable across renames).
    const sc = sidecar[a.id];
    if (sc && sc.pane_id && paneById[sc.pane_id]) {
      const session = paneById[sc.pane_id].coord.split(':')[0];
      return { id: a.id, running: true, session };
    }
    // Title-grep fallback — covers non-sidecar panes.
    const needle = (a.tmuxTarget || '').toLowerCase();
    if (!needle) return { id: a.id, running: false, session: null };
    const pane = panes.find(p => p.title.toLowerCase().includes(needle));
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

  return matches.map(m => ({
    id: m.id,
    running: m.running,
    attached: m.session ? !!attachedBySession[m.session] : false
  }));
});

// ---------------------------------------------------------------------------
// Spawn IPC — hardened against shell injection
// ---------------------------------------------------------------------------
// Use chq-tmux.sh's `add` subcommand (not `start`) — `add` creates the session
// if missing OR appends panes to an existing one. The old `start` path bailed
// with "Session already exists" when chq was already up, which was the root
// cause of the "Deploy doesn't work after first deploy" bug — clicking the
// claude button (or any agent) once chq existed was a silent no-op.
ipcMain.on('spawn-agents', (event, payload) => {
  // Back-compat: payload may be a bare array of agent ids (legacy renderer)
  // or { agents, layout } (post-v2.5 settings popover with layout checkboxes).
  const agents = Array.isArray(payload) ? payload : (payload && payload.agents);
  const layoutRaw = (payload && payload.layout) || '';
  const safeAgents = (agents || []).filter(a => /^[a-z0-9_-]+$/i.test(a));
  if (safeAgents.length === 0) return;

  // Whitelist layout — passed through to chq-tmux.sh as CHQ_LAYOUT env var.
  // 'tiled' added 2026-05-03 for the deploy-preview overlay (auto-balanced grid
  // via tmux select-layout tiled after spawn).
  const layout = ['panes', 'windows', 'ittab', 'tiled'].includes(layoutRaw) ? layoutRaw : 'panes';

  execFile('bash', [CHQ_SCRIPT, 'add', ...safeAgents], { env: { ...process.env, TMUX_AUTO_ATTACH: '0', CHQ_LAYOUT: layout } }, (err, stdout, stderr) => {
    if (err) {
      console.error(`[spawn] chq-tmux add failed: ${stderr || err.message}`);
      return;
    }
    console.log(`[spawn] ${stdout.trim()}`);
    // Bug Richard reported 2026-05-03: clicking Deploy multiple times piled
    // every batch into a fresh iTerm tab — "you put them all on different
    // tabs, so i gotta go move em each time." Root cause: the previous
    // implementation ALWAYS ran `create tab with default profile` here
    // unconditionally on every Deploy, even when an iTerm session attached
    // to chq already existed. The tmux session WAS shared (cmd_add appends
    // panes/windows to chq), but each Deploy opened a NEW tab attached
    // to the same chq, so iTerm rendered N redundant attached views.
    //
    // Fix: ask tmux whether the chq session already has a client attached.
    // If yes, don't spawn ANYTHING in iTerm — the user already has a tab
    // showing chq, and tmux just grew it under the hood. We only activate
    // iTerm so it surfaces; the existing tab stays in place.
    // If no, spawn a fresh iTerm tab attached to chq (first Deploy, or
    // user closed the previous tab).
    //
    // This is more reliable than scraping iTerm session names — tmux is
    // the source of truth for "is anyone watching this session".
    execFile('tmux', ['list-clients', '-t', 'chq', '-F', '#{client_name}'], (errLC, lcOut) => {
      const hasClient = !errLC && lcOut.split('\n').some(l => l.trim().length > 0);
      if (hasClient) {
        // Someone (likely iTerm) is already attached. Just bring iTerm
        // forward so the existing tab is visible — no new tab spawn.
        execFile('osascript', ['-e', 'tell application "iTerm" to activate'], () => {});
        return;
      }
      // No client attached — open a fresh iTerm tab and run chq-tmux attach.
      // CHQ_SCRIPT is a fixed path; safeAgents are id-validated. The
      // AppleScript source is a single literal — no user input flows in.
      const apple = `tell application "iTerm"
        activate
        if (count of windows) is 0 then
          set newWindow to (create window with default profile)
        else
          set newWindow to current window
          tell newWindow to create tab with default profile
        end if
        tell current session of newWindow
          write text "bash ${CHQ_SCRIPT} attach"
        end tell
      end tell`;
      execFile('osascript', ['-e', apple], (err2, _o, e2) => {
        if (err2) console.error(`[spawn] osascript attach failed: ${e2 || err2.message}`);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Add-agent IPC — append a registry entry + copy avatar SVG into assets/
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
    const startupSlash = (payload.startupSlash === undefined || payload.startupSlash === null)
      ? '/gogo'
      : String(payload.startupSlash).trim();
    const avatarSrc = payload.avatarSrc ? String(payload.avatarSrc) : null;

    // Guard against id collisions.
    const existing = loadAgents();
    if (existing.some(a => a.id === id)) throw new Error(`agent id "${id}" already exists`);

    // Copy avatar if provided. If not, the button will fall back to the
    // first letter of the display name (handled in the renderer).
    let avatarFilename = null;
    if (avatarSrc && fs.existsSync(avatarSrc)) {
      avatarFilename = `${id}.svg`;
      fs.copyFileSync(avatarSrc, path.join(ASSETS_DIR, avatarFilename));
    }

    // Append to agents.json atomically.
    writeRegistry(data => {
      const entry = {
        id,
        display_name: displayName,
        cwd,
        color,
        startup_slash: startupSlash
      };
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

// Remove-agent IPC — strip from agents.json. SVG stays in remote-app/assets/
// so re-adding an agent finds the avatar still there (an earlier auto-archive
// to deprecated/assets/ silently vanished avatars on re-add). SVG cleanup is
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

// Restart-agent IPC — non-destructive. Sends Ctrl-C to the agent's tmux pane;
// chq-tmux.sh's restart loop respawns claude in 3s. Mirrors what
// `chq-tmux.sh restart <name>` does, but we route through tmux directly here
// because the chq-tmux.sh restart subcommand uses the wname (registry id) and
// addresses the pane as `chq:0:<wname>` — which doesn't always match after
// claude's /rename mutates the title. Resolving by tmux_target substring
// (same rule as broadcast targeting) is more robust.
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

    const panes = await listPanes();
    const needle = (agent.tmuxTarget || '').toLowerCase();
    const match = panes.find(p => p.title.toLowerCase().includes(needle));
    if (!match) throw new Error(`${agent.displayName || safeId} isn't running in chq — Deploy it first`);

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
// uses this to toggle auto_restart and edit color / rename_to / startup_slash.
// Whitelist the writable fields so a renderer bug can't clobber load-bearing
// keys like display_name or cwd. Booleans are coerced; strings are trimmed.
const UPDATABLE_FIELDS = {
  auto_restart:  v => Boolean(v),
  color:         v => String(v || '').trim().toLowerCase(),
  rename_to:     v => String(v || '').trim(),
  startup_slash: v => String(v || '').trim()
};
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
      cleanPatch[k] = coerce(v);
    }
    if (Object.keys(cleanPatch).length === 0) throw new Error('no updatable fields in patch');

    let updatedEntry = null;
    writeRegistry(data => {
      const entry = (data.agents || []).find(a => a.id === safeId);
      if (!entry) throw new Error(`agent "${safeId}" not in registry`);
      Object.assign(entry, cleanPatch);
      updatedEntry = entry;
    });
    return { ok: true, entry: updatedEntry };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// File pickers for the Add Agent form.
ipcMain.handle('pick-svg', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pick avatar SVG',
    filters: [{ name: 'SVG', extensions: ['svg'] }],
    properties: ['openFile']
  });
  return result.canceled ? null : result.filePaths[0];
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

    const panes = await listPanes();
    const needle = (agent.tmuxTarget || '').toLowerCase();
    const matches = panes.filter(p => p.title.toLowerCase().includes(needle));
    if (matches.length === 0) throw new Error(`${agent.displayName || safeId} isn't running in chq — Deploy it first`);

    // Kill all matching panes (in case there are multiple — e.g. if the same
    // agent ended up duplicated across windows). Each kill-pane is its own
    // execFile call, no shell. Reap bg pids BEFORE killing the pane.
    for (const m of matches) {
      await reapAgentBgPids(safeId, m.paneId);
      await new Promise((resolve, reject) => {
        execFile('tmux', ['kill-pane', '-t', m.coord], (err, _o, ser) => {
          if (err) return reject(new Error(ser || err.message));
          resolve();
        });
      });
    }
    return { ok: true, killed: matches.map(m => m.coord) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// attach-pane — focus the user's cursor onto the agent's tmux pane in iTerm.
// Layout-aware behavior:
//
//   1. ALWAYS run `tmux select-pane -t <coord>` first on the host so server-
//      side state reflects the desired active pane. select-pane with a fully-
//      qualified coord (session:window.pane) switches the active window AND
//      pane in one call — works for `panes`, `windows`, and `ittab` layouts.
//
//   2. Try to focus an EXISTING iTerm session whose name contains the agent's
//      tmuxTarget (iTerm session names mirror the tmux pane title). This is
//      the right path when:
//        - The user already has an iTerm window/tab attached (which they
//          almost always do — the chq fleet boots into one), or
//        - The agent is in `ittab` layout where each agent already has its
//          own iTerm window from `tmux -CC` spawn.
//      If found: select that session, no new tab spawn.
//
//   3. Only if no iTerm session matches do we open a new tab and run
//      `tmux attach -t <session>` (panes/windows) or `tmux -CC attach`
//      (ittab — matches `chq-tmux.sh attach` behavior so iTerm renders
//      windows-per-tmux-window).
//
// The previous implementation chained `tmux attach \; select-pane` in one
// shell command — but `\;` collapses to `;` in shell parse, splitting it
// into two sequential commands. The first `tmux attach` BLOCKED, then on
// detach the `select-pane` ran outside any tmux session. Fixed by running
// `select-pane` server-side on the host BEFORE invoking iTerm at all.
ipcMain.handle('attach-pane', async (event, id) => {
  try {
    const safeId = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid id');

    const agentList = loadAgents();
    const agent = agentList.find(a => a.id === safeId);
    if (!agent) throw new Error(`agent "${safeId}" not in registry`);

    const panes = await listPanes();
    const needle = (agent.tmuxTarget || '').toLowerCase();
    const match = panes.find(p => p.title.toLowerCase().includes(needle));
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

    // Step 1 — set active pane server-side. Works across panes/windows/ittab.
    await new Promise((resolve, reject) => {
      execFile('tmux', ['select-pane', '-t', match.coord], (err, _o, ser) => {
        if (err) return reject(new Error(ser || err.message));
        resolve();
      });
    });

    // Step 2 — try to focus an existing iTerm session whose name matches the
    // agent's pane title needle. Returns "found" or "not-found".
    //
    // Quoting note: the needle goes through agentList's tmuxTarget, which is
    // derived from registry rename_to / display_name (validated lowercased
    // ascii in writeRegistry). Belt + suspenders — re-validate before letting
    // it touch an AppleScript literal.
    if (!/^[a-z0-9_-]+$/i.test(needle)) {
      throw new Error(`refusing to interpolate suspicious needle: ${needle}`);
    }
    const focusScript = `tell application "iTerm"
      activate
      repeat with w in windows
        repeat with t in tabs of w
          repeat with s in sessions of t
            if (name of s) contains "${needle}" then
              tell w to select
              tell t to select
              tell s to select
              return "found"
            end if
          end repeat
        end repeat
      end repeat
      return "not-found"
    end tell`;
    const focusResult = await new Promise((resolve) => {
      execFile('osascript', ['-e', focusScript], (err, stdout) => {
        if (err) return resolve('not-found');                  // graceful fallback
        resolve((stdout || '').trim());
      });
    });

    if (focusResult === 'found') {
      return { ok: true, coord: match.coord, mode: 'focused-existing' };
    }

    // Step 3 — no existing iTerm session matched. Open a new one and attach.
    // Read the layout for ittab → tmux -CC; everything else → plain attach.
    const layout = await new Promise((resolve) => {
      execFile('tmux', ['show-option', '-t', sessionName, '-v', '-q', '@chq_layout'], (err, stdout) => {
        if (err) return resolve('');
        resolve((stdout || '').trim());
      });
    });
    const attachCmd = (layout === 'ittab')
      ? `tmux -CC attach -t ${sessionName}`
      : `tmux attach -t ${sessionName}`;

    const spawnScript = `tell application "iTerm"
      activate
      if (count of windows) is 0 then
        set newWindow to (create window with default profile)
      else
        set newWindow to current window
        tell newWindow to create tab with default profile
      end if
      tell current session of newWindow
        write text "${attachCmd}"
      end tell
    end tell`;
    await new Promise((resolve, reject) => {
      execFile('osascript', ['-e', spawnScript], (err, _o, ser) => {
        if (err) return reject(new Error(ser || err.message));
        resolve();
      });
    });
    return { ok: true, coord: match.coord, mode: 'spawned-new' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// kill-session — destructive: tear down the entire chq tmux session via
// `tmux kill-session -t chq`. Equivalent to `bash chq-tmux.sh stop` but skips
// the shell wrapper and goes straight at tmux. This is the panel-level
// counterpart to the per-agent kill-pane IPC.
//
// Why we need this: chq-tmux.sh stashes the user's chosen layout in
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
    execFile('tmux', ['kill-session', '-t', 'chq'], (err, _o, ser) => {
      if (err) {
        // "no server running" or "session not found" — both are benign:
        // there was nothing to kill, the desired end-state already holds.
        const msg = ser || err.message || '';
        if (/no server running|can't find session|session not found/i.test(msg)) {
          return resolve({ ok: true, killed: false });
        }
        return resolve({ ok: false, error: msg });
      }
      resolve({ ok: true, killed: true });
    });
  });
});

// get-session-layout — returns the value stashed in tmux's @chq_layout option
// at session start time (one of 'panes' | 'windows' | 'ittab'), or '' if no
// session is running.
//
// If the session exists but @chq_layout was never set (legacy session, or
// session created outside chq-tmux.sh), returns 'unknown' — a sentinel that
// tells the renderer "session is up but I can't tell what layout" so the
// stop button still enables but the mismatch hint stays off.
//
// Used by the renderer to show a visual hint on the layout-pills when the
// user's currently-selected pill differs from the running session's layout —
// telegraphs "your pill choice won't take effect until you tear down the
// running session". Polled alongside pane-status on the 3s status loop.
ipcMain.handle('get-session-layout', async () => {
  return new Promise((resolve) => {
    // First check the layout option directly — fastest path, single tmux call.
    execFile('tmux', ['show-option', '-t', 'chq', '-v', '-q', '@chq_layout'], (err, stdout) => {
      if (err) {
        // tmux exited non-zero → no server, no chq session, or option missing.
        // The -q flag suppresses the "unknown option" diagnostic but doesn't
        // change exit status; bail to "no session" by default.
        return resolve('');
      }
      const v = (stdout || '').trim();
      if (v) return resolve(v);
      // Option came back empty. The session might still exist with an unset
      // layout — confirm by checking session presence.
      execFile('tmux', ['has-session', '-t', 'chq'], (err2) => {
        if (err2) return resolve('');                 // genuinely no session
        return resolve('unknown');                    // session up, layout unstashed
      });
    });
  });
});

// detach-pane-to-window — break the agent's pane out of its current window
// into its own new window in the same session. Useful when the panel of
// agents is too cramped (5-6 horizontal slivers in one window) and you want
// the agent on its own screen. Equivalent of tmux's `Ctrl-b !`.
ipcMain.handle('detach-pane-to-window', async (event, id) => {
  try {
    const safeId = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid id');

    const agentList = loadAgents();
    const agent = agentList.find(a => a.id === safeId);
    if (!agent) throw new Error(`agent "${safeId}" not in registry`);

    const panes = await listPanes();
    const needle = (agent.tmuxTarget || '').toLowerCase();
    const match = panes.find(p => p.title.toLowerCase().includes(needle));
    if (!match) throw new Error(`${agent.displayName || safeId} isn't running in chq — Deploy it first`);

    // -P prints the new window's target id (session:window). -d keeps focus
    // on the original window — user can switch with Ctrl-b N.
    const newWin = await new Promise((resolve, reject) => {
      execFile('tmux', ['break-pane', '-d', '-s', match.coord, '-P', '-F', '#{session_name}:#{window_index}'], (err, stdout, ser) => {
        if (err) return reject(new Error(ser || err.message));
        resolve(stdout.trim());
      });
    });
    return { ok: true, newWindow: newWin, fromCoord: match.coord };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// detach-pane-to-split — move the agent's pane into another window in the
// session as a horizontal split. If `targetWindow` (e.g. "chq:1") is omitted,
// picks the lowest-indexed window in the session that isn't the source.
// Useful for "I want this agent next to that other agent in a fresh layout"
// without touching tmux directly.
ipcMain.handle('detach-pane-to-split', async (event, { id, targetWindow } = {}) => {
  try {
    const safeId = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid id');

    const agentList = loadAgents();
    const agent = agentList.find(a => a.id === safeId);
    if (!agent) throw new Error(`agent "${safeId}" not in registry`);

    const panes = await listPanes();
    const needle = (agent.tmuxTarget || '').toLowerCase();
    const match = panes.find(p => p.title.toLowerCase().includes(needle));
    if (!match) throw new Error(`${agent.displayName || safeId} isn't running in chq — Deploy it first`);

    const sessionName = match.coord.split(':')[0];
    const sourceWindow = match.coord.split('.')[0];   // session:window

    let dest = targetWindow;
    if (!dest) {
      const sessionWindows = [...new Set(panes.map(p => p.coord.split('.')[0]))]
        .filter(w => w.startsWith(`${sessionName}:`) && w !== sourceWindow)
        .sort();
      dest = sessionWindows[0];
    }
    if (!dest) throw new Error('no other window in session to split into; use detach-to-window first');
    if (!/^[a-z0-9_:.-]+$/i.test(dest)) throw new Error(`refusing suspicious target window: ${dest}`);

    // join-pane handles break+join atomically when -s refers to a pane in
    // another window. -h splits horizontally.
    await new Promise((resolve, reject) => {
      execFile('tmux', ['join-pane', '-h', '-s', match.coord, '-t', dest], (err, _o, ser) => {
        if (err) return reject(new Error(ser || err.message));
        resolve();
      });
    });
    return { ok: true, fromCoord: match.coord, joinedTo: dest };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

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
      }, 50);
    });
    chatWatcher.on('error', (err) => {
      logToOutLog(`chat fs.watch error: ${err.message}`);
    });
  } catch (err) {
    logToOutLog(`startChatWatcher: fs.watch failed (${err.message}); heartbeat fallback in renderer covers it`);
  }
}
app.on('before-quit', () => {
  if (chatWatchDebounce) { clearTimeout(chatWatchDebounce); chatWatchDebounce = null; }
  if (chatWatcher) { try { chatWatcher.close(); } catch { /* already closed */ } chatWatcher = null; }
});
