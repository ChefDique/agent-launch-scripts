function quoteAppleScriptString(value) {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const AGENTREMOTE_ITERM_VIEWER_MARKER = 'AgentRemote Viewer';

// Legacy guard, retained ONLY for buildITermTwoByTwoScript (the unused 2x2
// control-mode layout). The single-window viewer intentionally uses PLAIN
// `tmux attach` now, so buildITermAttachScript no longer applies this guard.
function rejectPlainTmuxAttachCommand(command) {
  if (/\btmux\s+attach\b/.test(command) && !/\btmux\s+-CC\s+attach\b/.test(command)) {
    throw new Error('AgentRemote iTerm viewer commands must not use plain tmux attach');
  }
}

// Build the AppleScript that creates or reuses the single marked AgentRemote
// iTerm viewer window and runs `command` in it. The single-window deploy passes
// a PLAIN `tmux attach -t <session>` (see plainAttachViewerCommand in main.js):
// one iTerm window of tiled tmux panes. This replaced the iTerm `-CC`
// control-mode attach, which opened a gateway window PLUS a window per tmux
// window (BUG B). Plain attach is therefore allowed here — the old guard that
// rejected plain `tmux attach` was removed because it described the broken
// control-mode model.
function buildITermAttachScript(command) {
  const safeCommand = String(command || '').trim();
  if (!safeCommand) throw new Error('iTerm attach command is required');
  const quotedCommand = quoteAppleScriptString(safeCommand);
  const quotedMarker = quoteAppleScriptString(AGENTREMOTE_ITERM_VIEWER_MARKER);

  return `tell application "iTerm"
  activate
  set markerName to ${quotedMarker}
  set targetWindow to missing value
  set targetSession to missing value
  repeat with candidateWindow in windows
    repeat with candidateTab in tabs of candidateWindow
      repeat with candidateSession in sessions of candidateTab
        try
          if (name of candidateSession as text) contains markerName then
            set targetWindow to candidateWindow
            exit repeat
          end if
        end try
      end repeat
      if targetWindow is not missing value then exit repeat
    end repeat
    if targetWindow is not missing value then exit repeat
  end repeat
  if targetWindow is missing value then
    create window with default profile
    set targetWindow to current window
    set targetSession to current session of targetWindow
  else
    tell targetWindow
      create tab with default profile
      set targetSession to current session
    end tell
  end if
  set miniaturized of targetWindow to false
  tell targetSession
    set name to markerName
    write text ${quotedCommand}
  end tell
end tell`;
}

// Fully CLOSE the marked AgentRemote iTerm viewer window. Called when killing
// the last live pane empties its tmux window. Previously this only miniaturized
// the window, so a `[tmux detached]` / hidden viewer survived "Close" (BUG A).
// With the plain-attach viewer, closing the iTerm window just detaches the tmux
// client — the tmux session and any remaining agents are unaffected — so it is
// safe to fully close whenever a window is released.
function buildITermCloseMarkedViewerScript(marker = AGENTREMOTE_ITERM_VIEWER_MARKER) {
  const safeMarker = String(marker || '').trim();
  if (!safeMarker) throw new Error('iTerm viewer marker is required');
  const quotedMarker = quoteAppleScriptString(safeMarker);

  return `tell application "iTerm"
  set markerName to ${quotedMarker}
  repeat with candidateWindow in windows
    repeat with candidateTab in tabs of candidateWindow
      repeat with candidateSession in sessions of candidateTab
        try
          if (name of candidateSession as text) contains markerName then
            close candidateWindow
            exit repeat
          end if
        end try
      end repeat
    end repeat
  end repeat
end tell`;
}

function buildITermTwoByTwoScript(commands, marker = AGENTREMOTE_ITERM_VIEWER_MARKER) {
  const safeCommands = (Array.isArray(commands) ? commands : [])
    .map(command => String(command || '').trim())
    .filter(Boolean);
  if (safeCommands.length === 0) throw new Error('at least one pane command is required');
  if (safeCommands.length > 4) throw new Error('2x2 iTerm layout supports at most four pane commands');
  safeCommands.forEach(rejectPlainTmuxAttachCommand);

  const quotedMarker = quoteAppleScriptString(marker);
  const quoted = safeCommands.map(quoteAppleScriptString);
  const paneLines = [];
  if (quoted[1]) {
    paneLines.push(
      '    set rightPane to (split vertically with default profile)',
      '    tell rightPane',
      '      set name to markerName',
      `      write text ${quoted[1]}`,
      '    end tell'
    );
  }
  if (quoted[2]) {
    paneLines.push(
      '    set bottomLeft to (split horizontally with default profile)',
      '    tell bottomLeft',
      '      set name to markerName',
      `      write text ${quoted[2]}`,
      '    end tell'
    );
  }
  if (quoted[3]) {
    paneLines.push(
      '    tell rightPane',
      '      set bottomRight to (split horizontally with default profile)',
      '      tell bottomRight',
      '        set name to markerName',
      `        write text ${quoted[3]}`,
      '      end tell',
      '    end tell'
    );
  }

  return `tell application "iTerm"
  activate
  set markerName to ${quotedMarker}
  set targetWindow to missing value
  repeat with candidateWindow in windows
    repeat with candidateTab in tabs of candidateWindow
      repeat with candidateSession in sessions of candidateTab
        try
          if (name of candidateSession as text) contains markerName then
            set targetWindow to candidateWindow
            exit repeat
          end if
        end try
      end repeat
      if targetWindow is not missing value then exit repeat
    end repeat
    if targetWindow is not missing value then exit repeat
  end repeat
  if targetWindow is missing value then
    create window with default profile
    set targetWindow to current window
  end if
  tell current session of targetWindow
    set name to markerName
    write text ${quoted[0]}
${paneLines.join('\n')}
  end tell
end tell`;
}

module.exports = {
  AGENTREMOTE_ITERM_VIEWER_MARKER,
  buildITermAttachScript,
  buildITermCloseMarkedViewerScript,
  buildITermTwoByTwoScript,
  quoteAppleScriptString
};
