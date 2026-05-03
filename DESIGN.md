# Design — operator control surface

**Status:** Working spec. Codifies the design system of the current Electron remote at `~/agent-launch-scripts/remote-app/` and proposes the path to its production home in `~/ai_projects/<name>/`.

**Skill spirit:** `extract-design-system` (the formal skill is URL-input only; this doc does the same job against the local Electron CSS at `remote-app/index.html` plus the iso-armory screenshot at `~/.claude/image-cache/21397d35-4cc3-463a-95cc-388b9f942327/1.png`).

---

## 1. Name

**Decided: AgentRemote.** Matches the user-data-dir baked into the Electron build (`~/Library/Application Support/AgentRemote`), the launcher (`launch-remote.sh`), and the source dir (`remote-app/`). Future migration target `~/ai_projects/agent-remote/`. The rest of this doc uses AgentRemote throughout.

---

## 2. What it is / isn't

**Is:** An always-on-top, frameless, glassmorphism HUD that lets the operator (Richard) spawn / kill / restart / attach / broadcast-to local agent sessions. Lives next to the work, never blocks it. The lightweight side of an eventual two-surface system: HUD on the desktop, full command center inside ACRM.

**Isn't:** A replacement for ACRM. ACRM owns the registry, archetype catalog, skill library, team templates, runtime mission control. AgentRemote is the always-visible operator station that *uses* what ACRM defines. AgentRemote doesn't ship in a browser — it's native because it controls local processes (tmux, pty, file watch, iTerm).

**Not the iso command center.** The iso surface is the *full mode* under separate validate-proposal review (`~/ai_projects/CorporateHQ/ACRM/docs/proposals/iso-roomgrid-spike.md`). AgentRemote is *lite mode* — the always-visible quick-action HUD. They coexist.

---

## 3. Design primitives (extracted from current build)

### 3.1 Color tokens

Pulled from `remote-app/index.html:13-30`. These are the source of truth.

| Token | Value | Purpose |
|---|---|---|
| `--bg-deep` | `rgba(8, 8, 14, 0.72)` | Panel background, tile backgrounds at rest |
| `--bg-glass` | `rgba(20, 20, 30, 0.55)` | Glass card surfaces (agent tiles, radial items) |
| `--bg-input` | `rgba(255, 255, 255, 0.04)` | Chat input field, low-emphasis surfaces |
| `--border-soft` | `rgba(255, 255, 255, 0.08)` | Inactive borders |
| `--border-medium` | `rgba(255, 255, 255, 0.16)` | Active panels, dashed edit-mode borders |
| `--text-primary` | `#f4f4f8` | Default body text, active labels |
| `--text-muted` | `#8a8a98` | Inactive labels, secondary copy, placeholders |
| `--accent` | `#e07c4c` | Anthropic orange. Send button, hover states, selection glow, claude tile |
| `--accent-glow` | `rgba(224, 124, 76, 0.55)` | Box-shadow halo on active/hover |
| `--status-on` | `#34d058` | Live agent indicator, confirm button |
| `--status-off` | `rgba(255, 255, 255, 0.18)` | Inactive status dot |

**Per-agent accents** (used as glow color when that agent is selected):
| Token | Value | Agent |
|---|---|---|
| `--xavier` | `#00f2ff` | cyan |
| `--lucius` | `#ffaa00` | amber |
| `--gekko` | `#00ff88` | mint |
| `--swarmy` | `#ff77cc` | pink |
| `--claude` | `#e07c4c` | orange (= --accent) |

These colors are load-bearing for the panel's identity. Don't change without strong reason.

### 3.2 Typography

Pairing of two voices, codified in CSS today:

- **Mono** — `JetBrains Mono` → `SF Mono` → `Menlo` → `Consolas`. Body. Chat input. Detail text in radial menu items (paths, args). Reads as terminal/prompt context.
- **Sans** — `Inter` → system stack (`-apple-system`, `SF Pro Text`, `system-ui`). UI labels: agent names below tiles, recipient summary, util buttons, form fields. Reads as humanist UI chrome.

Discipline: every text element belongs to one voice or the other. No mixing within a single string.

Sizes used today:
- Agent label: 10px, weight 500, letter-spacing +0.4px, opacity 62% rest / 92% hover / 100% selected
- Chat placeholder: inherits body
- Util button: small (~11-12px) sans
- Radial menu verb: Inter 600 white; detail: Mono 400 muted

