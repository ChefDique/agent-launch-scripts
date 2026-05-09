## [ERR-20260509-001] start_claude_listener

**Logged**: 2026-05-09T05:31:56Z
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
`start_claude_listener.sh` must not expand an empty optional-argument array under launchd because it can crash-loop listeners during closeout/restart.

### Error
```text
agent_bus_listener.py: error: unrecognized arguments:
/Users/richardadair/ai_projects/tools/message-agent/scripts/start_claude_listener.sh: line 53: EXTRA_ARGS[@]: unbound variable
```

### Context
- Command/operation attempted: restarted `lucius-claude` and `xavier-claude` listeners after deploying the delivery-time pane resolver.
- Input or parameters used: launchd invoked `start_claude_listener.sh` with only the required identity/port/pane arguments and no optional AgentRemote args.
- Environment details: shell had `set -euo pipefail`; empty `"${EXTRA_ARGS[@]}"` handling caused a blank argv first, then an unbound array after a partial fix.

### Suggested Fix
Build a `CMD=(...)` array and append `EXTRA_ARGS` only when `(( ${#EXTRA_ARGS[@]} > 0 ))`, then `exec "${CMD[@]}"`.

### Metadata
- Reproducible: yes
- Related Files: /Users/richardadair/ai_projects/tools/message-agent/scripts/start_claude_listener.sh
- Control Surface: /Users/richardadair/ai_projects/tools/message-agent/scripts/start_claude_listener.sh
- Loop Owner: launcher
- Verification: `bash -n scripts/start_claude_listener.sh`, listener status for `lucius-claude` pid `70225` and `xavier-claude` pid `70270`, live `/health` reachable on ports `9125` and `9275`

### Resolution
- **Resolved**: 2026-05-09T05:31:56Z
- **Commit/PR**: tools/message-agent `c74c792`
- **Notes**: The wrapper now constructs the command array explicitly and only appends optional arguments when present.

---
