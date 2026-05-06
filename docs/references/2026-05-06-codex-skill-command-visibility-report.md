# Codex Skill Command Visibility Report

Date: 2026-05-06
Author: Codex / TMUX-MASTA lane
Audience: Lucius / R&D agent-infra lane
Repo context: `/Users/richardadair/agent-launch-scripts`

## Purpose

Richard reported that after restarting Codex, the expected lifecycle commands were still not available:

- `/gogo`
- `/done`
- `/chores`

The purpose of this report is to give Lucius the full operational context, the live evidence found in this session, and recommendations for a durable skill-management model that does not create yet another duplicated skill stack on top of existing Claude skills.

## User Concern

Richard's follow-up concern was whether the attempted fix means he now has to manage another complete set of Codex-only skills in addition to Claude skills.

The short answer is no. The correct model should be one shared neutral skill layer, with strict YAML compatibility, plus runtime-specific/project-specific skills only where truly necessary.

Recommended skill-layer model:

- `~/.agents/skills/`: shared neutral skills usable by Codex and Claude where possible.
- `~/.codex/skills/`: Codex-only system/installed skills.
- `~/.claude/skills/` and project `.claude/skills/`: Claude-only or project-local skills.

Shared lifecycle skills such as `gogo`, `done`, and `chores` should live in `~/.agents/skills/` and be written in YAML that both runtimes can parse.

## Findings

### 1. The active Codex config already pinned the lifecycle skills

The active config surface is lowercase:

```text
/Users/richardadair/.codex/config.toml
```

It already had explicit `[[skills.config]]` entries for:

```text
/Users/richardadair/.agents/skills/chores/SKILL.md
/Users/richardadair/.agents/skills/done/SKILL.md
/Users/richardadair/.agents/skills/gogo/SKILL.md
```

So the immediate failure was not a missing config pin.

### 2. Codex was failing to load `gogo` because of invalid YAML

Live Codex logs showed:

```text
failed to load skill /Users/richardadair/.agents/skills/gogo/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 130
```

Root cause:

```yaml
description: Generic session-start dispatcher. Use when the user invokes /gogo or when a launched agent receives /gogo at startup: prefer ...
```

That unquoted colon after `startup:` is legal-looking prose, but YAML parses it as a mapping separator in this context. Codex's loader rejected the skill.

Fix applied:

```yaml
description: "Generic session-start dispatcher. Use when the user invokes /gogo or when a launched agent receives /gogo at startup: prefer ..."
```

This is not Codex-specific content. It is simply stricter, valid YAML and should remain compatible with Claude.

### 3. `done` contained a stale uppercase path

`/Users/richardadair/.agents/skills/done/SKILL.md` referenced:

```text
~/.Codex/skills/chores/SKILL.md
```

That was stale for the current machine/runtime. The active shared skill path is:

```text
/Users/richardadair/.agents/skills/chores/SKILL.md
```

Fix applied: update the `done` skill body to reference the real shared `chores` skill path.

### 4. Verification after the fix

Validation run:

```bash
ruby -e 'require "yaml"; ARGV.each { |path| text = File.read(path); fm = text[/\A---\n(.*?)\n---/m, 1]; YAML.safe_load(fm); puts "ok #{path}" }' \
  /Users/richardadair/.agents/skills/gogo/SKILL.md \
  /Users/richardadair/.agents/skills/chores/SKILL.md \
  /Users/richardadair/.agents/skills/done/SKILL.md
```

Result: all three parse as valid YAML.

Fresh Codex prompt-input verification:

```bash
codex debug prompt-input 'test skill load'
```

Observed in the generated skill list:

- `gogo` from `r1/gogo/SKILL.md`
- `chores` from `r1/chores/SKILL.md`
- `done` from `r1/done/SKILL.md`

So the model-visible skill loader path is now fixed.

### 5. Slash UI behavior may still differ from skill availability

The underlying skill loader can now see the skills. However, Richard may still experience a UI difference:

- Some Codex surfaces expose the skill as a mention such as `[$done](...)`.
- The literal slash picker may not always behave like Claude Code's slash-command system.

That is an invocation surface issue, not evidence that the shared skill file must be duplicated.

## Recommendations

### Recommendation 1: Treat `~/.agents/skills` as the canonical shared lifecycle layer

Keep `gogo`, `done`, and `chores` as one canonical copy under:

```text
/Users/richardadair/.agents/skills/
```

Do not create separate Codex and Claude copies unless a real runtime-specific behavior requires it.

### Recommendation 2: Adopt a shared-skill YAML lint gate

Add a small validation script that checks every shared skill's YAML frontmatter using a strict parser. It should catch:

- unquoted colons in descriptions
- missing `---` delimiters
- descriptions exceeding Codex loader limits
- missing `name`
- missing or malformed `description`

Suggested command shape:

```bash
ruby -e 'require "yaml"; Dir["/Users/richardadair/.agents/skills/*/SKILL.md"].each { |path| text = File.read(path); fm = text[/\A---\n(.*?)\n---/m, 1] or abort("missing frontmatter: #{path}"); YAML.safe_load(fm); puts "ok #{path}" }'
```

This should become part of any skill edit closeout.

### Recommendation 3: Separate "skill installed" from "slash command visible"

Future debugging should report these as separate states:

- File exists.
- Config pins it.
- YAML loader accepts it.
- `codex debug prompt-input` includes it.
- UI slash picker displays it.
- User can invoke it through the actual current UI surface.

This avoids repeating the mistake of claiming a command is fixed because config looks correct.

### Recommendation 4: Keep runtime-specific behavior inside shared skill bodies where possible

If a behavior differs between Claude and Codex, prefer conditional text inside the shared skill:

```text
If running in Codex, verify with `codex debug prompt-input`.
If running in Claude Code, verify with the Claude skill/slash command surface.
```

Only split into separate skill files when the command semantics are genuinely different.

### Recommendation 5: Create a short "Skill Compatibility Contract"

Lucius should consider adding a lightweight compatibility doc for shared skills:

- Frontmatter must be strict YAML.
- Quote all descriptions.
- Keep `description` under Codex's max length.
- Use ASCII unless needed.
- Shared skills must not assume `~/.Codex` or `~/.Claude` path casing.
- Prefer absolute paths only where global machine paths are intentionally canonical.
- Test via both a parser and the runtime prompt/debug surface.

## Delivery Status To Lucius

At report creation time, Codex verified:

```bash
codex mcp list
```

`claude-peers` is registered but disabled in this live Codex MCP session:

```text
claude-peers ... Status disabled
```

Fallback CLI check:

```bash
bun /Users/richardadair/.claude/mcp-servers/claude-peers/cli.ts status
```

Result:

```text
Broker: ok (0 peer(s) registered)
URL: http://127.0.0.1:7899
```

No Lucius peer was registered through `claude-peers`. Local tmux inspection also did not show a Lucius pane. A Hermes gateway process exists for `--profile lucius`, but that is not the same as a reachable `claude-peers` recipient.

Therefore, if no peer appears after this report is written, the report should be considered ready for Lucius but not delivered through `claude-peers`.

## Bottom Line

The failure was not "Codex needs a separate skill universe." The failure was strict YAML compatibility and stale path drift.

The durable fix is a shared skill layer with a compatibility lint gate and explicit live-runtime verification.
