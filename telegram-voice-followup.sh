#!/usr/bin/env bash
# PostToolUse hook — Telegram voice follow-up
#
# Triggered by: matcher = mcp__plugin_telegram_telegram__reply
# Trigger context: any CC agent calls the Telegram reply tool to send a message
#                  to Richard. After the text reply lands, this hook synthesizes
#                  voice via local Kokoro (Apache-2.0) and sends as a separate
#                  voice bubble in the same chat.
#
# Per Richard directive 2026-04-26 msg 463: "every agent that's got telegram
# to have this auto reply (with voice and text)".
#
# Environment:
#   KOKORO_VOICE       per-agent voice (e.g. af_heart / bm_george / am_onyx / am_michael).
#                      Default: af_heart (Aria / default female fallback).
#   KOKORO_SPEED       optional Kokoro playback speed. Default: 1.15.
#   TELEGRAM_BOT_TOKEN bot token for the project's bot. Required — silent skip
#                      if missing (do not block the parent reply on hook failure).
#
# Failure handling: log to /tmp/telegram-voice-followup-errors.log + exit 0.
# Never block the parent reply by exiting non-zero.
#
# Stdin: JSON from CC PostToolUse hook protocol:
#   { "tool_name": "...", "tool_input": { "chat_id": "...", "text": "..." }, ... }

set -uo pipefail

LOG="/tmp/telegram-voice-followup-errors.log"
exec 2>>"$LOG"

INPUT=$(cat)

TEXT=$(echo "$INPUT" | jq -r '.tool_input.text // ""' 2>/dev/null || echo "")
CHAT_ID=$(echo "$INPUT" | jq -r '.tool_input.chat_id // ""' 2>/dev/null || echo "")

# Skip if no text or no chat_id (defensive — should always be present per the matcher)
[ -z "$TEXT" ] && { echo "$(date -u +%FT%TZ) skip: empty text" ; exit 0 ; }
[ -z "$CHAT_ID" ] && { echo "$(date -u +%FT%TZ) skip: empty chat_id" ; exit 0 ; }

VOICE="${KOKORO_VOICE:-af_heart}"
SPEED="${KOKORO_SPEED:-1.15}"
TOKEN="${TELEGRAM_BOT_TOKEN:-}"

# Legacy Claude-side lookup path for quad-code launch flows.
# Hermes profiles use ~/.hermes/profiles/*/.env instead; do not conflate them.
if [ -z "$TOKEN" ] && [ -f "$HOME/.claude/channels/telegram-routing.env" ]; then
  . "$HOME/.claude/channels/telegram-routing.env" 2>/dev/null || true
  TOKEN="${TELEGRAM_BOT_TOKEN:-}"
fi
if [ -z "$TOKEN" ] && [ -f "$HOME/.zshrc.local" ]; then
  . "$HOME/.zshrc.local" 2>/dev/null || true
  TOKEN="${TELEGRAM_BOT_TOKEN:-}"
fi

[ -z "$TOKEN" ] && { echo "$(date -u +%FT%TZ) skip: no TELEGRAM_BOT_TOKEN in env or fallback files" ; exit 0 ; }

KOKORO_PY="$HOME/ai_projects/tools/kokoro/.venv311/bin/python3.11"
KOKORO_HELPER="$HOME/ai_projects/tools/kokoro/examples/telegram_kokoro_tts.py"

# Pre-flight: make sure Kokoro is available
[ -x "$KOKORO_PY" ] || { echo "$(date -u +%FT%TZ) skip: kokoro venv missing at $KOKORO_PY" ; exit 0 ; }
[ -f "$KOKORO_HELPER" ] || { echo "$(date -u +%FT%TZ) skip: kokoro helper missing at $KOKORO_HELPER" ; exit 0 ; }

TS=$(date +%s)
OGG="/tmp/agent-voice-${TS}-$$.ogg"

# Generate voice. Background safe — if Kokoro fails, log + skip the curl.
"$KOKORO_PY" "$KOKORO_HELPER" \
  --text "$TEXT" \
  --output "$OGG" \
  --voice "$VOICE" \
  --speed "$SPEED" >/dev/null 2>>"$LOG"

if [ ! -s "$OGG" ]; then
  echo "$(date -u +%FT%TZ) skip: kokoro produced no audio for voice=$VOICE text=${TEXT:0:60}"
  exit 0
fi

# Send voice via Telegram Bot API. sendVoice renders as voice bubble in the chat.
curl -s -F "chat_id=$CHAT_ID" -F "voice=@$OGG" \
  "https://api.telegram.org/bot${TOKEN}/sendVoice" >/dev/null 2>>"$LOG" || \
    echo "$(date -u +%FT%TZ) curl failed for chat_id=$CHAT_ID voice=$VOICE"

# Cleanup
rm -f "$OGG"

exit 0
