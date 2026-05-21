# Learnings

## [LRN-20260508-001] correction

**Logged**: 2026-05-08T01:45:00-07:00
**Priority**: critical
**Status**: promoted
**Area**: docs

### Summary
AgentRemote requirements were scattered across handoff history, memory, and operation notes, so future sessions kept fixing one behavior while regressing another.

### Details
Richard repeatedly corrected the same requirements: AgentRemote must dynamically spawn the selected agent/runtime/model, must preserve one-agent-per-pane tmux identity, must not turn arbitrary terminals into Codex harnesses, must not use normal `tmux attach` as a workaround, must not leave stale iTerm/control-mode windows behind, and must prove live runtime truth before claiming success. These were documented in fragments but not promoted into one mandatory contract that every AgentRemote change must read.

### Suggested Action
Treat `docs/operations/agentremote-operator-contract.md` as the mandatory source of truth before AgentRemote, launch-script, Swarmy-adapter, tmux/iTerm, pet-chat, paste, or runtime-selection edits. If implementation conflicts with that contract, stop and update the contract or file an explicit task before coding.

### Metadata
- Source: user_feedback
- Related Files: /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/agentremote-operator-contract.md, /Users/richardadair/ai_projects/agent-launch-scripts/AGENTS.md, /Users/richardadair/ai_projects/agent-launch-scripts/CLAUDE.md, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/AGENTS.md
- Tags: agentremote, runtime_truth, loop_control, operator_visibility, spawn_lifecycle
- Pattern-Key: agentremote.operator_contract_missing
- Recurrence-Count: 1
- First-Seen: 2026-05-08
- Last-Seen: 2026-05-08
- Control Surface: /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/agentremote-operator-contract.md
- Loop Owner: runtime-truth
- Verification: `test -f docs/operations/agentremote-operator-contract.md && rg -n "agentremote-operator-contract|Operator Contract" AGENTS.md CLAUDE.md docs/README.md remote-app/AGENTS.md`

### Resolution
- **Resolved**: 2026-05-08T01:45:00-07:00
- **Commit/PR**: pending
- **Notes**: Promoted the scattered requirements into a dedicated operator contract and linked it from startup/checklist docs.

---

## [LRN-20260520-001] correction

**Logged**: 2026-05-20T00:16:10-0700
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
After detaching or stopping everything, the next step is not optional: immediately run the follow-through verification and report the next concrete action.

### Details
Richard corrected that Neo repeatedly treats "detach everything" or cleanup as the end of the loop, then fails the step that comes immediately after. The failure pattern is loop control: cleanup creates a false sense of completion unless the closeout/startup surface forces a follow-through check.

### Suggested Action
After any detach-all, stop-all, cleanup, or session-end action, perform the next required verification before final status: inspect remaining processes/sessions/windows, confirm the intended post-detach state, and state the next concrete action or blocker. Do not stop at "detached" or "cleaned up."

### Metadata
- Source: user_feedback
- Related Files: /Users/richardadair/ai_projects/agent-launch-scripts/AGENTS.md, /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/agentremote-operator-contract.md, /Users/richardadair/ai_projects/agent-launch-scripts/scripts/session-end-cleanup.sh, /Users/richardadair/.agents/skills/done/SKILL.md
- Tags: detach, cleanup, done, loop_control, follow-through, verification
- Pattern-Key: lifecycle.detach_requires_followthrough
- Recurrence-Count: 1
- First-Seen: 2026-05-20
- Last-Seen: 2026-05-20
- Control Surface: /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/agentremote-operator-contract.md and /Users/richardadair/.agents/skills/done/SKILL.md
- Loop Owner: closeout
- Verification: `rg -n "Follow through after detach|After any detach-all" /Users/richardadair/.agents/skills/done/SKILL.md /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/agentremote-operator-contract.md`

### Resolution
- **Resolved**: 2026-05-20T00:34:00-0700
- **Commit/PR**: pending
- **Notes**: Closed the live marked `AgentRemote CHQ Viewer` iTerm residue, verified 0 iTerm windows and 0 tmux clients, and updated `scripts/session-end-cleanup.sh` so cleanup closes only marked AgentRemote iTerm viewer windows and reports before/after residue.

