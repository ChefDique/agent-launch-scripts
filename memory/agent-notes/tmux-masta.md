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
