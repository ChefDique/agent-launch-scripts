function quoteAppleScriptString(value) {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const AGENTREMOTE_ITERM_VIEWER_MARKER = 'AgentRemote CHQ Viewer';

function buildITermAttachScript(command) {
  const safeCommand = String(command || '').trim();
  if (!safeCommand) throw new Error('iTerm attach command is required');
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
  if (count of windows) is 0 then
    create window with default profile
    set targetWindow to current window
  else if targetWindow is missing value then
    create window with default profile
    set targetWindow to current window
  else
    tell targetWindow
      create tab with default profile
    end tell
  end if
  tell current session of targetWindow
    set name to markerName
    write text ${quotedCommand}
  end tell
end tell`;
}

module.exports = {
  AGENTREMOTE_ITERM_VIEWER_MARKER,
  buildITermAttachScript,
  quoteAppleScriptString
};