---

## [LRN-20260508-003] correction

**Logged**: 2026-05-08T03:05:00-07:00
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
Claude runtime launches still need the scoped tmux boot-time auto-inject path for warning acknowledgement and startup commands.

### Details
Lucius launched and attached cleanly through AgentRemote, but Claude Code's startup warning acknowledgement did not fire. The current launcher only cleaned stale auto-inject PID files and tests treated all `tmux send-keys` usage as forbidden, which erased a required Claude-only behavior from the old launch scripts: delayed warning ack, `/color` + `/rename`, and `startup_slash` injection.

### Suggested Action
Keep `tmux send-keys` forbidden as a broad workaround, but allow and test it for the Claude-only boot sequence inside `launch-agent.sh` when `RUNTIME=claude` and `TMUX_PANE` is present. Validate that Codex/Hermes/OpenClaw startup paths do not use that sequence.

### Metadata
- Source: user_feedback
- Related Files: /Users/richardadair/ai_projects/agent-launch-scripts-claude-warning/launch-agent.sh, /Users/richardadair/ai_projects/agent-launch-scripts-claude-warning/test/launch-agent-runtime.test.sh, /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/launch-scripts.md
- Tags: claude, auto-inject, tmux, lucius, startup
- Pattern-Key: agentremote.claude_boot_auto_inject
- Recurrence-Count: 1
- First-Seen: 2026-05-08
- Last-Seen: 2026-05-08
- Control Surface: /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/launch-scripts.md
- Loop Owner: launcher
- Verification: `cd /Users/richardadair/ai_projects/agent-launch-scripts-claude-warning && bash -n launch-agent.sh test/launch-agent-runtime.test.sh && bash test/launch-agent-runtime.test.sh`

### Resolution
- **Resolved**: 2026-05-08T03:05:00-07:00
- **Commit/PR**: pending
- **Notes**: Fix lives in isolated worktree `/Users/richardadair/ai_projects/agent-launch-scripts-claude-warning`; canonical live launcher is unchanged until intentionally merged or applied.

---

## [LRN-20260508-002] correction

**Logged**: 2026-05-08T02:10:00-07:00
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
When the canonical AgentRemote checkout is already dirty, new launcher/runtime fixes must move to an isolated worktree before editing.

### Details
Richard interrupted with "worktree!" after the title-label fix was first applied directly on top of existing dirty state in `/Users/richardadair/ai_projects/agent-launch-scripts` and `/Users/richardadair/ai_projects/swarmy`. The correction is that shared operational checkouts can contain live evidence or other agents' uncommitted work; even narrow title fixes should not be layered into those trees once that risk is visible.

### Suggested Action
Before editing AgentRemote launch/runtime paths, check `git status --short --branch`; if unrelated dirty state exists, create a dedicated worktree and apply the new fix there. Leave existing shared-checkout dirty state untouched unless Richard explicitly asks to move or revert it.

### Metadata
- Source: user_feedback
- Related Files: /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/launch-scripts.md, /Users/richardadair/ai_projects/agent-launch-scripts-title-fix/chq-tmux.sh, /Users/richardadair/ai_projects/swarmy-title-fix/scripts/agentremote_runtime.py
- Tags: worktree, agentremote, shared-checkout, runtime_truth
- Pattern-Key: agentremote.worktree_before_dirty_shared_checkout
- Recurrence-Count: 1
- First-Seen: 2026-05-08
- Last-Seen: 2026-05-08
- Control Surface: /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/launch-scripts.md
- Loop Owner: runtime-truth
- Verification: `git -C /Users/richardadair/ai_projects/agent-launch-scripts-title-fix status --short --branch && git -C /Users/richardadair/ai_projects/swarmy-title-fix status --short --branch`

### Resolution
- **Resolved**: 2026-05-08T02:10:00-07:00
- **Commit/PR**: pending
- **Notes**: Created isolated title-fix worktrees and removed the title hunks from the shared checkouts while preserving unrelated dirty state.

---

## [LRN-20260508-004] correction

