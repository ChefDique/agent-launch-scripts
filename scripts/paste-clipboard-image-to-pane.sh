#!/usr/bin/env bash
set -euo pipefail

pane="${1:-${TMUX_PANE:-}}"
if [[ -z "$pane" ]]; then
  pane="$(tmux display-message -p '#{pane_id}' 2>/dev/null || true)"
fi
if [[ -z "$pane" ]]; then
  echo "paste-clipboard-image-to-pane: no target tmux pane" >&2
  exit 2
fi

out_dir="${TMPDIR:-/tmp}/agentremote-pasted-images"
mkdir -p "$out_dir"
stamp="$(date +%s)"
suffix="$(LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c 8 || true)"
suffix="${suffix:-$$}"
png_path="${out_dir}/paste-${stamp}-${suffix}.png"
tiff_path="${out_dir}/paste-${stamp}-${suffix}.tiff"

kind="$(
  osascript - "$png_path" "$tiff_path" <<'OSA' 2>/dev/null || true
on writeData(imageData, outputPath)
  set outputFile to open for access (POSIX file outputPath) with write permission
  try
    set eof of outputFile to 0
    write imageData to outputFile
  on error errText
    try
      close access outputFile
    end try
    error errText
  end try
  close access outputFile
end writeData

on run argv
  set pngPath to item 1 of argv
  set tiffPath to item 2 of argv
  try
    set pngData to the clipboard as «class PNGf»
    my writeData(pngData, pngPath)
    return "png"
  on error
    try
      set tiffData to the clipboard as «class TIFF»
      my writeData(tiffData, tiffPath)
      return "tiff"
    on error
      return "none"
    end try
  end try
end run
OSA
)"

case "$kind" in
  png)
    ;;
  tiff)
    if ! command -v sips >/dev/null 2>&1; then
      echo "paste-clipboard-image-to-pane: clipboard image is TIFF but sips is unavailable" >&2
      exit 3
    fi
    sips -s format png "$tiff_path" --out "$png_path" >/dev/null
    rm -f "$tiff_path"
    ;;
  *)
    rm -f "$png_path" "$tiff_path"
    text="$(pbpaste 2>/dev/null || true)"
    if [[ -n "$text" ]]; then
      tmux send-keys -t "$pane" -l "$text"
      exit 0
    fi
    tmux display-message -t "$pane" "AgentRemote: clipboard has no text or image"
    exit 1
    ;;
esac

tmux send-keys -t "$pane" -l "[image: ${png_path}]"
