const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { exec } = require('child_process');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480, // Increased from 320 to prevent clipping
    height: 120, // Increased to allow space for theme switcher above
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false, // CSS handles shadow for better precision
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.center();
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Quit Agent Remote', click: () => { app.quit(); } }
  ]);

  mainWindow.webContents.on('context-menu', () => {
    contextMenu.popup();
  });
}

app.whenReady().then(createWindow);

ipcMain.on('spawn-agents', (event, agents) => {
  if (agents.length === 0) return;
  const home = process.env.HOME;
  const scriptPath = path.join(home, 'agent-launch-scripts', 'chq-tmux.sh');
  const agentList = agents.join(' ');
  const startCmd = `bash "${scriptPath}" start ${agentList}`;
  
  exec(startCmd, (error) => {
    if (error) return;
    const attachCmd = `osascript -e '
      tell application "iTerm"
        activate
        if (count of windows) is 0 then
          set newWindow to (create window with default profile)
        else
          set newWindow to current window
          tell newWindow to create tab with default profile
        end if
        tell current session of newWindow
          write text "bash ${scriptPath} attach"
        end tell
      end tell'`;
    exec(attachCmd);
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