**Logged**: 2026-05-08T03:55:30-07:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
AgentRemote's embedded xterm must treat plain Ctrl+V as paste so image references are inserted instead of leaking `0x16` into agent panes.

### Details
Richard reported that picture paste into the terminal was lost again and then identified `0x16`. The embedded terminal paste handler caught host paste events plus Cmd+V and Ctrl+Shift+V, but plain Ctrl+V fell through xterm's `onData` path as the SYN control byte. That bypassed the clipboard image fallback that saves native images and sends `[image: /tmp/... ]` references to the target pane.

### Suggested Action
Keep the paste shortcut detection broad enough for Cmd+V and Ctrl+V, and suppress a lone `\x16` in xterm `onData` as a defensive guard. Static tests should assert both the shortcut and the control-byte guard so future terminal input work cannot regress image paste.

### Metadata
- Source: user_feedback
- Related Files: /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/index.html, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/test/renderer-static.test.js, /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/agentremote-recovery-list.md
- Tags: agentremote, xterm, paste, image-paste, ctrl-v
- Pattern-Key: agentremote.xterm_ctrl_v_image_paste
- Recurrence-Count: 1
- First-Seen: 2026-05-08
- Last-Seen: 2026-05-08
- Control Surface: /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/test/renderer-static.test.js
- Loop Owner: runtime
- Verification: `cd /Users/richardadair/ai_projects/agent-launch-scripts/remote-app && node --test test/renderer-static.test.js`

### Resolution
- **Resolved**: 2026-05-08T03:55:30-07:00
- **Commit/PR**: pending
- **Notes**: AgentRemote was relaunched from the canonical checkout after the fix so the active HUD is using the updated renderer.

---

## [LRN-20260508-005] correction

**Logged**: 2026-05-08T03:55:30-07:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
AgentRemote pet chat must not treat another agent's casual mention of a name as addressed traffic for that pet.

### Details
Richard reported that the chat streaming into Lucius's chat was not correct and asked whether new-agent setup was hardcoded. The pet chat routing was registry-driven, not hardcoded, but the filter was too broad: any team message containing an agent alias or pet name could render in that agent's pet chat. Old team-chat entries from other agents that merely mentioned Lucius could therefore appear in Lucius's pet window even when they were not sent to him.

### Suggested Action
Pet chat should render direct `from`/`to` matches for the agent or pet. Do not use broad message-body mention matching for routing pet chat rows.

### Metadata
- Source: user_feedback
- Related Files: /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/pet-window.html, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/test/renderer-static.test.js, /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/agentremote-recovery-list.md
- Tags: agentremote, pet-chat, routing, lucius, team-chat
- Pattern-Key: agentremote.pet_chat_broad_mention_filter
- Recurrence-Count: 1
- First-Seen: 2026-05-08
- Last-Seen: 2026-05-08
- Control Surface: /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/test/renderer-static.test.js
- Loop Owner: runtime
- Verification: `cd /Users/richardadair/ai_projects/agent-launch-scripts/remote-app && node --test test/renderer-static.test.js`

### Resolution
- **Resolved**: 2026-05-08T03:55:30-07:00
- **Commit/PR**: pending
- **Notes**: Pet chat filtering now uses direct `from`/`to` identity matches and drops broad mention-based routing.

---

## [LRN-20260508-006] correction

**Logged**: 2026-05-08T20:04:26-07:00
**Priority**: critical
**Status**: resolved
**Area**: frontend

### Summary
AgentRemote pet-chat fixes must not replace dynamic behavior with per-agent or per-model regexes that only work for the visible failing agent.

### Details
Richard reported that the pet chat filter worked for Neo/Codex but failed for Claude agents, then called out the broader pattern: hardcoded tactical patches masquerade as fixes until another agent, runtime, or visible state changes. The broken shape was an inline renderer denylist that encoded model/runtime words and specific TUI phrases instead of a shared, behavior-tested stream classifier.

### Suggested Action
Keep pet stream filtering in a shared module with stateful, agent-agnostic classification. Add behavior fixtures for multiple harness-shaped streams and static contract tests that fail if pet filtering reintroduces agent/model-name routing. Promote the rule to `AGENTS.md`, `remote-app/AGENTS.md`, and the AgentRemote operator contract.