### 3.3 Geometry + motion

- Border radii: 22px (panel), 14px (tiles, glass cards), 8px (small pills like recipient summary). Consistent step-down.
- Glass effect: `backdrop-filter: blur(40px) saturate(140%)` on panel and items. The saturate is what gives the warmth — drop it and the glass goes flat.
- Motion easing: single token `--ease: cubic-bezier(0.16, 1, 0.3, 1)`. Used everywhere. Don't introduce a second easing without good reason.
- Standard durations: hover transforms 0.25s, color transitions 0.2-0.3s, radial fan stagger 80ms per item.
- Hover lift: tiles raise 2px on hover (`translateY(-2px)`). Subtle, tactile.

### 3.4 Component primitives

The pieces we've built and reuse:

| Primitive | Role | Defined at |
|---|---|---|
| Panel | The glass slab everything sits on. `--bg-deep`, blur, `--border-medium`, 22px radius | `.panel` |
| Agent tile | 44px button + avatar + status dot + label below | `.agent-tile`, `.agent-btn`, `.status-dot`, `.agent-label` |
| Add tile | Dashed-border placeholder mirroring agent tile geometry | `.add-btn` |
| Chat input row | Glass-pill input + orange Send button | `.chat-row`, `.chat-wrap`, `.send-btn` |
| Meta row | Recipient pill + util buttons (Edit/All/Deploy) | `.meta-row`, `.recipient-summary`, `.util-btn` |
| Confirm overlay | Inline ✓ / ✗ takeover for destructive actions | `.confirm-overlay` |
| Radial menu | Cascade fan of glass cards on right-click, with verb + detail | `.radial-menu`, `.radial-item` |
| Status dot | 8px circle, green-glow when on | `.status-dot.on` |
| Selection glow | Per-agent colored shadow when tile active | `.agent-btn.active.<id>` |

These are the Lego bricks. The iso command center reuses every one of them in its non-iso surfaces.

### 3.5 Behaviors as design

- **Edit mode is the only gate for destructive actions.** Default state hides destructive controls completely. The dashed-border re-skin signals "configuration mode."
- **Right-click for context.** Cwd / restart / kill / attach all live in the radial fan, never on the panel chrome.
- **Inline confirms, never modals.** Tile takeover with ✓/✗, auto-cancel after 4s of silence.
- **Always-visible chat.** No toggle to hide the input. Chat is the centerpiece.
- **Status dots, not text.** Liveness is communicated visually, polled every 3s.
- **Drag freely.** Every non-interactive surface is a grab handle.

These constraints are part of the design system, not just implementation choices.

---

## 4. Directional reference: the iso aesthetic

Inspiration (not target for AgentRemote): the AI-rendered iso "Armory" screenshot shows three composition zones — left archetype rail, center iso world, right runtime mission control — over a desaturated dark indigo backplate (`#08090a`-ish), warmth from amber glow on active rooms, cyan-to-violet biome variation per project type.

