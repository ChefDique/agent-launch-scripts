# Harness Engineering R&D Retrieval Report

> **SUPERSEDED 2026-08-14. QMD current status: retired for agent context.
> Graphify current status: retired for agent context.** Use `sb ask` for search and
> `sb links` / `sb rdeps` for relationships. The commands below are a historical run
> record. Do not reuse them as setup or operating instructions.

Date: 2026-05-05

## Query

Richard asked for a QMD / graphify / Obsidian retrieval in the R&D repo to recover Lucius's latest repo-structure direction, using OpenAI's "Harness engineering: leveraging Codex in an agent-first world" article as the search anchor.

## Historical Commands Run — Do Not Reuse

```bash
# Historical evidence only. Current agents use sb.
qmd status
qmd query "lex: Lucius repo structure optimal repository structuring AGENTS.md CLAUDE.md progressive disclosure docs system path-migration
vec: recent Lucius recommendation optimal repo layout docs system of record progressive disclosure agent legibility qmd graphify obsidian
hyde: The latest Lucius report lays out an optimal repository structure based on OpenAI harness engineering: AGENTS.md as a small map and docs as the canonical system of record, using progressive disclosure and versioned execution plans." -n 12 --line-numbers
graphify query "What repo structure did Lucius or the R&D corpus recommend for agent-first Codex repositories, especially AGENTS.md as map, docs as system of record, progressive disclosure, Obsidian/QMD/graphify?" --budget 1800
```

## Retrieval Findings

- At the time, QMD was healthy enough for the lookup: the local index had 4,421 files indexed and 86,965 embeddings, updated about 9 hours before the query. This is not current status.
- The strongest QMD hit for Codex repo instructions was `repos/codex-cli-best-practice/best-practice/codex-agents-md.md`, which recommends `AGENTS.md` as the preferred root instruction file, kept under about 150 lines, with detailed procedures extracted into docs or skills.
- The R&D handoff surfaced a scheduled Lucius item for 2026-05-05: a `Lead-Agent_template.md` plus an ideal repo scaffold, producing two artifacts: canonical lead-agent file structure and ideal repo directory layout for new lead-agent projects.
- The graphify query did not return a useful semantic answer for this question. It mostly surfaced code/AST nodes, matching the prior R&D caveat that the current graphify output should not be treated as proof of semantic wiki indexing.
- The durable lesson is to keep Markdown as source. The current retrieval and
  relationship route is Second Brain (`sb`).

## Article-Derived Structure

The OpenAI article's repo-knowledge pattern maps cleanly onto this repo:

| Article pattern | Local application |
|---|---|
| Short `AGENTS.md` as a map | Add a concise root `AGENTS.md` and a scoped `remote-app/AGENTS.md`. |
| `docs/` as system of record | Promote this directory to the durable knowledge map via `docs/README.md`. |
| Versioned execution plans | Move active plans under `docs/exec-plans/active/`. |
| References and generated knowledge | Keep retrieval reports under `docs/references/`; reserve `docs/generated/` for future machine-created maps. |
| Progressive disclosure | Root file points to product, operations, design, and active-plan docs instead of duplicating them. |

## Decision For This Repo

Apply the structure lightly first:

1. Add a short root `AGENTS.md`.
2. Add `docs/README.md` as the source-of-truth index.
3. Move the active AgentRemote pivot plan to `docs/exec-plans/active/`.
4. Add product and operations boundary docs.
5. Keep `DESIGN.md` at root until the AgentRemote migration path settles, then split it into `docs/design-docs/`.

## Sources

- OpenAI, "Harness engineering: leveraging Codex in an agent-first world": https://openai.com/index/harness-engineering/
- R&D QMD hit: `qmd://ai_projects/research-and-development/repos/codex-cli-best-practice/best-practice/codex-agents-md.md`
- R&D QMD hit: `qmd://ai_projects/research-and-development/memory/handoff.md`