### Metadata
- Source: user_feedback
- Related Files: /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/pane-stream-filter.js, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/test/pane-stream-filter.test.js, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/test/runtime-dynamic-contract.test.js, /Users/richardadair/ai_projects/agent-launch-scripts/AGENTS.md, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/AGENTS.md, /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/agentremote-operator-contract.md
- Tags: agentremote, pet-chat, dynamic-behavior, loop_control, operator_visibility
- Pattern-Key: agentremote.pet_chat_hardcoded_filter_regression
- Recurrence-Count: 1
- First-Seen: 2026-05-08
- Last-Seen: 2026-05-08
- Control Surface: /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/test/runtime-dynamic-contract.test.js
- Loop Owner: runtime
- Verification: `cd /Users/richardadair/ai_projects/agent-launch-scripts/remote-app && npm test`

### Resolution
- **Resolved**: 2026-05-08T20:04:26-07:00
- **Commit/PR**: pending
- **Commit/PR**: `adf8fd2`, `bdfe9b1`
- **Notes**: The enforcement is repo-local: docs state the dynamic-only rule, tests cover the shared stream classifier plus no model/agent-name-routed pet filtering, and transcript-backed chat now avoids raw terminal scraping for supported runtimes.

---

## [LRN-20260508-007] correction

**Logged**: 2026-05-08T20:37:10-07:00
**Priority**: critical
**Status**: promoted
**Area**: frontend

### Summary
AgentRemote pet chat for Claude/Codex should render structured transcript records, not raw terminal output, so thinking/tool output never enters the chat feed.

### Details
Richard pointed out that the current "stream up to date" behavior had simply moved from stale history to live terminal noise: tool calls, thinking summaries, and random TUI fragments were still appearing in other agents' pet chats. The Codex app pattern is not a smarter pane scrape; it renders structured conversation records. AgentRemote needs the same source separation for runtimes that provide local transcripts, with pane scraping reserved for explicit fallback/unsupported runtimes.

### Suggested Action
For Claude/Codex pet chat, resolve the agent's structured transcript from registry runtime and cwd, extract only assistant message text records, and refuse to render a transcript unless the session/cwd match is proven. Do not fall back to the newest transcript file when matching fails. Keep pane-stream filtering as a separate tested fallback path.

### Metadata
- Source: user_feedback
- Related Files: /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/agent-transcript-source.js, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/pet-window.html, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/test/agent-transcript-source.test.js, /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/agentremote-operator-contract.md, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/AGENTS.md
- Tags: agentremote, pet-chat, transcript, cwd-proof, tool-filtering, loop_control
- Pattern-Key: agentremote.pet_chat_structured_transcript_source
- Recurrence-Count: 1
- First-Seen: 2026-05-08
- Last-Seen: 2026-05-08
- Control Surface: /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/test/agent-transcript-source.test.js
- Loop Owner: runtime
- Verification: `cd /Users/richardadair/ai_projects/agent-launch-scripts/remote-app && npm test`

### Resolution
- **Resolved**: 2026-05-08T20:37:10-07:00
- **Commit/PR**: `bdfe9b1`
- **Notes**: Claude/Codex pet chat now uses structured transcript extraction by default, refuses wrong-session Codex fallback without cwd proof, and leaves pane streaming as an explicit/dynamic fallback for unsupported runtimes.

---
## [LRN-20260509-001] runtime_truth

**Logged**: 2026-05-09T05:31:56Z
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
Message delivery must resolve AgentRemote identity to the current tmux pane id at send time, not trust listener-start coordinates or per-agent hardcoded fixes.

### Details
Richard observed a message intended for `lucius-claude` appearing in Neo because the listener still targeted stale `chq:0.1` while AgentRemote had moved Lucius to stable pane `%515` at `chq:0.2`. The correct fix is dynamic: AgentRemote owns the sidecar identity to pane-id map, message-agent resolves that map immediately before `send-keys`, and the listener health reports both stale configured targets and resolved live targets. The same incident also showed that launch/restart sync must preserve `agentremote_agent_id`; otherwise live registry sync silently drops the explicit mapping and forces lower-confidence suffix fallback.

