function quoteAppleScriptString(value) {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildITermAttachScript(command) {
  const safeCommand = String(command || '').trim();
  if (!safeCommand) throw new Error('iTerm attach command is required');
  const quotedCommand = quoteAppleScriptString(safeCommand);

  return `tell application "iTerm"
  activate
  if (count of windows) is 0 then
    create window with default profile
  else
    tell first window
      create tab with default profile
    end tell
  end if
  tell current session of first window
    write text ${quotedCommand}
  end tell
end tell`;
}

function buildITermFirstWindowAttachScript(command) {
  const safeCommand = String(command || '').trim();
  if (!safeCommand) throw new Error('iTerm attach command is required');
  const quotedCommand = quoteAppleScriptString(safeCommand);

  return `tell application "iTerm"
  activate
  if (count of windows) is 0 then
    create window with default profile
  end if
  tell current session of first window
    write text ${quotedCommand}
  end tell
end tell`;
}

module.exports = {
  buildITermAttachScript,
  buildITermFirstWindowAttachScript,
  quoteAppleScriptString
};
