# Repo Location Migration

## Canonical Location

`agent-launch-scripts` now lives under the shared project root:

```text
/Users/richardadair/ai_projects/agent-launch-scripts
```

The former path is compatibility-only:

```text
/Users/richardadair/agent-launch-scripts -> /Users/richardadair/ai_projects/agent-launch-scripts
```

Keep the symlink until all launchd jobs, shell aliases, tmux panes, AgentRemote processes, and external shortcuts have been refreshed.

## Runtime Contract

- Scripts should resolve their own directory with `BASH_SOURCE[0]` when operating inside this repo.
- Cross-repo launchers should prefer `$AGENT_LAUNCH_SCRIPTS_ROOT`, then `~/ai_projects/agent-launch-scripts`, then the legacy symlink.
- `agents.json` should use the canonical path for local agent cwd entries.
- AgentRemote runtime truth is the Electron `--app-path`, not whether an Electron process exists.

## Cutover Checklist

1. Verify `git status --short --branch` is clean or explicitly classified.
2. Run launcher and Electron static checks before moving.
3. Stop only AgentRemote, not live tmux agent sessions.
4. Move the checkout to `~/ai_projects/agent-launch-scripts`.
5. Create the compatibility symlink at `~/agent-launch-scripts`.
6. Relaunch AgentRemote from the canonical checkout.
7. Verify `--app-path=/Users/richardadair/ai_projects/agent-launch-scripts/remote-app`.
8. Run `git status`, `git worktree list`, and process checks from the new path.

## Rollback

If the canonical relaunch fails:

1. Stop AgentRemote with `bash ~/ai_projects/agent-launch-scripts/launch-remote.sh stop`.
2. Remove the symlink at `~/agent-launch-scripts`.
3. Move the directory back to `~/agent-launch-scripts`.
4. Relaunch with `bash ~/agent-launch-scripts/launch-remote.sh`.
