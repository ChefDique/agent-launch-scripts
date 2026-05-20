#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/codex-lifecycle-hook.sh --event <SessionStart|PreToolUse|PostToolUse|PreCompact|PostCompact|Stop> [--dry-run]

Conservative Codex lifecycle hook.

It emits hook additionalContext when it sees:
  - Neo/Codex pre-tool attempts to edit outside this repo,
  - Neo/Codex pre-tool attempts to mutate live AgentRemote/iTerm/tmux state,
  - mutating work before startup/status alignment is recorded,
  - all plan/todo items completed,
  - repeated shell/tool failures in the same cwd,
  - compaction boundaries that need handoff discipline.

It does not run /chores or /done itself. Hooks should nudge; the lead agent
must perform the lifecycle skill so handoff/session files stay intentional.

Set CODEX_LIFECYCLE_OPERATOR_OVERRIDE=1 only when Richard explicitly approves
the cross-repo or live desktop mutation.
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CANONICAL_REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd -P)"
EVENT="${CODEX_HOOK_EVENT_NAME:-${HOOK_EVENT_NAME:-}}"
DRY_RUN=0
STATE_DIR="${CODEX_LIFECYCLE_STATE_DIR:-$HOME/.codex/lifecycle-hooks}"
FAILURE_THRESHOLD="${CODEX_LIFECYCLE_FAILURE_THRESHOLD:-2}"
GUARD_REPO_ROOT="${CODEX_LIFECYCLE_GUARD_REPO_ROOT:-}"
PROCESS_REGEX='(npm|pnpm|yarn|bun)[[:space:]].*(dev|start|watch|serve)|vite|next[[:space:]]+dev|webpack.*watch|nodemon|tsx[[:space:]]+watch|python[[:space:]]+-m[[:space:]]+http\.server|uvicorn|fastapi|electron|playwright|chrom(e|ium)|browser-use'

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
payload_text="$(
  jq -r '[.. | strings] | join("\n")' <<< "$INPUT_JSON" 2>/dev/null || true
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

TOOL_COMMAND="$(
  first_string '
    first(
      .command?,
      .cmd?,
      .tool_input.command?,
      .tool_input.cmd?,
      .toolInput.command?,
      .toolInput.cmd?,
      .payload.command?,
      .payload.cmd?,
      empty
    )
  '
)"

STOP_HOOK_ACTIVE="$(
  first_string '
    first(
      .stop_hook_active?,
      .stopHookActive?,
      .payload.stop_hook_active?,
      .payload.stopHookActive?,
      empty
    )
  '
)"

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

emit_block() {
  local message="$1"
  if ((DRY_RUN)); then
    printf 'DRY_RUN GUARD BLOCK %s\n' "$message"
  else
    jq -n --arg reason "$message" \
      '{decision: "block", reason: $reason, additionalContext: $reason}'
  fi
}

repo_root_for_cwd() {
  local cwd="$1"
  [[ -d "$cwd" ]] || return 0
  git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || true
}

if [[ -z "$GUARD_REPO_ROOT" ]]; then
  GUARD_REPO_ROOT="$(repo_root_for_cwd "$CWD_VALUE")"
fi
[[ -n "$GUARD_REPO_ROOT" ]] || GUARD_REPO_ROOT="$CANONICAL_REPO_ROOT"

lane_root_for_repo() {
  local repo_root="$1"
  [[ -n "$repo_root" ]] || return 0

  local root
  local dir
  root="$(normalize_path "$repo_root" "$PWD")"
  dir="$(normalize_path "$CWD_VALUE" "$PWD")"
  [[ -f "$dir" ]] && dir="$(dirname "$dir")"

  if [[ "$dir" != "$root" && "$dir" != "$root/"* ]]; then
    dir="$root"
  fi

  while [[ "$dir" == "$root" || "$dir" == "$root/"* ]]; do
    if [[ -f "$dir/memory/handoff.md" || -f "$dir/.claude/memory/handoff.md" || -f "$dir/memory/tasks/tasks.json" ]]; then
      printf '%s\n' "$dir"
      return 0
    fi
    [[ "$dir" == "$root" ]] && break
    dir="$(dirname "$dir")"
  done

  printf '%s\n' "$root"
}

