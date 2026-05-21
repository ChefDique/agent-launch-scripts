# Agent Notes — Neo

<!-- HOW THIS FILE WORKS — read once, then delete this comment block:

  * APPEND-ONLY. Never prune entries; only add. Old learnings stay valuable.

  * Two sections: ## Learnings (procedural / non-obvious patterns) +
    ## Failed approaches (what didn't work and why).

  * One entry per insight. Format:
      ### YYYY-MM-DD — <one-line title that names the rule, not the symptom>
      Body in 2-5 sentences. Lead with the rule itself, then:
        **Why:** <the reason — often a past incident or strong preference>
        **How to apply:** <when/where this guidance kicks in>

  * /chores appends ONLY on a genuine new learning. Empty /chores cycles
    do NOT pollute this file with placeholders.

  * Cross-link related learnings with [[other-memory-name]] (the slug of
    another file in agent-notes/ or the auto-memory partition).

  * Lessons go here, not in handoff.md. Handoff is for active state; this
    is for what you've learned that should outlive any single session.
-->

## Learnings

<!-- Example shape (delete after first real entry):

### 2026-MM-DD — short title naming the rule

Don't <X> because <Y>. Always <Z> instead.
**Why:** Burned in <incident reference>. Specific failure mode was <detail>.
**How to apply:** When <trigger>, default to <action>. Edge case: <when not>.

Pairs with [[related-learning-slug]] (cross-link).
-->

### 2026-05-18 — keep generated fallback settings display-only

When AgentRemote shows legacy behavior as editable fields, keep those values display-only unless the user changes the field. Persisting generated defaults during an unrelated save can silently convert old registry semantics into new explicit config.
**Why:** The v1.4.8 startup-lines review caught that synthesized `/color {{color}}`, `/rename {{rename_to}}`, and `{{startup_slash}}` lines could be saved unintentionally for legacy Claude entries.
**How to apply:** For compatibility UI, expose an explicit `configured` bit from the registry and compare current inputs against the opened state before adding derived fields to save payloads.

### 2026-05-19 — restart stale wrapped children before patching AgentRemote terminal code

When one AgentRemote pane behaves correctly and sibling panes do not, first compare the live child process command and start time. If wrappers are still alive but their Codex child is stale, kill only that child and let the wrapper re-enter `launch-agent.sh`.
**Why:** Mugatu worked because he had already relaunched through the current launcher path; Xavier, Dasha, and Lucius were still old `gpt-5.3-codex` child processes. Restarting those children fixed the terminal behavior without new code.
**How to apply:** For terminal paste, Option-key editing, status-line, or model drift across panes, inspect `ps` output before changing scripts. Existing panes do not pick up launcher/config changes until the wrapped child restarts.

### 2026-05-19 — prove AgentRemote layout fixes with renderer bounds, not static resize intent

For popup/window sizing defects, static tests that prove a resize request exists are not enough. Launch a fresh Electron renderer, open the exact Add/Edit surface, and record the live bounds for the form, action buttons, panel, and viewport before calling the UI fixed.
**Why:** The previous form-sizing fix only proved `syncWindowSize()` asked the BrowserWindow to grow; Richard still saw Save/Cancel clipped because the form's fallback height did not reserve room for the dock and lower panel rows.
**How to apply:** For AgentRemote clipping regressions, require a screenshot plus booleans like `actionsVisible`, `formBottomVisible`, and `panelBottomVisible` from the running renderer. If the visible operator window differs from the test process, inspect that live process/window before editing again.

### 2026-05-19 — hooks remind; the lead still performs chores

Codex lifecycle hooks in this repo emit context or block unsafe tool use; they do not run `/chores` or rewrite handoff files by themselves. When a hook or user asks for chores, stop feature work long enough to update the handoff, session fold, and agent notes before continuing.
**Why:** Richard caught Neo continuing implementation and explanations while the hook/discipline expectation was to do the actual cleanup.
**How to apply:** If a session creates a broad checkpoint or the user asks about ignored hooks, immediately run the `/chores` procedure: inspect memory scaffold, overwrite `memory/handoff.md`, append only real learnings, run safe verification, then commit if the checkpoint is green.

### 2026-05-20 — do not fix AgentRemote TUI symptoms by removing launcher contract

When a Codex pane looks visually wrong, preserve launcher contract first and inspect the specific failing layer. Do not remove `--no-alt-screen`, startup slash delivery, pane titles, or startup policy just because a terminal UI symptom appears nearby.
**Why:** A short-term attempt to improve AgentRemote TUI behavior removed load-bearing Codex launch args and made the operator lose trusted visual cues.
**How to apply:** For Codex/AgentRemote display or keyboard regressions, restore known launcher invariants, then patch the catalog, renderer, or tmux input path that actually owns the symptom.

## Failed approaches

<!-- Example shape (delete after first real entry):

### 2026-MM-DD — approach that didn't work

Tried <approach>. Didn't work because <specific failure>.
What I'm doing instead: <alternative>.
**Why this matters:** Saves the next reader from re-running the dead-end.

Pairs with [[related-learning-slug]].
-->

### 2026-05-19 — do not validate AgentRemote terminal behavior from static code

Tried to fix AgentRemote image paste and Option-key editing by patching renderer/tmux key handling and validating with static tests plus tmux key tables. That did not prove the live operator workflow and wasted multiple sessions.
What I'm doing instead: reproduce in an isolated `tmux -CC` iTerm control-mode session, capture actual bytes/protocol behavior, and only then patch the correct layer.
**Why this matters:** Image paste is clipboard image -> iTerm2 OSC 1337 inline image/file protocol, not keyboard transport. Keyboard editing is a separate Option/Meta sequence problem. Mixing them produced false confidence and damaged operator trust.