### Suggested Action
For AgentRemote/message-agent delivery changes, require a shared resolver, delivery-time pane-id targeting, fail-closed/inbox-only behavior when identity cannot be proven, and tests proving stale coords do not deliver to the wrong pane.

### Metadata
- Source: user_feedback
- Related Files: /Users/richardadair/ai_projects/tools/message-agent/scripts/agentremote_pane_resolver.py, /Users/richardadair/ai_projects/tools/message-agent/scripts/agent_bus_listener.py, /Users/richardadair/ai_projects/tools/message-agent/scripts/agent_registry.py, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/main.js, /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/2026-05-09-message-agent-pane-pairing-sync-proposal.md
- Tags: agentremote, message-agent, tmux, runtime-truth, stale-coord
- Control Surface: /Users/richardadair/ai_projects/tools/message-agent/scripts/agentremote_pane_resolver.py and /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/main.js
- Loop Owner: runtime-truth
- Verification: message-agent commit c74c792, AgentRemote commit e21cbd5, `python3 -m unittest tests.test_agentremote_pane_resolver tests.test_agent_registry tests.test_listener tests.test_inbox tests.test_agent_bus_send`, `cd remote-app && npm run test:policy`, and live `/health` showing `lucius-claude` resolves to `%515`/`chq:0.2` while configured `chq:0.1` is stale

### Resolution
- **Resolved**: 2026-05-09T05:31:56Z
- **Commit/PR**: tools/message-agent `c74c792`; agent-launch-scripts `e21cbd5`
- **Notes**: Delivery now targets resolved pane id, not stale coord; AgentRemote sync calls the shared helper after pane topology changes.

---

## [LRN-20260513-001] correction

**Logged**: 2026-05-13T05:06:51-0700
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
`/done` must mean commit, merge or PR, delete stale worktrees/generated junk, and leave no dirty working trees.

### Details
Richard corrected that a previous `/done` closeout stopped after committing a feature-worktree branch and reporting the remaining merge/cleanup work, which violated his intended semantics. The skill text said to run `/chores` and resolve dirty worktrees, but it did not plainly state that `/done` must integrate feature-worktree work back to the canonical branch or open a PR, remove stale worktrees/branches, and finish with clean status everywhere.

### Suggested Action
Treat `/done` as a blocking closeout gate: if intentional work is only on a feature branch/worktree, merge it into the canonical checkout when local policy allows or open a PR/stop with the exact blocker. Delete generated scratch output and stale worktrees after preservation. Do not emit a normal DONE STATUS while any repo/worktree remains dirty unless Richard explicitly deferred that exact state.

### Metadata
- Source: user_feedback
- Related Files: /Users/richardadair/.agents/skills/done/SKILL.md, /Users/richardadair/.agents/skills/chores/SKILL.md
- Tags: done, chores, worktree, merge, dirty-state, closeout, loop_control
- Pattern-Key: lifecycle.done_must_merge_and_clean
- Recurrence-Count: 1
- First-Seen: 2026-05-13
- Last-Seen: 2026-05-13
- Control Surface: /Users/richardadair/.agents/skills/done/SKILL.md
- Loop Owner: closeout
- Verification: `sed -n '1,80p' /Users/richardadair/.agents/skills/done/SKILL.md` shows the Non-negotiable meaning of `/done` section

### Resolution
- **Resolved**: 2026-05-13T05:06:51-0700
- **Commit/PR**: pending repo learning commit; global skill edited in place
- **Notes**: Added an explicit `/done` completion contract requiring commit, merge/preserve or PR, stale worktree cleanup, generated junk deletion, and clean working trees before final response.

---

## [LRN-20260518-001] best_practice

**Logged**: 2026-05-18T20:16:48-0700
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
Generated fallback values in AgentRemote settings must remain display-only until the user actually changes those inputs.

### Details
During the v1.4.8 startup-lines work, the first implementation displayed legacy Claude startup behavior as editable `startup_lines` values for agents that did not yet have explicit `startup_lines`. A review pass caught that saving an unrelated field could persist those generated fallback lines and change launcher timing semantics. The correct pattern is to distinguish persisted registry data from UI-derived display defaults, and only write the new registry field when the corresponding inputs differ from the opened state.