handoff_for_repo() {
  local repo_root="$1"
  [[ -n "$repo_root" ]] || return 0

  local lane_root
  lane_root="$(lane_root_for_repo "$repo_root")"

  if [[ -f "$lane_root/memory/handoff.md" ]]; then
    printf '%s\n' "$lane_root/memory/handoff.md"
  elif [[ -f "$lane_root/.claude/memory/handoff.md" ]]; then
    printf '%s\n' "$lane_root/.claude/memory/handoff.md"
  elif [[ -f "$repo_root/memory/handoff.md" ]]; then
    printf '%s\n' "$repo_root/memory/handoff.md"
  elif [[ -f "$repo_root/.claude/memory/handoff.md" ]]; then
    printf '%s\n' "$repo_root/.claude/memory/handoff.md"
  fi
}

taskboard_for_repo() {
  local repo_root="$1"
  [[ -n "$repo_root" ]] || return 0

  local lane_root
  lane_root="$(lane_root_for_repo "$repo_root")"

  if [[ -f "$lane_root/memory/tasks/tasks.json" ]]; then
    printf '%s\n' "$lane_root/memory/tasks/tasks.json"
  elif [[ -f "$repo_root/memory/tasks/tasks.json" ]]; then
    printf '%s\n' "$repo_root/memory/tasks/tasks.json"
  fi
}

relative_to_repo() {
  local path="$1"
  local repo_root="$2"
  if [[ -n "$repo_root" && "$path" == "$repo_root/"* ]]; then
    printf '%s\n' "${path#"$repo_root/"}"
  else
    printf '%s\n' "$path"
  fi
}

handoff_excerpt() {
  local path="$1"
  awk '
    /^## Active thread/ { in_active=1 }
    in_active { print }
    in_active && /^---$/ { exit }
  ' "$path" 2>/dev/null | sed -n '1,80p'
}

operator_override_enabled() {
  case "${CODEX_LIFECYCLE_OPERATOR_OVERRIDE:-}" in
    1|true|TRUE|yes|YES|explicit|EXPLICIT) return 0 ;;
    *) return 1 ;;
  esac
}

