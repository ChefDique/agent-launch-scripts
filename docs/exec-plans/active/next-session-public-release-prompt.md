# Next-session kickoff prompt — AgentRemote public open-source release (PM-led)

Paste the block below into a fresh Neo session in `~/ai_projects/agent-launch-scripts`
**after** the `reliability-single-window` branch is merged to `main`. It assumes the
reliability + code-in-order work from 2026-06-19 is done (native single-window spawn,
both bugs fixed, docs updated — see `docs/exec-plans/active/2026-06-19-single-window-reliability-spec.md`).

---

We're preparing AgentRemote (the Electron HUD in `remote-app/`) for **public open-source
release** as a funnel: free, permissive license, drives my TikTok audience → paid/lead-gen.
The reliability + code-in-order pass is already merged.

**Invoke a product-manager skill first** — search skillvault + the zero-context catalog for
"product management / positioning / naming / launch / go-to-market" and use the best match to
drive naming, packaging, and positioning. Don't free-hand it. Brainstorm + plan FIRST; the
name, license, repo-extraction choice, and any public push are my decisions (present options).

Scope:
1. **Name + brand** — "AgentRemote" is a working title. Propose names; check npm/GitHub/domain availability.
2. **Packaging/distribution** — signed + notarized macOS build, auto-update, the cross-platform
   question (Linux/Windows), DMG/release artifacts, CI.
3. **License** — MIT vs Apache-2.0 for a funnel model.
4. **De-Richard-ify** — `agents.json` is my private fleet (absolute `~/richardadair` paths +
   persona names). Ship a clean default registry + a first-run onboarding / "add your own agent"
   flow. No hardcoded home paths, no personas.
5. **Secrets/paths sweep** — no tokens, no `settings.local.json`, no `memory/`, no private docs in
   the public repo. Decide: extract `remote-app/` + a minimal launcher into a fresh public repo
   (recommended) vs scrub-in-place.
6. **Finish the standalone surface** — native attach/stop (currently bridged through swarmy via the
   `@swarmy_runtime` tag) and the embedded-terminal option (replace iTerm control-mode so it runs
   on any machine with zero external deps). This completes the swarmy removal started 2026-06-19.
7. **Codex custom pet creation (bonus feature)** — let users create/import their own pet
   (sprite + `pet.json`) and wire it into the add-agent flow + the voice/send/status animation
   rows. ~50+ pets already exist under `~/.codex/pets/` as a starting library.
8. **Story** — README + landing + the TikTok funnel; what's free vs what the funnel drives to.

Reliability follow-ups inherited from the 2026-06-19 session (verify still green, then build on):
- Native attach/stop (see #6) — the only remaining swarmy dependency on the live path.
- Pre-existing test failures to triage separately: `agent-transcript-source.test.js:201`
  (Codex newest-session fallback) and the `chq-codex-runtime-smoke` bash test
  (`chq-tmux.sh` rejects a legacy layout vocab word). Neither was caused by this work.
