# AGENTS.md

## Scope

This directory contains the current AgentRemote Electron app: `main.js` for native process control and IPC, `index.html` for the renderer, and `assets/` for avatars.

## Commands

```bash
npm install
bash ../launch-remote.sh
```

`npm test` is intentionally not a useful gate today; `package.json` still exits with the default placeholder test.

## Edit Rules

- Use argv-style process execution in `main.js`; avoid shell string interpolation for tmux, iTerm, or file operations.
- Keep the HUD lightweight: local spawn, attach, broadcast, status, voice, and nearby operator controls.
- Do not add ACRM/Atlas/Swarmy worker-runtime state here unless a plan explicitly assigns it.
- Preserve the local Whisper hold-to-talk path and immediate send feedback when touching keybindings or broadcast flow.
- Keep UI changes aligned with `../DESIGN.md` tokens and component primitives.

## Verification

- Launch with `bash ../launch-remote.sh` after UI or IPC changes.
- Check for duplicates with `pgrep -fl "Electron\\.app/Contents/MacOS/Electron \\." | grep remote-app`.
- Validate tmux-facing changes against a real or intentionally mocked `chq` session before claiming success.