normalize_path() {
  local path="$1"
  local base="${2:-$PWD}"
  [[ -n "$path" ]] || return 1

  case "$path" in
    "~") path="$HOME" ;;
    ~/*) path="$HOME/${path#~/}" ;;
  esac
  if [[ "$path" != /* ]]; then
    path="${base%/}/$path"
  fi

  if [[ -d "$path" ]]; then
    (cd "$path" 2>/dev/null && pwd -P) || printf '%s\n' "$path"
    return 0
  fi

  local dir
  local name
  dir="$(dirname "$path")"
  name="$(basename "$path")"
  if [[ -d "$dir" ]]; then
    printf '%s/%s\n' "$(cd "$dir" 2>/dev/null && pwd -P)" "$name"
  else
    printf '%s\n' "$path"
  fi
}

file_sha256() {
  local path="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$path" 2>/dev/null | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path" 2>/dev/null | awk '{print $1}'
  fi
}

status_artifact_for_repo() {
  local repo_root="$1"
  [[ -n "$repo_root" ]] || return 0
  local lane_root
  lane_root="$(lane_root_for_repo "$repo_root")"

  if [[ -n "${CODEX_LIFECYCLE_STATUS_ARTIFACT:-}" ]]; then
    normalize_path "$CODEX_LIFECYCLE_STATUS_ARTIFACT" "$lane_root"
    return 0
  fi

  local candidate
  for candidate in \
    "$lane_root/memory/session-status.json" \
    "$lane_root/.claude/memory/session-status.json" \
    "$repo_root/memory/session-status.json" \
    "$repo_root/.claude/memory/session-status.json" \
    "$repo_root/.codex/session-status.json"; do
    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  if [[ -d "$lane_root/memory" ]]; then
    printf '%s\n' "$lane_root/memory/session-status.json"
  elif [[ -d "$lane_root/.claude/memory" ]]; then
    printf '%s\n' "$lane_root/.claude/memory/session-status.json"
  elif [[ -d "$repo_root/memory" ]]; then
    printf '%s\n' "$repo_root/memory/session-status.json"
  else
    printf '%s\n' "$repo_root/.codex/session-status.json"
  fi
}

json_field() {
  local path="$1"
  local query="$2"
  jq -r "$query // empty" "$path" 2>/dev/null | sed -n '1p'
}

startup_status_problem() {
  local repo_root="$1"
  local artifact
  local rel_artifact
  artifact="$(status_artifact_for_repo "$repo_root")"
  rel_artifact="$(relative_to_repo "$artifact" "$repo_root")"

  if [[ ! -f "$artifact" ]]; then
    printf 'missing startup/status artifact %s' "$rel_artifact"
    return 0
  fi
  if ! jq empty "$artifact" >/dev/null 2>&1; then
    printf 'startup/status artifact %s is not valid JSON' "$rel_artifact"
    return 0
  fi

  local missing=()
  local artifact_repo
  local artifact_lane
  local expected_root
  expected_root="$(lane_root_for_repo "$repo_root")"
  artifact_repo="$(json_field "$artifact" '.repo_root')"
  artifact_lane="$(json_field "$artifact" '.lane_root')"
  if [[ "$(normalize_path "$artifact_repo" "$repo_root")" != "$(normalize_path "$expected_root" "$PWD")" ]] \
    && [[ "$(normalize_path "$artifact_lane" "$repo_root")" != "$(normalize_path "$expected_root" "$PWD")" ]]; then
    missing+=("repo_root_or_lane_root")
  fi

  local field
  for field in lane active_goal status next_action updated_at; do
    [[ -n "$(json_field "$artifact" ".$field")" ]] || missing+=("$field")
  done

  local handoff_path
  handoff_path="$(handoff_for_repo "$repo_root")"
  if [[ -n "$handoff_path" ]]; then
    local recorded_handoff
    local recorded_sha
    local actual_sha
    recorded_handoff="$(json_field "$artifact" '.handoff.path')"
    recorded_sha="$(json_field "$artifact" '.handoff.sha256')"
    actual_sha="$(file_sha256 "$handoff_path")"
    if [[ -z "$recorded_handoff" ]] || [[ "$(normalize_path "$recorded_handoff" "$repo_root")" != "$(normalize_path "$handoff_path" "$repo_root")" ]]; then
      missing+=("handoff.path")
    fi
    if [[ -z "$recorded_sha" ]] || [[ -n "$actual_sha" && "$recorded_sha" != "$actual_sha" ]]; then
      missing+=("handoff.sha256")
    fi
    [[ -n "$(json_field "$artifact" '.handoff.read_at')" ]] || missing+=("handoff.read_at")
  else
    [[ -n "$(json_field "$artifact" '.handoff.absent_reason')" ]] || missing+=("handoff.absent_reason")
  fi

  local taskboard_path
  taskboard_path="$(taskboard_for_repo "$repo_root")"
  if [[ -n "$taskboard_path" ]]; then
    local recorded_taskboard
    local recorded_taskboard_sha
    local actual_taskboard_sha
    recorded_taskboard="$(json_field "$artifact" '.taskboard.path')"
    recorded_taskboard_sha="$(json_field "$artifact" '.taskboard.sha256')"
    actual_taskboard_sha="$(file_sha256 "$taskboard_path")"
    if [[ -z "$recorded_taskboard" ]] || [[ "$(normalize_path "$recorded_taskboard" "$expected_root")" != "$(normalize_path "$taskboard_path" "$expected_root")" ]]; then
      missing+=("taskboard.path")
    fi
    if [[ -z "$recorded_taskboard_sha" ]] || [[ -n "$actual_taskboard_sha" && "$recorded_taskboard_sha" != "$actual_taskboard_sha" ]]; then
      missing+=("taskboard.sha256")
    fi
    [[ -n "$(json_field "$artifact" '.taskboard.read_at')" ]] || missing+=("taskboard.read_at")
  fi

  if ((${#missing[@]} > 0)); then
    printf 'startup/status artifact %s is missing or stale fields: %s' "$rel_artifact" "$(IFS=,; printf '%s' "${missing[*]}")"
    return 0
  fi

  return 1
}

startup_artifact_write_intent() {
  local artifact
  local path
  artifact="$(status_artifact_for_repo "$GUARD_REPO_ROOT")"

  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    if [[ "$(normalize_path "$path" "$CWD_VALUE")" == "$(normalize_path "$artifact" "$GUARD_REPO_ROOT")" ]]; then
      return 0
    fi
  done < <(tool_paths)

  if ((is_shell_tool)) && grep -Eq '(^|/)(session-status\.json)([^[:alnum:]_.-]|$)' <<< "$(shell_command_text)"; then
    return 0
  fi

  return 1
}

status_is_terminal() {
  local artifact
  local status
  artifact="$(status_artifact_for_repo "$GUARD_REPO_ROOT")"
  [[ -f "$artifact" ]] || return 1
  status="$(json_field "$artifact" '.status' | tr '[:upper:]' '[:lower:]')"
  case "$status" in
    done|complete|completed|closed|idle|no_active_work) return 0 ;;
    *) return 1 ;;
  esac
}

status_summary() {
  local artifact
  artifact="$(status_artifact_for_repo "$GUARD_REPO_ROOT")"
  [[ -f "$artifact" ]] || return 0
  jq -r '
    "lane=" + (.lane // "<missing>") +
    " status=" + (.status // "<missing>") +
    " goal=" + (.active_goal // "<missing>") +
    " next_action=" + (.next_action // "<missing>")
  ' "$artifact" 2>/dev/null || true
}

process_snapshot_file() {
  printf '%s/%s.process-before' "$STATE_DIR" "$(safe_key "$CWD_VALUE")"
}

process_registry_file() {
  printf '%s/%s.processes.tsv' "$STATE_DIR" "$(safe_key "$CWD_VALUE")"
}

shell_command_may_leave_process() {
  ((is_shell_tool)) || return 1
  grep -Eiq "$PROCESS_REGEX|[[:space:]]&([[:space:]]|$)|nohup|disown" <<< "$(shell_command_text)"
}

snapshot_processes() {
  ps -axo pid=,ppid=,command= 2>/dev/null \
    | grep -Ei "$PROCESS_REGEX" \
    | grep -Ev 'grep -Ei|codex-lifecycle-hook|audit-codex-lifecycle-hooks' \
    | awk '{ pid=$1; ppid=$2; sub(/^[[:space:]]*[0-9]+[[:space:]]+[0-9]+[[:space:]]+/, "", $0); printf "%s\t%s\t%s\n", pid, ppid, $0 }' \
    || true
}

save_process_snapshot() {
  snapshot_processes > "$(process_snapshot_file)" 2>/dev/null || true
}

track_new_processes() {
  shell_command_may_leave_process || return 1
  local before
  local current
  local registry
  local now
  before="$(process_snapshot_file)"
  current="$(mktemp)"
  registry="$(process_registry_file)"
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  snapshot_processes > "$current" 2>/dev/null || true
  touch "$before" "$registry" 2>/dev/null || true
  awk -F '\t' -v now="$now" '
    FNR == NR { seen[$1]=1; next }
    !seen[$1] { printf "%s\t%s\t%s\t%s\n", now, $1, $2, $3 }
  ' "$before" "$current" >> "$registry" 2>/dev/null || true
  rm -f "$current" "$before" 2>/dev/null || true
}

process_keep_entry_valid() {
  local pid="$1"
  local artifact
  artifact="$(status_artifact_for_repo "$GUARD_REPO_ROOT")"
  [[ -f "$artifact" ]] || return 1
  jq -e --arg pid "$pid" '
    (.keep_running_processes // [])
    | any(
        ((.pid // "" | tostring) == $pid)
        and ((.reason // "") | length > 0)
        and ((.path // "") | length > 0)
        and ((.owner // "") | length > 0)
      )
  ' "$artifact" >/dev/null 2>&1
}

unkept_process_report() {
  local registry
  registry="$(process_registry_file)"
  [[ -f "$registry" ]] || return 1

  local line
  local started
  local pid
  local ppid
  local recorded
  local live
  local count=0
  while IFS=$'\t' read -r started pid ppid recorded; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    live="$(ps -p "$pid" -o command= 2>/dev/null | sed -n '1p' || true)"
    [[ -n "$live" ]] || continue
    process_keep_entry_valid "$pid" && continue
    printf 'pid=%s started=%s command=%s\n' "$pid" "$started" "$live"
    count=$((count + 1))
    [[ "$count" -ge 8 ]] && break
  done < "$registry"

  [[ "$count" -gt 0 ]]
}

path_is_inside_guard_repo() {
  local path="$1"
  local base="${2:-$CWD_VALUE}"
  local normalized
  local root
  normalized="$(normalize_path "$path" "$base")"
  root="$(normalize_path "$GUARD_REPO_ROOT" "$PWD")"
  [[ "$normalized" == "$root" || "$normalized" == "$root/"* ]]
}

cwd_is_inside_guard_repo() {
  path_is_inside_guard_repo "$CWD_VALUE" "$PWD"
}

guard_applies_to_session() {
  if [[ "${CODEX_LIFECYCLE_GUARD_DISABLED:-0}" == "1" ]]; then
    return 1
  fi

  case "${MESSAGE_AGENT_IDENTITY:-}" in
    neo|neo-codex|tmux-masta|tmux-masta-codex) return 0 ;;
  esac

  cwd_is_inside_guard_repo
}

is_write_tool() {
  case "$TOOL_NAME" in
    Write|write|Edit|edit|MultiEdit|multi_edit|NotebookEdit|apply_patch|functions.apply_patch)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

tool_paths() {
  jq -r '
    [
      .. | objects |
      .file_path?,
      .filePath?,
      .path?,
      .target_file?,
      .targetFile?
      | select(type == "string")
    ][]' <<< "$INPUT_JSON" 2>/dev/null || true
}

shell_command_text() {
  if [[ -n "$TOOL_COMMAND" ]]; then
    printf '%s\n' "$TOOL_COMMAND"
  else
    printf '%s\n' "$payload_text"
  fi
}

shell_command_mutates_files() {
  local text
  text="$(shell_command_text)"
  grep -Eiq '(^|[[:space:];|&])((apply_patch|rm|mv|cp|mkdir|touch|chmod|chown|tee)[[:space:]]|cat[[:space:]].*>|sed[[:space:]].*-i\b|perl[[:space:]].*-pi\b|git[[:space:]].*(add|commit|reset|checkout|switch|merge|rebase|push|pull)|npm[[:space:]].*(install|update)|pnpm[[:space:]].*(install|update)|yarn[[:space:]].*(add|install|upgrade)|pip[[:space:]].*install)' <<< "$text"
}

shell_command_mentions_cross_repo_path() {
  local text
  text="$(shell_command_text)"

  if cwd_is_inside_guard_repo && grep -Eq '(^|[[:space:];|&])\.\./' <<< "$text"; then
    return 0
  fi

  local token
  while IFS= read -r token; do
    token="${token%%[,\;\)\]\}\>]*}"
    [[ -n "$token" ]] || continue
    if ! path_is_inside_guard_repo "$token" "$CWD_VALUE"; then
      return 0
    fi
  done < <(
    awk '{
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^\/Users\/richardadair\/ai_projects\//) print $i
      }
    }' <<< "$text"
  )

  return 1
}

shell_command_mutates_live_surface() {
  local text
  text="$(shell_command_text)"
  grep -Eiq '(^|[[:space:];|&])(tmux[[:space:]].*(send-keys|paste-buffer|new-session|kill-session|kill-pane|attach|split-window|break-pane|join-pane|move-pane|resize-pane|rename-window|rename-session|set-option|set-environment|select-pane)|osascript[[:space:]].*(iterm|system events|terminal)|open[[:space:]].*-a[[:space:]]+iTerm|bash[[:space:]]+([^[:space:]]*/)?launch-remote\.sh|bash[[:space:]]+([^[:space:]]*/)?scripts/session-end-cleanup\.sh|bash[[:space:]]+([^[:space:]]*/)?scripts/cron-poke\.sh|bash[[:space:]]+([^[:space:]]*/)?scripts/paste-clipboard-image-to-pane\.sh|bash[[:space:]]+([^[:space:]]*/)?chq-tmux\.sh[[:space:]]+(start|stop|restart|attach|add)|agentremote_runtime\.py[[:space:]].*(deploy|attach|stop|start|layout|kill|restart))' <<< "$text"
}