**What AgentRemote inherits from that direction:**
- Same accent palette (Anthropic orange + per-agent colors)
- Same dark glass aesthetic
- Same "ambient liveness" pattern (status dots = simplified version of the iso world's glow tiles)

**What AgentRemote doesn't inherit:**
- The iso projection itself
- Tilemaps, sprite-rendered rooms, walking agents
- Three-zone layout (AgentRemote is one-zone HUD; ACRM hosts the three-zone command center)

The iso version is its own product, lives in ACRM under the validate-proposal track. AgentRemote stays compact.

---

## 5. Architecture for the new home

**Path:** `~/ai_projects/agent-remote/`

**Stack:**
- Electron (frameless, transparent, always-on-top — same flags as current)
- TypeScript + esbuild or Vite (current is plain JS; type safety and a real bundler graduate it from prototype)
- Renderer: vanilla DOM today; React optional later if the surface complexity grows. Don't pull React for the lite HUD just because the iso center uses it.
- IPC: same hardened `execFile`-with-argv pattern; no shell strings
- xterm.js + node-pty for the in-tile terminal expand (deferred — see open decisions)
- Agent registry: reads `~/agent-launch-scripts/agents.json` (single source of truth — AgentRemote doesn't fork it)
- Tmux orchestration: shells out to `~/agent-launch-scripts/launch-agent.sh` and `chq-tmux.sh` (AgentRemote is a UI on top of the existing scripts — doesn't reimplement them)

**Directory layout target:**
```
~/ai_projects/agent-remote/
├── package.json
├── tsconfig.json
├── DESIGN.md           # (this doc, copied/symlinked at repo init)
├── README.md
├── src/
│   ├── main/           # Electron main process — IPC, tmux shell-out, global shortcut, file watcher
│   ├── renderer/       # UI layer — index.html → index.tsx, components/, styles/tokens.css
│   ├── shared/         # Types shared between main + renderer (registry shape, IPC contract)
│   └── assets/         # Avatar SVGs (synced from agent-launch-scripts)
├── design-system/
│   ├── tokens.json     # The color / typography / motion tokens from §3
│   ├── tokens.css      # Generated CSS custom properties
│   └── components/     # Storybook-or-similar previews of the primitives
└── scripts/
    └── sync-registry.sh  # One-way mirror agent-launch-scripts/agents.json → here
```

**Build/run:**
- `bun install` (or pnpm — Bun preferred for speed)
- `bun run dev` — launches Electron with HMR
- `bun run build` — produces a packaged `.dmg`/`.app`
- `bun run launch` — replaces today's `bash launch-remote.sh` with a typed entrypoint

**Where the current remote-app/ goes:**
- Stays in place during migration (don't delete)
- Becomes deprecated once AgentRemote's first-released version reaches feature parity
- Keep it around for ~1 month as the fallback HUD; remove via a git mv to `agent-launch-scripts/deprecated/remote-app/` once AgentRemote is the daily driver

---

## 6. Migration plan

Three phases, each independently shippable:

**Phase 0 — Spec lock (this doc).** Pin the tokens and the architecture. Name is locked: AgentRemote. Done when Richard approves the tokens table in §3.

**Phase 1 — Repo init.** `~/ai_projects/agent-remote/` scaffolded with the layout in §5. Tokens extracted to `design-system/tokens.css`. `package.json` with TypeScript + Electron + esbuild. Empty `src/` skeleton. README + DESIGN.md in place. ~1 day.

**Phase 2 — Feature parity transplant.** Port current Electron code into TS in the new repo. Same UX. Same registry (read directly from `~/agent-launch-scripts/agents.json`). Same IPC patterns (hardened argv, no shell). Verify drag-region, radial menu, status dots, edit mode, global shortcut, broadcast all still work. ~2-3 days. At end: switch the `Ctrl+Shift+Space` global shortcut to summon the new app, deprecate the old `launch-remote.sh`.

**Phase 3 — Diverge.** AgentRemote grows in its new home: tmux command palette, layout presets, xterm.js inline expand, anything else. The old `remote-app/` is git-mv'd to `deprecated/` once Phase 2 has soaked for ~1 week.

**Non-goals during migration:** no aesthetic changes, no new features, no rewrites. Phase 2 is a pure port.

---

## 7. Open decisions

These need Richard's call before Phase 1 starts:

1. **Bun vs pnpm vs npm** for the new repo. Default Bun unless he prefers pnpm/npm conventions.
2. **TS strictness.** Default `strict: true`, no escape hatches. Confirm.
3. **xterm.js inline expand** — is this a Phase 3 feature or wait until the iso spike resolves? AgentRemote could ship without it forever and stay valuable. Defer is the cheaper call.
4. **Auto-update** — does AgentRemote auto-update via `electron-updater` once installed, or stays manual? Single-user, manual is fine; if the team grows, auto-update matters.

These are real picks, not menu-padding. Each one has a default I'd pick if Richard punts:
- Package manager: Bun
- TS: strict
- xterm: defer to Phase 3
- Auto-update: manual

---

## 8. What this doc commits to

- The design tokens in §3 are stable. Future PRs reference these by name; new tokens must justify themselves.
- The architecture in §5 is the target. Phase-by-phase migration is the path.
- The aesthetic direction in §4 is the ceiling — AgentRemote doesn't go iso, ACRM does.

What this doc *doesn't* commit to: anything in the iso command center / ACRM-RoomGrid spike track. That's a separate proposal under separate validation.