### Suggested Action
When a form shows derived defaults for backward compatibility, track whether the source field was explicitly configured and whether the user changed the derived inputs. Do not include derived fields in save payloads unless the user changed them; add static tests for the guard.

### Metadata
- Source: conversation
- Related Files: /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/index.html, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/main.js, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/test/renderer-static.test.js, /Users/richardadair/ai_projects/agent-launch-scripts/launch-agent.sh
- Tags: agentremote, startup-lines, backward-compatibility, generated-defaults, review
- Pattern-Key: agentremote.generated_defaults_display_only
- Recurrence-Count: 1
- First-Seen: 2026-05-18
- Last-Seen: 2026-05-18

### Resolution
- **Resolved**: 2026-05-18T20:16:48-0700
- **Commit/PR**: `7935e5b`
- **Notes**: `startupLinesConfigured` now distinguishes explicit registry arrays from legacy display defaults; edit-form save only sends `startupLines` when the three inputs change, and static tests assert the guard.

---

## [LRN-20260521-001] correction

**Logged**: 2026-05-21T00:00:00-0700
**Priority**: critical
**Status**: resolved
**Area**: infra

### Summary
Submitting to a raw-mode TUI (Codex/Claude) requires the literal text and the Enter to arrive in SEPARATE read()s. Sending them in one tmux invocation makes the TUI treat text+CR as a paste and insert a newline in the composer instead of submitting.

### Details
Richard reported "tmux send keys are not sending all the way through — I have to go press enter in the window." The send path built `send-keys -t T -l -- text ; send-keys -t T Enter` and ran it as ONE execFile, which tmux flushes as a single write. A line-buffered consumer (`cat`) submits regardless, which masked the bug in earlier tests. But Codex/Claude do their own raw-mode line editing: text and a trailing CR arriving in one read() are read as a bracketed-paste-style block, so the CR becomes a literal newline in the composer and the message sits unsubmitted. This is the "simultaneous/timed Enter" Richard described (ALS-LOCAL-006) and the "queued but not submitted" tmux-fallback failure (ALS-LOCAL-008) — same root cause. A prior session mis-diagnosed it as a "stray Enter" and added a focus guard that broke image paste and Option+Backspace.

### Suggested Action
Submit in two phases: send the literal text, wait `TMUX_SUBMIT_ENTER_DELAY_MS` (120ms), then send Enter as its own keypress so it lands in a separate read() the TUI recognizes as a deliberate submit. Keep it runtime-agnostic (line-buffered shells submit either way). Never re-fuse text and Enter into one send for the chat/composer or embedded-terminal submit paths. Prove it with an integration test that counts read()s on a raw-mode consumer: two-phase = 2 reads (submits), combined = 1 read (the bug). Image paste and Option+Backspace are SEPARATE code paths — do not guard the Enter symptom by touching them.

### Metadata
- Source: user_feedback
- Related Files: /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/tmux-send-path.js, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/main.js, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/test/tmux-send-path.integration.test.js, /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/agentremote-operator-contract.md
- Tags: agentremote, tmux, send-keys, codex, claude, tui, bracketed-paste, submit, enter
- Pattern-Key: agentremote.submit_text_and_enter_must_be_separate_reads
- Recurrence-Count: 1
- First-Seen: 2026-05-21
- Last-Seen: 2026-05-21
- Control Surface: /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/test/tmux-send-path.integration.test.js
- Loop Owner: runtime
- Verification: `cd remote-app && node --test test/tmux-send-path.test.js test/tmux-send-path.integration.test.js`

### Resolution
- **Resolved**: 2026-05-21T00:00:00-0700
- **Commit/PR**: agent-launch-scripts v1.4.15 (two-phase submit)
- **Notes**: Two-phase send in `tmuxSendLiteralArgs` + `tmuxSendEnterArgs` + `submitPaneText`/`sendKeysToCoord`. Integration tests assert 2-reads-vs-1-read. Still pending LIVE verification against Richard's Codex panes.

---