mutating_tool_intent() {
  is_write_tool && return 0
  ((is_shell_tool)) && shell_command_mutates_files && return 0
  return 1
}

lifecycle_precondition_reason() {
  mutating_tool_intent || return 1
  cwd_is_inside_guard_repo || return 1
  startup_artifact_write_intent && return 1

  local status_problem
  if status_problem="$(startup_status_problem "$GUARD_REPO_ROOT")"; then
    printf 'Codex startup/lane precondition: refusing mutating work in %s because %s. Create or update %s with lane root, active_goal/status/next_action, handoff proof, and taskboard proof before proceeding.' \
      "$(lane_root_for_repo "$GUARD_REPO_ROOT")" \
      "$status_problem" \
      "$(relative_to_repo "$(status_artifact_for_repo "$GUARD_REPO_ROOT")" "$GUARD_REPO_ROOT")"
    return 0
  fi

  return 1
}

pre_tool_guard_reason() {
  guard_applies_to_session || return 1
  operator_override_enabled && return 1

  if is_write_tool; then
    local path
    local saw_path=0
    while IFS= read -r path; do
      [[ -n "$path" ]] || continue
      saw_path=1
      if ! path_is_inside_guard_repo "$path" "$CWD_VALUE"; then
        printf 'Neo/Codex scope guard: refusing %s on %s because this lane may only edit %s unless CODEX_LIFECYCLE_OPERATOR_OVERRIDE=1 is set by Richard.' "$TOOL_NAME" "$path" "$GUARD_REPO_ROOT"
        return 0
      fi
    done < <(tool_paths)

    if [[ "$saw_path" -eq 0 ]] && ! cwd_is_inside_guard_repo; then
      printf 'Neo/Codex scope guard: refusing %s from cwd=%s because this lane may only edit %s unless CODEX_LIFECYCLE_OPERATOR_OVERRIDE=1 is set by Richard.' "$TOOL_NAME" "$CWD_VALUE" "$GUARD_REPO_ROOT"
      return 0
    fi
  fi

  if ((is_shell_tool)); then
    if shell_command_mutates_live_surface; then
      printf 'Neo/Codex live-surface guard: refusing a command that mutates AgentRemote/iTerm/tmux state. Use static tests or set CODEX_LIFECYCLE_OPERATOR_OVERRIDE=1 only after Richard explicitly approves live mutation.'
      return 0
    fi

    if shell_command_mutates_files; then
      if ! cwd_is_inside_guard_repo || shell_command_mentions_cross_repo_path; then
        printf 'Neo/Codex scope guard: refusing a mutating shell command outside %s. Keep this lane inside the repo unless CODEX_LIFECYCLE_OPERATOR_OVERRIDE=1 is set by Richard.' "$GUARD_REPO_ROOT"
        return 0
      fi
    fi
  fi

  if GUARD_REASON="$(lifecycle_precondition_reason)"; then
    printf '%s' "$GUARD_REASON"
    return 0
  fi

  return 1
}

