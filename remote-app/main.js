const { app, BrowserWindow, ipcMain, Menu, session, dialog } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.join(__dirname, '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'agents.json');
const CHQ_SCRIPT = path.join(REPO_ROOT, 'chq-tmux.sh');
const ASSETS_DIR = path.join(__dirname, 'assets');
const DEPRECATED_ASSETS_DIR = path.join(REPO_ROOT, 'deprecated', 'assets');

let mainWindow;

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
      // tmux pane title after claude's /rename runs. launch-agent.sh defaults
      // /rename to display_name uppercased, but the pane title is then
      // whatever was passed to /rename — which equals tmux_target if set,
      // otherwise lowercased display_name. Match that here.
      tmuxTarget: a.tmux_target || a.display_name.toLowerCase(),
      color: a.color || null,
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

function createWindow() {
  session.defaultSession.clearCache();

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

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Reload', click: () => { mainWindow.webContents.reloadIgnoringCache(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit(); } }
  ]);
  mainWindow.webContents.on('context-menu', () => { contextMenu.popup(); });
}

app.on('ready', createWindow);
app.on('window-all-closed', () => { app.quit(); });

// ---------------------------------------------------------------------------
// Registry IPC — renderer asks for the agent list at boot AND after add/remove
// ---------------------------------------------------------------------------
ipcMain.handle('get-agents', () => loadAgents());

// Resize the BrowserWindow to fit the rendered DOM. Renderer measures itself
// then sends {width, height}. Cap to a sensible max so the window can't
// accidentally explode if a CSS bug returns an absurd height.
ipcMain.on('resize-window', (event, { width, height }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const w = Math.max(380, Math.min(1200, Math.round(width || 620)));
  const h = Math.max(180, Math.min(900, Math.round(height || 240)));
  mainWindow.setContentSize(w, h, true);
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
ipcMain.on('broadcast-message', async (event, { message, selectedAgents, isAll }) => {
  if (!message || (!isAll && (!selectedAgents || selectedAgents.length === 0))) return;

  let targets = [];
  try {
    targets = await listPanes();
  } catch (err) {
    console.error(`[broadcast] tmux list-panes failed: ${err.message}`);
    return;
  }

  let sendTo = [];
  if (isAll) {
    sendTo = targets.map(t => t.coord);
  } else {
    for (const agent of selectedAgents) {
      const needle = (agent.tmuxTarget || '').toLowerCase();
      if (!needle) continue;
      const match = targets.find(t => t.title.toLowerCase().includes(needle));
      if (match) {
        sendTo.push(match.coord);
      } else {
        console.warn(`[broadcast] no pane matches tmuxTarget=${needle}`);
      }
    }
  }

  for (const coord of sendTo) {
    execFile('tmux', ['send-keys', '-t', coord, message, 'C-m'], (err, stdout, stderr) => {
      if (err) console.error(`[broadcast] send-keys ${coord} failed: ${stderr || err.message}`);
    });
  }
});

// listPanes() — promise wrapper around `tmux list-panes -a -F '...'`. Returns
// [{ coord, title }, ...]. Uses a tab separator inside the format string so
// pane titles containing spaces don't break the parse.
function listPanes() {
  return new Promise((resolve, reject) => {
    const fmt = '#{session_name}:#{window_index}.#{pane_index}\t#{pane_title}';
    execFile('tmux', ['list-panes', '-a', '-F', fmt], (err, stdout, stderr) => {
      if (err) {
        // No tmux server running is a benign "no targets" — return empty.
        if (/no server running/i.test(stderr || '')) return resolve([]);
        return reject(new Error(stderr || err.message));
      }
      const out = stdout.split('\n').filter(Boolean).map(line => {
        const tab = line.indexOf('\t');
        if (tab < 0) return null;
        return { coord: line.slice(0, tab), title: line.slice(tab + 1) };
      }).filter(Boolean);
      resolve(out);
    });
  });
}

// pane-status — return [{ id, running }] for each registry agent. Used by the
// renderer's 3s status-dot poller. Substring match against pane titles, same
// rule as broadcast resolution. Cheap: one tmux call per poll.
ipcMain.handle('pane-status', async () => {
  const agents = loadAgents();
  let panes = [];
  try { panes = await listPanes(); } catch { return agents.map(a => ({ id: a.id, running: false })); }
  return agents.map(a => {
    const needle = (a.tmuxTarget || '').toLowerCase();
    const running = needle ? panes.some(p => p.title.toLowerCase().includes(needle)) : false;
    return { id: a.id, running };
  });
});

// ---------------------------------------------------------------------------
// Spawn IPC — hardened against shell injection
// ---------------------------------------------------------------------------
// Use chq-tmux.sh's `add` subcommand (not `start`) — `add` creates the session
// if missing OR appends panes to an existing one. The old `start` path bailed
// with "Session already exists" when chq was already up, which was the root
// cause of the "Deploy doesn't work after first deploy" bug — clicking the
// claude button (or any agent) once chq existed was a silent no-op.
ipcMain.on('spawn-agents', (event, agents) => {
  const safeAgents = (agents || []).filter(a => /^[a-z0-9_-]+$/i.test(a));
  if (safeAgents.length === 0) return;

  execFile('bash', [CHQ_SCRIPT, 'add', ...safeAgents], { env: { ...process.env, TMUX_AUTO_ATTACH: '0' } }, (err, stdout, stderr) => {
    if (err) {
      console.error(`[spawn] chq-tmux add failed: ${stderr || err.message}`);
      return;
    }
    console.log(`[spawn] ${stdout.trim()}`);
    // Then open an iTerm tab and attach. CHQ_SCRIPT is a fixed path; safeAgents
    // are id-validated. The AppleScript source is a single literal — no user
    // input flows into it.
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

// Remove-agent IPC — strip from agents.json, archive the SVG to deprecated/.
// We don't touch the agent's actual project dir (that's user data, not ours
// to manage). The pane in tmux, if running, is also untouched — Richard can
// kill it manually via chq-tmux.sh restart or by Ctrl-C in the pane.
ipcMain.handle('remove-agent', async (event, id) => {
  try {
    const safeId = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(safeId)) throw new Error('invalid id');

    let removedAvatar = null;
    writeRegistry(data => {
      const before = data.agents.length;
      data.agents = data.agents.filter(a => {
        if (a.id === safeId) {
          removedAvatar = a.avatar || `${safeId}.svg`;
          return false;
        }
        return true;
      });
      if (data.agents.length === before) throw new Error(`agent id "${safeId}" not found`);
    });

    if (removedAvatar) {
      const src = path.join(ASSETS_DIR, removedAvatar);
      if (fs.existsSync(src)) {
        if (!fs.existsSync(DEPRECATED_ASSETS_DIR)) fs.mkdirSync(DEPRECATED_ASSETS_DIR, { recursive: true });
        const dst = path.join(DEPRECATED_ASSETS_DIR, removedAvatar);
        try { fs.renameSync(src, dst); } catch { /* cross-volume? ignore */ }
      }
    }
    return { ok: true };
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
