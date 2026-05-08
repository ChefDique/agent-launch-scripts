const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('add-agent form contains harness logo picker and Armory import affordance', () => {
  assert.match(html, /id="f-harness-picker"/);
  assert.match(html, /id="armory-import-btn"/);
  assert.match(html, /Import from Armory/);
});

test('add-agent form supports image avatars and harness mascot fallback', () => {
  assert.match(html, /optional image or gif path/);
  assert.match(html, /pick-avatar/);
  assert.match(html, /avatarFileForAgent/);
  assert.match(html, /harnessOptionFor\(agent\.runtime/);
});

test('popup surfaces include explicit close buttons and hidden restore copy is intentional', () => {
  assert.match(html, /id="f-close"/);
  assert.match(html, /id="chat-close-btn"/);
  assert.match(html, /id="settings-close-btn"/);
  assert.match(html, /\$\{hiddenAgentOrder\.length\} hidden/);
  assert.doesNotMatch(html, /··· \$\{hiddenAgentOrder\.length\}/);
});

test('dock add control is rendered as a two-line add-agent tile', () => {
  assert.match(html, /add-agent-tile/);
  assert.match(html, /<span class="add-plus">\+<\/span> ADD/);
  assert.match(html, /<span>AGENT<\/span>/);
});

test('right-click settings routes to the shared add/edit form', () => {
  assert.match(html, /function openEditAgentForm\(id\)/);
  assert.match(html, /action: \(\) => openEditAgentForm\(id\)/);
  assert.match(html, /id="f-autorestart"/);
  assert.match(html, /update-agent-form/);
});

test('agent pets are per-agent and use the Codex pet roster instead of a hard-coded companion', () => {
  assert.match(html, /id="agent-pet-layer"/);
  assert.match(html, /id="f-pet"/);
  assert.match(html, /className = 'pet-toggle'/);
  assert.match(html, /list-codex-pets/);
  assert.match(html, /load-agent-pet-state/);
  assert.match(html, /set-agent-pet-selection/);
  assert.match(html, /show-agent-pet/);
  assert.match(html, /hide-agent-pet/);
  assert.doesNotMatch(html, /openPetPicker/);
  assert.doesNotMatch(html, /agentRemoteVisiblePets/);
  assert.doesNotMatch(html, /id="codex-pet"/);
  assert.doesNotMatch(html, /professor-xavier/);
  assert.doesNotMatch(html, /codeberg/);
  assert.doesNotMatch(html, /agent\.id === 'tmux-masta'/);
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'assets', 'pets', 'goku')), false);
});

test('dock labels and chat identity are registry-driven, not hard-coded by agent id', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const petWindow = fs.readFileSync(path.join(__dirname, '..', 'pet-window.html'), 'utf8');

  assert.match(html, /return String\(agent\.displayName \|\| agent\.id \|\| ''\)/);
  assert.doesNotMatch(html, /CHAT_FROM_COLORS/);
  assert.doesNotMatch(html, /overlordswarmy/);
  assert.doesNotMatch(petWindow, /overlordswarmy/);
  assert.doesNotMatch(main, /professor-xavier/);
  assert.doesNotMatch(main, /codeberg/);
  assert.doesNotMatch(main, /agent\.id === 'tmux-masta'/);
});

test('floating pet window has draggable sprite, mini log, close, and reply controls', () => {
  const petWindow = fs.readFileSync(path.join(__dirname, '..', 'pet-window.html'), 'utf8');
  assert.match(petWindow, /id="sprite"/);
  assert.match(petWindow, /id="log"/);
  assert.match(petWindow, /id="close"/);
  assert.match(petWindow, /id="collapse"/);
  assert.match(petWindow, /id="chat-tab"/);
  assert.match(petWindow, /id="reply-toggle"/);
  assert.match(petWindow, /id="reply"/);
  assert.match(petWindow, /chat-expanded/);
  assert.match(petWindow, /chat-collapsed/);
  assert.match(petWindow, /function agentAliases\(\)/);
  assert.match(petWindow, /function petAliases\(\)/);
  assert.match(petWindow, /function messageMentionsAlias\(message, aliases\)/);
  assert.match(petWindow, /chatTailOffset = res\.offset \|\| 0/);
  assert.match(petWindow, /renderMessages\(\[\], false\)/);
  assert.doesNotMatch(petWindow, /from === 'richard'/);
  assert.match(petWindow, /body\.chat-expanded \.sprite-wrap/);
  assert.match(petWindow, /min-height: min\(156px, calc\(100vh - 148px\)\)/);
  assert.match(petWindow, /chat-meta/);
  assert.match(petWindow, /pet-resize-window/);
  assert.match(petWindow, /overflow-wrap: anywhere/);
  assert.match(petWindow, /resize-grip/);
  assert.match(petWindow, /pet-send-message/);
  assert.match(petWindow, /chat-tail-init/);
  assert.match(petWindow, /pet-pane-tail/);
  assert.match(petWindow, /function renderPaneLines\(lines\)/);
  assert.doesNotMatch(petWindow, /class="bubble-head"/);
});

