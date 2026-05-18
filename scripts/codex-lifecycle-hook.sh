#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/codex-lifecycle-hook.sh --event <PostToolUse|UserPromptSubmit|Stop> [--dry-run]

Conservative Codex lifecycle hook.

It emits hook additionalContext when it sees:
  - all plan/todo items completed,
  - repeated shell/tool failures in the same cwd,
  - user closeout language such as /done or closeout.

It does not run /chores or /done itself. Hooks should nudge; the lead agent
must perform the lifecycle skill so handoff/session files stay intentional.
USAGE
}

EVENT="${CODEX_HOOK_EVENT_NAME:-${HOOK_EVENT_NAME:-}}"
DRY_RUN=0
STATE_DIR="${CODEX_LIFECYCLE_STATE_DIR:-$HOME/.codex/lifecycle-hooks}"
FAILURE_THRESHOLD="${CODEX_LIFECYCLE_FAILURE_THRESHOLD:-2}"

while (($#)); do
  case "$1" in
    --event)
      EVENT="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "codex-lifecycle-hook: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

if [[ -t 0 ]]; then
  INPUT_JSON="{}"
else
  INPUT_JSON="$(cat 2>/dev/null || true)"
  [[ -n "$INPUT_JSON" ]] || INPUT_JSON="{}"
fi

json_query() {
  local query="$1"
  jq -r "$query" <<< "$INPUT_JSON" 2>/dev/null || true
}

first_string() {
  local query="$1"
  local value
  value="$(json_query "$query" | sed -n '1p')"
  [[ "$value" != "null" ]] || value=""
  printf '%s' "$value"
}

lower_payload="$(
  jq -r '[.. | strings] | join("\n") | ascii_downcase' <<< "$INPUT_JSON" 2>/dev/null || true
)"

CWD_VALUE="$(
  first_string '
    first(
      .cwd?,
      .workdir?,
      .workspace?,
      .workspace_root?,
      .workspaceRoot?,
      .session.cwd?,
      .payload.cwd?,
      .tool_input.workdir?,
      .toolInput.workdir?,
      empty
    )
  '
)"
[[ -n "$CWD_VALUE" ]] || CWD_VALUE="$PWD"

TOOL_NAME="${TOOL_NAME:-}"
if [[ -z "$TOOL_NAME" ]]; then
  TOOL_NAME="$(
    first_string '
      first(
        .tool_name?,
        .toolName?,
        .tool?,
        .name?,
        .payload.tool_name?,
        .payload.name?,
        empty
      )
    '
  )"
fi

EXIT_CODE_VALUE="${EXIT_CODE:-}"
if [[ -z "$EXIT_CODE_VALUE" ]]; then
  EXIT_CODE_VALUE="$(
    first_string '
      first(
        .exit_code?,
        .exitCode?,
        .status?,
        .payload.exit_code?,
        .payload.exitCode?,
        empty
      )
    '
  )"
fi
if [[ ! "$EXIT_CODE_VALUE" =~ ^[0-9]+$ ]]; then
  EXIT_CODE_VALUE="$(
    grep -Eo 'Process exited with code [0-9]+' <<< "$lower_payload" 2>/dev/null \
      | awk '{print $5}' \
      | tail -1 \
      || true
  )"
fi
[[ "$EXIT_CODE_VALUE" =~ ^[0-9]+$ ]] || EXIT_CODE_VALUE=""

safe_key() {
  printf '%s' "$1" | tr '/:[:space:]' '____' | tr -cd '[:alnum:]_.-'
}

state_file() {
  local key
  key="$(safe_key "$CWD_VALUE")"
  printf '%s/%s.state' "$STATE_DIR" "$key"
}

emit_context() {
  local message="$1"
  if ((DRY_RUN)); then
    printf 'DRY_RUN %s\n' "$message"
  else
    jq -n --arg additionalContext "$message" '{additionalContext: $additionalContext}'
  fi
}

