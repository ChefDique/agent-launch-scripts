# Session 2026-05-21 15:05 — message-agent two-phase submit fix + push both repos

## Outcome
Fixed the `/message-agent` delivery bug (messages landed in the agent's composer but didn't submit until the operator hit Enter manually — intermittent). Root cause was the wrong delay placement + a double-submit in the bus send path; fixed to the HUD's proven two-phase pattern, verified live, and pushed. Also pushed the full session's `agent-launch-scripts` work to origin.

## Work
- **Diagnosed (this time BEFORE building, per the gate; Richard confirmed):** `agent_bus_listener.py` sent `-l <block>` → `C-m` → (only then) `sleep(0.03)` → `Enter`. The sleep was *after* the first submit, never *between* the paste and the submit, so a raw-mode TUI (Claude/Codex) folded the Enter into the paste → text sat unsubmitted. Plus it fired two submits (`C-m` + `Enter`) and the block had a trailing newline.
- **Fix (message-agent repo, commit `3c9509c`, pushed):** paste literal block (no trailing newline) → `sleep SUBMIT_ENTER_DELAY` (0.15s, env-overridable `AGENT_BUS_SUBMIT_ENTER_DELAY`) → a single `Enter`. Dropped the redundant `C-m`. Updated `test_listener.py` assertions (trailing-newline, call-count ≥3, no-C-m) — 26/26 pass.
- **Verified LIVE:** delivered to a throwaway Claude pane via the fixed `deliver_to_tmux`; the message submitted and Claude began responding, instead of sitting in the `❯` composer.
- **Pushed `agent-launch-scripts` to origin (`c3b2050`):** all session work — startup default-on fix (`80128ea`), `tmux-masta`→`neo` rename (`acd7d10`), "Startup auto-run" toggle v1.4.16 (`76ebc52`), registry, chores. Richard authorized the push.

## Artifacts
- message-agent repo: `3c9509c` (`scripts/agent_bus_listener.py` + `tests/test_listener.py`), pushed to origin/main.
- agent-launch-scripts: pushed origin/main at `c3b2050`.

## Followups
- **Shift+Enter → all panes (cross-pane CR):** still OPEN — Richard confirmed it persists; needs which surface he types it in (agent pane vs HUD). The bus double-submit removal quiets one *code-side* CR source but isn't that mechanism. See [[project_iterm_broadcast_extra_cr]].
- HUD "Startup auto-run" toggle: tests pass + live-delivery proven, but the toggle's render in the gear panel not yet eyeballed (low risk; mirrors auto_restart).
- Toggle itself: Richard satisfied; default-on is the real win, toggle is an optional override.
