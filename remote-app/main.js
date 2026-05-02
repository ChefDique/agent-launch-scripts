const { app, BrowserWindow, ipcMain, Menu, session } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const REGISTRY_PATH = path.join(__dirname, '..', 'agents.json');
const CHQ_SCRIPT = path.join(__dirname, '..', 'chq-tmux.sh');

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
      color: a.color || null
    }));
  } catch (err) {
    console.error(`[remote] failed to read registry ${REGISTRY_PATH}: ${err.message}`);
    return [];
  }
}

function createWindow() {
  session.defaultSession.clearCache();

  mainWindow = new BrowserWindow({
    width: 540,
    height: 180,
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
// Registry IPC — renderer asks for the agent list at boot
// ---------------------------------------------------------------------------
ipcMain.handle('get-agents', () => loadAgents());

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

// ---------------------------------------------------------------------------
// Spawn IPC — hardened against shell injection
// ---------------------------------------------------------------------------
// Old code did: `bash "${scriptPath}" start ${agents.join(' ')}` — a malicious
// or accidental backtick / $() in an agent id would have run arbitrary code.
// Now: agents pass through as separate argv entries to bash.
//
// The osascript leg still uses a string template because AppleScript itself
// requires its source as a single arg; we strip everything but [a-z0-9-] from
// the agent ids (they have to match registry ids anyway) before interpolation.
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