lifecycle_guard_reason() {
  guard_applies_to_session || return 1
  operator_override_enabled && return 1
  cwd_is_inside_guard_repo && return 1

  printf 'Neo/Codex lifecycle guard: cwd=%s is outside %s. Do not run cross-repo lifecycle cleanup, handoff edits, AgentRemote cleanup, or live iTerm/tmux mutation from this lane without CODEX_LIFECYCLE_OPERATOR_OVERRIDE=1 from Richard.' "$CWD_VALUE" "$GUARD_REPO_ROOT"
  return 0
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
  SessionStart|session_start|session-start)
    if STATUS_PROBLEM="$(startup_status_problem "$GUARD_REPO_ROOT")"; then
      emit_context "STARTUP/LANE CHECKPOINT: before mutating files or launching work from $(lane_root_for_repo "$GUARD_REPO_ROOT"), create or refresh $(relative_to_repo "$(status_artifact_for_repo "$GUARD_REPO_ROOT")" "$GUARD_REPO_ROOT"). Required proof: lane root, handoff path plus sha256/read_at or explicit absent reason, taskboard path plus sha256/read_at when present, active goal/status, and next action. Current problem: ${STATUS_PROBLEM}."
    else
      emit_context "STARTUP/LANE CHECKPOINT: $(relative_to_repo "$(status_artifact_for_repo "$GUARD_REPO_ROOT")" "$GUARD_REPO_ROOT") is present. Report status from that artifact, not model memory. $(status_summary)"
    fi
    ;;

  PreToolUse|pre_tool_use|pre-tool-use)
    if GUARD_REASON="$(pre_tool_guard_reason)"; then
      emit_block "$GUARD_REASON"
      exit 0
    fi
    if shell_command_may_leave_process; then
      save_process_snapshot
    fi
    ;;

  PostToolUse|post_tool_use|post-tool-use)
    process_notice=""
    if shell_command_may_leave_process; then
      track_new_processes || true
      if PROCESS_REPORT="$(unkept_process_report)"; then
        process_notice="PROCESS CLEANUP CHECKPOINT: a command in this session appears to have left cleanup-relevant processes running. Stop unused temp/dev/browser/watch processes, or add keep_running_processes entries to $(relative_to_repo "$(status_artifact_for_repo "$GUARD_REPO_ROOT")" "$GUARD_REPO_ROOT") with pid, reason, path, and owner. Live tracked processes:\n${PROCESS_REPORT}"
        emit_context "$process_notice"
        exit 0
      fi
    fi

    if [[ "$plan_total" =~ ^[0-9]+$ && "$plan_total" -gt 0 && "$plan_completed" -eq "$plan_total" ]]; then
      printf 'pending_completion=1\nreason=plan_complete\n' > "$STATE_FILE" 2>/dev/null || true
      emit_context "LIFECYCLE CHECKPOINT: all current plan items are completed. If this is a major task boundary, run /chores now; if this is session closeout, run /done. Update $(relative_to_repo "$(status_artifact_for_repo "$GUARD_REPO_ROOT")" "$GUARD_REPO_ROOT") and the session log before starting a new major task."
      exit 0
    fi

    if [[ "$todo_total" =~ ^[0-9]+$ && "$todo_total" -gt 0 && "$todo_completed" -eq "$todo_total" ]]; then
      printf 'pending_completion=1\nreason=todo_complete\n' > "$STATE_FILE" 2>/dev/null || true
      emit_context "LIFECYCLE CHECKPOINT: all current todos are completed. If this is a major task boundary, run /chores now; if this is session closeout, run /done. Update $(relative_to_repo "$(status_artifact_for_repo "$GUARD_REPO_ROOT")" "$GUARD_REPO_ROOT") and the session log before starting a new major task."
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

  PreCompact|pre_compact|pre-compact)
    if GUARD_REASON="$(lifecycle_guard_reason)"; then
      emit_block "$GUARD_REASON"
      exit 0
    fi
    if STATUS_PROBLEM="$(startup_status_problem "$GUARD_REPO_ROOT")"; then
      emit_block "PRE-COMPACT LIFECYCLE BLOCK: ${STATUS_PROBLEM}. Refresh $(relative_to_repo "$(status_artifact_for_repo "$GUARD_REPO_ROOT")" "$GUARD_REPO_ROOT") before compaction so the resumed session has mechanical startup/status proof."
      exit 0
    fi
    if PROCESS_REPORT="$(unkept_process_report)"; then
      emit_block "PRE-COMPACT PROCESS CLEANUP BLOCK: cleanup-relevant processes are still running without keep_running_processes proof in $(relative_to_repo "$(status_artifact_for_repo "$GUARD_REPO_ROOT")" "$GUARD_REPO_ROOT"). Clean them up or record pid/reason/path/owner before compaction.\n${PROCESS_REPORT}"
      exit 0
    fi

    REPO_ROOT="$(repo_root_for_cwd "$CWD_VALUE")"
    HANDOFF_PATH="$(handoff_for_repo "$REPO_ROOT")"

    if [[ -n "$HANDOFF_PATH" ]]; then
      HANDOFF_REF="$(relative_to_repo "$HANDOFF_PATH" "$REPO_ROOT")"
      emit_context "PRE-COMPACT LIFECYCLE CHECKPOINT: before allowing this context to compact, run /chores if current work changed state, update ${HANDOFF_REF} and $(relative_to_repo "$(status_artifact_for_repo "$GUARD_REPO_ROOT")" "$GUARD_REPO_ROOT"), preserve the running todo list, and record pending diffs/blockers. Do not drift from the repo handoff after compaction."
    else
      emit_context "PRE-COMPACT LIFECYCLE CHECKPOINT: before allowing this context to compact, run /chores if current work changed state and write a repo handoff if one exists for this lane. No memory/handoff.md was found from cwd=${CWD_VALUE}."
    fi
    ;;

  PostCompact|post_compact|post-compact)
    if GUARD_REASON="$(lifecycle_guard_reason)"; then
      emit_context "$GUARD_REASON"
      exit 0
    fi

    REPO_ROOT="$(repo_root_for_cwd "$CWD_VALUE")"
    HANDOFF_PATH="$(handoff_for_repo "$REPO_ROOT")"

    if [[ -n "$HANDOFF_PATH" ]]; then
      HANDOFF_REF="$(relative_to_repo "$HANDOFF_PATH" "$REPO_ROOT")"
      EXCERPT="$(handoff_excerpt "$HANDOFF_PATH")"
      if [[ -n "$EXCERPT" ]]; then
        emit_context "POST-COMPACT RE-ANCHOR: read ${HANDOFF_REF} before continuing and reconcile against it so you do not drift. Current active handoff excerpt:\n${EXCERPT}"
      else
        emit_context "POST-COMPACT RE-ANCHOR: read ${HANDOFF_REF} before continuing and reconcile against it so you do not drift. The file exists but the Active thread excerpt was empty."
      fi
    else
      emit_context "POST-COMPACT RE-ANCHOR: look for repo-relative memory/handoff.md before continuing. No handoff was found from cwd=${CWD_VALUE}; avoid resuming from stale compacted memory alone."
    fi
    ;;

  Stop|stop)
    if GUARD_REASON="$(lifecycle_guard_reason)"; then
      emit_context "$GUARD_REASON"
      exit 0
    fi
    if [[ "${CODEX_LIFECYCLE_ALLOW_UNFINISHED_STOP:-0}" != "1" && "$STOP_HOOK_ACTIVE" != "true" ]]; then
      if STATUS_PROBLEM="$(startup_status_problem "$GUARD_REPO_ROOT")"; then
        emit_block "STOP LIFECYCLE CONTINUATION: ${STATUS_PROBLEM}. Before stopping, update $(relative_to_repo "$(status_artifact_for_repo "$GUARD_REPO_ROOT")" "$GUARD_REPO_ROOT") or run the appropriate closeout so the next session is not forced to resume from model memory."
        exit 0
      fi
      if ! status_is_terminal; then
        emit_block "STOP LIFECYCLE CONTINUATION: active work is still recorded in $(relative_to_repo "$(status_artifact_for_repo "$GUARD_REPO_ROOT")" "$GUARD_REPO_ROOT"). Either finish/close it with status=done|complete|idle and update the handoff, or record the blocker and next owner/action before stopping. Current artifact: $(status_summary)"
        exit 0
      fi
      if PROCESS_REPORT="$(unkept_process_report)"; then
        emit_block "STOP PROCESS CLEANUP CONTINUATION: tracked temp/dev/browser/watch processes are still running without keep_running_processes proof. Clean them up or record pid/reason/path/owner in $(relative_to_repo "$(status_artifact_for_repo "$GUARD_REPO_ROOT")" "$GUARD_REPO_ROOT") before stopping.\n${PROCESS_REPORT}"
        exit 0
      fi
    fi

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