test('main process pet windows are resizable and broadcasts delay submit after literal text', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.match(main, /resizable: true/);
  assert.match(main, /const PET_WINDOW_GEOMETRY = \{/);
  assert.match(main, /minWidth: PET_WINDOW_GEOMETRY\.minWidth/);
  assert.match(main, /function clampPetWindowSize\(width, height, fallback = \{\}\)/);
  assert.match(main, /pet-resize-window/);
  assert.match(main, /payload\.anchorX === 'center'/);
  assert.match(main, /payload\.anchorY === 'bottom'/);
  assert.match(main, /pet-set-mood/);
  assert.match(main, /pet-window-moving/);
  assert.match(main, /safeTmuxWindowLabel/);
  assert.match(main, /labelTmuxPaneWindow/);
  assert.match(main, /updatePaneSidecarEntry/);
  assert.match(main, /selectTarget = match\.paneId/);
  assert.match(main, /execFile\('tmux', \['switch-client', '-c', client\.name, '-t', windowTarget\]/);
  assert.match(main, /mode: 'control-mode-focus'/);
  assert.doesNotMatch(main, /mode: 'focused-existing'/);
  assert.doesNotMatch(main, /split vertically with default profile command/);
  assert.match(main, /send-keys', '-t', coord, '-l', message/);
  assert.match(main, /setTimeout\(\(\) => \{/);
  assert.match(main, /send-keys', '-t', coord, 'C-m'/);
});

test('chat input paste persists clipboard images as local file references', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.match(html, /addEventListener\('paste', handleChatImagePaste\)/);
  assert.match(html, /function handleChatImagePaste/);
  assert.match(html, /item\.kind === 'file' && \/\^image\\\//);
  assert.match(html, /ipcRenderer\.invoke\('save-pasted-image'/);
  assert.match(html, /ipcRenderer\.invoke\('save-native-clipboard-image'/);
  assert.match(html, /\[image: \$\{result\.path\}\]/);
  assert.match(main, /ipcMain\.handle\('save-pasted-image'/);
  assert.match(main, /ipcMain\.handle\('save-native-clipboard-image'/);
  assert.match(main, /clipboard\.readImage\(\)/);
  assert.match(main, /agentremote-pasted-images/);
});

test('embedded terminal intercepts paste and sends clipboard text or image references to the agent pane', () => {
  assert.match(html, /function pasteClipboardIntoAgentPane/);
  assert.match(html, /host\.addEventListener\('paste', handleTerminalPaste, true\)/);
  assert.match(html, /clipboardData\.getData\('text\/plain'\)/);
  assert.match(html, /term\.attachCustomKeyEventHandler/);
  assert.match(html, /read-clipboard-text/);
  assert.match(html, /saveNativeClipboardImageReference/);
  assert.match(html, /ipcRenderer\.send\('pane-input', \{ id: agentId, data: marker \}\)/);
});

test('floating pet chat uses clean team chat stream and supports pasted images', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const petWindow = fs.readFileSync(path.join(__dirname, '..', 'pet-window.html'), 'utf8');
  assert.match(main, /ipcMain\.handle\('pet-pane-tail'/);
  assert.match(main, /capture-pane', '-p', '-J', '-S', '-80'/);
  assert.doesNotMatch(petWindow, /await refreshPaneTail\(true\)/);
  assert.doesNotMatch(petWindow, /await refreshPaneTail\(false\)/);
  assert.match(petWindow, /function maybeScrollToBottom/);
  assert.match(petWindow, /isNearLogBottom/);
  assert.match(petWindow, /lastPaneTailFingerprint/);
  assert.match(petWindow, /addEventListener\('paste', handleReplyImagePaste\)/);
  assert.match(petWindow, /item\.kind === 'file' && \/\^image\\\//);
  assert.match(petWindow, /ipcRenderer\.invoke\('save-pasted-image'/);
  assert.match(petWindow, /ipcRenderer\.invoke\('save-native-clipboard-image'/);
  assert.match(petWindow, /\[image: \$\{result\.path\}\]/);
});

test('floating pet window maps Codex atlas rows and move events to moods', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const petWindow = fs.readFileSync(path.join(__dirname, '..', 'pet-window.html'), 'utf8');
  assert.match(petWindow, /const PET_ATLAS = \{/);
  assert.match(petWindow, /columns: 8/);
  assert.match(petWindow, /rows: 9/);
  assert.match(petWindow, /scale: 0\.5/);
  assert.match(petWindow, /sourceCell: \{ width: 192, height: 208 \}/);
  assert.match(petWindow, /function applyAtlasGeometry\(\)/);
  assert.match(petWindow, /function applyAtlasMood\(mood\)/);
  assert.doesNotMatch(petWindow, /background-size: 768px 936px/);
  assert.doesNotMatch(petWindow, /--pet-y: -104px/);
  assert.match(petWindow, /'running-right': \{ row: 1, frames: 8/);
  assert.match(petWindow, /'running-left': \{ row: 2, frames: 8/);
  assert.match(petWindow, /waving: \{ row: 3, frames: 4/);
  assert.match(petWindow, /jumping: \{ row: 4, frames: 5/);
  assert.match(petWindow, /failed: \{ row: 5, frames: 8/);
  assert.match(petWindow, /waiting: \{ row: 6, frames: 6/);
  assert.match(petWindow, /running: \{ row: 7, frames: 6/);
  assert.match(petWindow, /review: \{ row: 8, frames: 6/);
  assert.match(petWindow, /document\.body\.classList\.add\(`mood-\$\{next\}`\)/);
  assert.match(petWindow, /pet-window-moving/);
  assert.match(petWindow, /pet-window-bounds/);
  assert.match(petWindow, /pet-moving/);
  assert.match(petWindow, /pet-picked-up/);
  assert.match(petWindow, /released: 'jumping'/);
  assert.match(main, /petWindowGeometryPayload/);
  assert.match(main, /PET_BUBBLE_EDGE_THRESHOLD/);
  assert.match(main, /bubblePlacement = topGap <= PET_BUBBLE_EDGE_THRESHOLD/);
  assert.match(html, /sendPetWindowMood/);
  assert.match(html, /sendPetWindowMood\(a\.id, 'review'\)/);
  assert.match(html, /sendPetWindowMood\(a\.id, 'sent', 1400\)/);
});

test('floating pet chat bubble adapts above or below based on window bounds', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const petWindow = fs.readFileSync(path.join(__dirname, '..', 'pet-window.html'), 'utf8');
  assert.match(petWindow, /function applyBubblePlacement\(placement\)/);
  assert.match(petWindow, /body\.bubble-below \.pet-shell/);
  assert.match(petWindow, /body\.bubble-below \.sprite-wrap/);
  assert.match(petWindow, /body\.bubble-below \.bubble/);
  assert.match(petWindow, /classList\.toggle\('bubble-below', below\)/);
  assert.match(main, /screen\.getPrimaryDisplay\(\)/);
  assert.match(main, /sendToPetWindow\(agent\.id, 'pet-window-bounds', movePayload\)/);
  assert.match(main, /sendPetWindowGeometry\(agentId, win\)/);
  assert.match(main, /function clampPetWindowBoundsToVisibleDisplay\(bounds\)/);
  assert.match(main, /settlePetWindowBounds\(agent\.id, win\)/);
  assert.match(main, /PET_WORKAREA_SAFETY/);
});

test('deploy surface exposes team, separate-tabs, and even-panes operator paths', () => {
  assert.match(html, /data-layout="teams"/);
  assert.match(html, /data-layout="ittab"/);
  assert.match(html, /data-layout="panes"/);
  assert.match(html, />Teams<\/button>/);
  assert.match(html, />Tabs<\/button>/);
  assert.match(html, />Panes<\/button>/);
  assert.match(html, /id="layout-pills".*role="radiogroup"/s);
  assert.match(html, /data-layout="teams"[^>]*role="radio"[^>]*aria-checked="true"/);
  assert.match(html, /data-layout="ittab"[^>]*role="radio"[^>]*aria-checked="false"/);
  assert.match(html, /data-layout="panes"[^>]*role="radio"[^>]*aria-checked="false"/);
  assert.match(html, /class="deploy-layout-card" data-layout="teams" role="radio" aria-checked="true"/);
  assert.match(html, /balanced team windows/);
  assert.match(html, /Separate tabs/);
  assert.match(html, /Even panes/);
  assert.match(html, /solo tmux window/);
  assert.match(html, /joined in one balanced window/);
  assert.match(html, /ipcRenderer\.invoke\('spawn-agents'/);
  assert.match(html, /Deploy failed/);
  assert.doesNotMatch(html, /ipcRenderer\.send\('spawn-agents'/);
  assert.doesNotMatch(html, /data-layout="windows"/);
});

test('AgentRemote deploy routes through Swarmy runtime adapter in ai_projects', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.match(main, /SWARMY_RUNTIME_SCRIPT/);
  assert.match(main, /ai_projects', 'swarmy'/);
  assert.match(main, /agentremote_runtime\.py/);
  assert.match(main, /function swarmyRuntimeArgs\(\.\.\.args\)\s*\{\s*return \[\s*SWARMY_RUNTIME_SCRIPT,\s*'--session',\s*RUNTIME_SESSION,\s*'--registry',\s*REGISTRY_PATH,\s*'--sidecar',\s*SIDECAR_PATH,/s);
  assert.match(main, /swarmyRuntimeArgs\('add', '--layout', layout, \.\.\.safeAgents\)/);
  assert.match(main, /swarmyRuntimeArgs\('layout'\)/);
  assert.match(main, /swarmyRuntimeAttachCommand\(\)/);
  assert.match(main, /`python3 \${SWARMY_RUNTIME_SCRIPT} --session \${RUNTIME_SESSION} --registry \${REGISTRY_PATH} --sidecar \${SIDECAR_PATH} attach`/);
  assert.match(main, /viewerSafetyState\(layout, RUNTIME_SESSION\)/);
  assert.match(main, /needsViewerCleanup: true/);
  assert.match(main, /viewerSafetyState\('ittab', sessionName\)/);
  assert.match(main, /execFileP\('python3', swarmyRuntimeArgs\('add', '--layout', layout/);
  assert.match(main, /execFile\('python3', swarmyRuntimeArgs\('stop'\)/);
  assert.match(main, /execFile\('python3', swarmyRuntimeArgs\('layout'\),/);
  assert.doesNotMatch(main, /const CHQ_SCRIPT/);
  assert.doesNotMatch(main, /\\\/Users\\\/richardadair\\\/agent-launch-scripts/);
});

test('scrollable HUD popups use dark themed scrollbars', () => {
  const petWindow = fs.readFileSync(path.join(__dirname, '..', 'pet-window.html'), 'utf8');
  assert.match(html, /\*::-webkit-scrollbar-thumb/);
  assert.match(petWindow, /\*::-webkit-scrollbar-thumb/);
  assert.match(html, /\.deploy-roster,\s*\n\s*\.hidden-panel,/);
  assert.match(html, /\.deploy-roster::-webkit-scrollbar/);
  assert.match(html, /\.deploy-roster::-webkit-scrollbar-thumb/);
});

test('dock online state follows running pane, not attached iTerm client', () => {
  assert.match(html, /Online means the tmux pane\/process exists/);
  assert.match(html, /dot\.classList\.add\('on'\)/);
  assert.doesNotMatch(html, /dot\.classList\.add\(s\.attached \? 'on' : 'detached'\)/);
});

test('edit form allows agent id edits until the agent is running', () => {
  assert.match(html, /Stop this agent before changing its id/);
  assert.match(html, /originalId: editingAgentId/);
  assert.doesNotMatch(html, /idInput\.readOnly = agentFormMode === 'edit'/);
});
