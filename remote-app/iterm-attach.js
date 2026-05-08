function quoteAppleScriptString(value) {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const AGENTREMOTE_ITERM_VIEWER_MARKER = 'AgentRemote CHQ Viewer';

function rejectPlainTmuxAttachCommand(command) {
  if (/\btmux\s+attach\b/.test(command) && !/\btmux\s+-CC\s+attach\b/.test(command)) {
    throw new Error('AgentRemote iTerm viewer commands must not use plain tmux attach');
  }
}

function buildITermAttachScript(command) {
  const safeCommand = String(command || '').trim();
  if (!safeCommand) throw new Error('iTerm attach command is required');
  rejectPlainTmuxAttachCommand(safeCommand);
  const quotedCommand = quoteAppleScriptString(safeCommand);
  const quotedMarker = quoteAppleScriptString(AGENTREMOTE_ITERM_VIEWER_MARKER);

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
    write text ${quotedCommand}
  end tell
end tell`;
}

function buildITermHideMarkedViewerScript(marker = AGENTREMOTE_ITERM_VIEWER_MARKER) {
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
            set miniaturized of candidateWindow to true
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
  buildITermHideMarkedViewerScript,
  buildITermTwoByTwoScript,
  quoteAppleScriptString
};