plan_total="$(
  jq '[.. | objects | .plan? | arrays | .[]?] | length' <<< "$INPUT_JSON" 2>/dev/null || echo 0
)"
plan_completed="$(
  jq '[.. | objects | .plan? | arrays | .[]? | select(.status == "completed")] | length' <<< "$INPUT_JSON" 2>/dev/null || echo 0
)"
todo_total="$(
  jq '[.. | objects | .todos? | arrays | .[]?] | length' <<< "$INPUT_JSON" 2>/dev/null || echo 0
)"
todo_completed="$(
  jq '[.. | objects | .todos? | arrays | .[]? | select(.status == "completed")] | length' <<< "$INPUT_JSON" 2>/dev/null || echo 0
)"

is_shell_tool=0
case "$TOOL_NAME" in
  Bash|bash|Shell|shell|exec_command|functions.exec_command|developer.exec_command)
    is_shell_tool=1
    ;;
esac

mkdir -p "$STATE_DIR" 2>/dev/null || true
STATE_FILE="$(state_file)"

case "$EVENT" in
  PostToolUse|post_tool_use|post-tool-use)
    if [[ "$plan_total" =~ ^[0-9]+$ && "$plan_total" -gt 0 && "$plan_completed" -eq "$plan_total" ]]; then
      printf 'pending_completion=1\nreason=plan_complete\n' > "$STATE_FILE" 2>/dev/null || true
      emit_context "LIFECYCLE CHECKPOINT: all current plan items are completed. If this is a major task boundary, run /chores now; if this is session closeout, run /done. Update the session log before starting a new major task."
      exit 0
    fi

    if [[ "$todo_total" =~ ^[0-9]+$ && "$todo_total" -gt 0 && "$todo_completed" -eq "$todo_total" ]]; then
      printf 'pending_completion=1\nreason=todo_complete\n' > "$STATE_FILE" 2>/dev/null || true
      emit_context "LIFECYCLE CHECKPOINT: all current todos are completed. If this is a major task boundary, run /chores now; if this is session closeout, run /done. Update the session log before starting a new major task."
      exit 0
    fi

    if ((is_shell_tool)) && [[ -n "$EXIT_CODE_VALUE" ]]; then
      if [[ "$EXIT_CODE_VALUE" -eq 0 ]]; then
        rm -f "$STATE_FILE" 2>/dev/null || true
        exit 0
      fi

      current_failures=0
      if [[ -f "$STATE_FILE" ]]; then
        current_failures="$(awk -F= '$1 == "failures" {print $2}' "$STATE_FILE" 2>/dev/null | tail -1)"
      fi
      [[ "$current_failures" =~ ^[0-9]+$ ]] || current_failures=0
      current_failures=$((current_failures + 1))
      {
        printf 'failures=%s\n' "$current_failures"
        printf 'last_exit=%s\n' "$EXIT_CODE_VALUE"
        printf 'reason=tool_failure\n'
      } > "$STATE_FILE" 2>/dev/null || true

      if [[ "$current_failures" -ge "$FAILURE_THRESHOLD" ]]; then
        emit_context "LIFECYCLE CHECKPOINT: ${current_failures} consecutive shell/tool failures in this cwd. If this is a real task failure or blocked path, stop debugging drift, run /chores, and record the failure state plus next diagnostic step before continuing."
      fi
    fi
    ;;

  UserPromptSubmit|user_prompt_submit|user-prompt-submit)
    if grep -Eiq '(^|[^[:alnum:]_])(/done|done status|closeout|close out|end session|wrap up|major task is done|task is done|task complete|task failed|blocked path|failure state)([^[:alnum:]_]|$)' <<< "$lower_payload"; then
      emit_context "LIFECYCLE CHECKPOINT: the prompt looks like a completion, failure, or closeout boundary. Use /chores for mid-session cleanup or /done for final closeout before moving on."
    fi
    ;;

  Stop|stop)
    if [[ "${CODEX_LIFECYCLE_STOP_NUDGE:-0}" == "1" && -f "$STATE_FILE" ]]; then
      emit_context "LIFECYCLE CHECKPOINT: a prior completion/failure signal is still pending for this cwd. Run /chores or /done before ending the session."
    fi
    ;;

  ""|*)
    if ((DRY_RUN)); then
      emit_context "LIFECYCLE CHECKPOINT: hook parsed input for cwd=${CWD_VALUE}; no lifecycle boundary matched."
    fi
    ;;
esac

exit 0
