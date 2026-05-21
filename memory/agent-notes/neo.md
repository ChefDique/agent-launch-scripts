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

### 2026-05-21 — verify memory/inventory claims against live code before documenting or refactoring

When building docs or a spec from session notes (or a subagent inventory), confirm each non-obvious claim against the actual `remote-app/` code before enshrining it. A memory note can be a stale diagnosis from a failed session, not the shipped behavior.
**Why:** While writing the app reference + non-regression spec, the `## Failed approaches` note below states image paste "is ... OSC 1337 protocol, not keyboard transport." The shipped code does neither — it saves the image to `/tmp/agentremote-pasted-images/`, inserts a `[image: /path]` text reference, and submits (`grep` for `1337`/`MultipartFile` in remote-app returns nothing). Documenting OSC 1337 as the requirement would have invited a future agent to tear out the working text-reference path.
**How to apply:** Before writing a requirement or refactoring to match a memory note, grep the live code for the mechanism. If they disagree, the code wins; record the reconciliation (done in spec REQ-A4). Subagent/Explore inventories need the same check — they locate code but can assert incomplete or stale specifics.

### 2026-05-21 — confirm a pane's runtime from @agent-runtime, not pane_current_command

To check what runtime a live agent pane is running, read the `@agent-runtime` pane option (set by launch-agent.sh) and/or the in-pane statusline — not `pane_current_command`.
**Why:** I read `pane_current_command=2.1.143` and told Richard the fleet was Codex; it was actually Claude (Opus 4.7), confirmed by `tmux show-options -p -t <pane> @agent-runtime` = claude. pane_current_command can surface an opaque/version-like string for wrapped or relaunched processes and does not reliably name the runtime. Asserting the wrong runtime mis-scoped the discussion and eroded trust.
**How to apply:** Before stating an agent's runtime, run `tmux show-options -p -t <pane> @agent-runtime` and cross-check the statusline. Pairs with the "verify claims against live code" learning above.

### 2026-05-21 — don't enshrine a shell-only root cause as fact when the operator can see the system

When diagnosing an operator-environment symptom (cross-pane keystrokes, window/pane behavior) from shell evidence alone, frame the conclusion as a HYPOTHESIS and confirm with the operator before writing it into memory as the cause. Rule out the mechanical candidates (iTerm Broadcast Input ⌘⌥I, tmux `synchronize-panes`), but do not assert which one it is without confirmation.
**Why:** 2026-05-21 I diagnosed Richard's "Shift+Return hits all panes" as iTerm Broadcast Input from shell-only evidence (tmux sync off, 6-panes-one-window, control mode) and committed it to memory; Richard rejected it outright ("def not"). The shell cannot observe iTerm's broadcast state or a system-level keyboard remap, so that evidence was suggestive, not conclusive — and I shipped it as fact.
**How to apply:** For operator-environment bugs, present the hypothesis plus the one disambiguating question (e.g. "where exactly are you pressing Shift+Return — an agent pane or the HUD?") and let the operator confirm before persisting a cause. A separate verified-true detail: when checking a runtime's startup/warning screen in a throwaway, use the REAL config dir — a fresh `CLAUDE_CONFIG_DIR` triggers first-run onboarding (theme picker) and misrepresents what the fleet hits. Pairs with [[project_iterm_broadcast_extra_cr]] and the "verify claims against live code" learning above.

### 2026-05-21 — "what problem are you trying to solve" is a diagnose-BEFORE-build GATE, not rhetoric

When Richard asks "what problem are you trying to solve" — or says "don't tunnel vision" / "you're overcomplicating it / it's the simplest answer" — STOP. State the problem in one sentence, get his confirmation, THEN design and build. Do not dispatch subagents, edit, or commit until the problem statement is confirmed. The diagnostic step must precede the work, not follow it.
**Why:** 2026-05-21, after Richard explicitly invoked this gate, I immediately dispatched subagents and shipped three commits, then surfaced the problem retroactively. A Stop hook flagged it repeatedly: "the diagnostic pause happened after the build, not before — the condition gates the work, it doesn't follow it." Even though the eventual fix was correct, the method violated what he asked for, and it eroded trust across several turns. He had also already asked for the on/off switch "at the time" and I dropped it — building the behavior without the control he requested.
**How to apply:** On any Richard request that includes a diagnostic gate or a "you're overcomplicating" signal: (1) reply with the one-sentence problem statement + the simplest fix you see; (2) if it's a real fork or you're unsure, ask one question and WAIT; (3) only build after he confirms. Treat an explicitly-requested control/switch/flag as a first-class deliverable — never ship the behavior and silently drop the control. Simplest-answer-first: prefer one default/flag over per-entry wiring (e.g. Claude warning-ack default-on beat wiring 7+ agents one by one).

### 2026-05-21 — two-phase tmux submit is canonical for EVERY send path (paste → delay → single Enter)

Any code delivering text into a raw-mode TUI pane (Claude/Codex) via `tmux send-keys` must: paste the literal text with `-l`, sleep ~0.15s, then send ONE `Enter` as a SEPARATE call. The delay goes BETWEEN the paste and the Enter — not after the Enter, and never zero. One submit, not two. No trailing newline in the pasted block.
**Why:** the same text+CR-as-paste bug surfaced in THREE independent send paths — the HUD (`remote-app/tmux-send-path.js`), the launcher (`launch-agent.sh` `send_tmux_literal_line`), and the message-agent bus (`agent_bus_listener.py`). The bus had the delay in the wrong place (after a `C-m`) plus a `C-m`+`Enter` double-submit, so messages landed in the composer unsent, intermittently (fixed 2026-05-21, message-agent `3c9509c`). The TUI folds paste-then-immediate-Enter into one block and absorbs the Enter as a newline.
**How to apply:** when you see "text appears but doesn't send," "intermittent submit," or "stray extra carriage return" on a tmux send path, check: (a) a delay BETWEEN paste and Enter (~0.15s), (b) a SINGLE Enter (no `C-m`+`Enter`), (c) no trailing newline in the literal block. Make the delay env-overridable. Verify live against a throwaway TUI pane, not just unit tests.

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
