// tmux-deploy.js — native, swarmy-free single-window spawn for AgentRemote.
//
// Ported faithfully from swarmy `agentremote_runtime.py` (cmd_add teams branch,
// create_agent_pane, configure_session, write_agent_loop_script). The operator
// model is ONE tmux session + ONE window with every selected agent as a tiled
// pane (BUG B fix), surfaced through the existing iTerm control-mode viewer.
//
// This module is pure-logic + injectable side effects:
//   - The argv builders below construct tmux argv arrays (no shell strings).
//   - `deploySingleWindow` takes injected `runTmux` / `writeFile` / `chmod` so it
//     is unit-testable and runs against isolated throwaway tmux sessions in tests.
//
// Parity notes (faithful to swarmy; deviations documented in the spec report):
//   - The per-agent loop wrapper exports SWARMY_*_OVERRIDE env vars because that
//     is `launch-agent.sh`'s existing contract (launch-agent.sh:181-196). The
//     name is the launcher's, not swarmy's, so it is preserved deliberately.
//   - Ownership sentinel is written as @agentremote_runtime (value "agentremote")
//     AND read back from both @agentremote_runtime and the legacy @swarmy_runtime
//     so existing live sessions keep working with kill-session / attach.

const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');
const { canonicalAgentBase } = require('./pane-resolver');

const SINGLE_WINDOW_LAYOUT = 'single';
const OWNERSHIP_OPTION = '@agentremote_runtime';
const LEGACY_OWNERSHIP_OPTION = '@swarmy_runtime';
const OWNERSHIP_VALUE = 'agentremote';
const LAYOUT_OPTION = '@chq_layout';
const DEFAULT_WINDOW_NAME = 'agents';
const DEFAULT_TMUX_WIDTH = 220;
const DEFAULT_TMUX_HEIGHT = 50;

// Runtime override keys that map to launch-agent.sh env vars.
const OVERRIDE_ENV = {
  runtime: 'SWARMY_RUNTIME_OVERRIDE',
  model: 'SWARMY_MODEL_OVERRIDE',
  reasoning_effort: 'SWARMY_REASONING_EFFORT_OVERRIDE',
  provider: 'SWARMY_PROVIDER_OVERRIDE',
  sandbox: 'SWARMY_SANDBOX_OVERRIDE',
  approval_policy: 'SWARMY_APPROVAL_POLICY_OVERRIDE'
};

// ---------------------------------------------------------------------------
// Quoting — the shlex.quote idiom: wrap in single quotes, and turn any embedded
// single quote into '\'' (close, escaped-quote, reopen). Used ONLY inside the
// generated bash loop script (a file we write), never to assemble a command we
// hand to execFile — those use argv arrays.
// ---------------------------------------------------------------------------
function shlexQuote(value) {
  return `'${String(value == null ? '' : value).replace(/'/g, `'\\''`)}'`;
}

// ---------------------------------------------------------------------------
// Pure tmux argv builders (no shell strings)
// ---------------------------------------------------------------------------
function newSessionArgs({ session, windowName, cwd, command, width = DEFAULT_TMUX_WIDTH, height = DEFAULT_TMUX_HEIGHT }) {
  return [
    'new-session', '-d',
    '-s', String(session),
    '-n', String(windowName),
    '-c', String(cwd),
    '-x', String(width),
    '-y', String(height),
    '-P', '-F', '#{pane_id}',
    String(command)
  ];
}

function splitWindowArgs({ windowTarget, cwd, command }) {
  return [
    'split-window', '-h',
    '-t', String(windowTarget),
    '-c', String(cwd),
    '-P', '-F', '#{pane_id}',
    String(command)
  ];
}

function selectLayoutTiledArgs(windowTarget) {
  return ['select-layout', '-t', String(windowTarget), 'tiled'];
}

function setPaneIdentityArgs(paneId, identity) {
  return ['set-option', '-p', '-t', String(paneId), '@agent-identity', String(identity)];
}

function setPaneTitleArgs(paneId, title) {
  return ['select-pane', '-t', String(paneId), '-T', String(title)];
}

function remainOnExitArgs(paneId) {
  return ['set-option', '-p', '-t', String(paneId), 'remain-on-exit', 'on'];
}

function paneDiedHookArgs(paneId, restartShell) {
  // The run-shell arg must be ONE token. tmux set-hook re-tokenizes the hook
  // value, so an unquoted `run-shell <cmd with spaces>` is rejected ("too many
  // arguments") and no hook installs. Double-quote the whole command; the inner
  // paths are single-quoted via shlexQuote, so embedding inside "..." is safe.
  return ['set-hook', '-p', '-t', String(paneId), 'pane-died', `run-shell "${restartShell}"`];
}

function setSessionLayoutArgs(session, layout = SINGLE_WINDOW_LAYOUT) {
  return ['set-option', '-t', String(session), '-q', LAYOUT_OPTION, String(layout)];
}

// M1 — swarmy configure_session parity. In the single tiled window the pane
// BORDER is the only per-agent label (the core "select target" value), and pane
// titles must be protected from the running TUI. Returns the argv list for each
// session option.
function sessionDisplayOptionArgsList(session) {
  const s = String(session);
  return [
    ['set-option', '-t', s, 'pane-border-status', 'top'],
    ['set-option', '-t', s, 'pane-border-format', ' #T '],
    ['set-option', '-t', s, '-q', 'allow-set-title', 'off']
  ];
}

function setOwnershipArgs(session) {
  return ['set-option', '-t', String(session), '-q', OWNERSHIP_OPTION, OWNERSHIP_VALUE];
}

// Bridge: also stamp the legacy @swarmy_runtime (same value). Stop/Attach still
// delegate to swarmy python, which gates on require_owned_session reading
// @swarmy_runtime; without this a freshly native-created session would be
// refused by those paths (and the deploy's own viewer-attach would fail).
// Remove once attach/stop are also native.
function setLegacyOwnershipArgs(session) {
  return ['set-option', '-t', String(session), '-q', LEGACY_OWNERSHIP_OPTION, OWNERSHIP_VALUE];
}

function hasSessionArgs(session) {
  return ['has-session', '-t', String(session)];
}

function displayMessageArgs(paneTarget, format) {
  return ['display-message', '-t', String(paneTarget), '-p', String(format)];
}

// List @agent-identity for every pane in the session — used to skip agents that
// are already live so a re-deploy does not create duplicate panes (swarmy parity).
// `-s` scopes to ALL windows in the session: the Attach button breaks a pane into
// its own window, so a current-window-only list would miss it and duplicate it.
function listPaneIdentitiesArgs(session) {
  return ['list-panes', '-s', '-t', String(session), '-F', '#{@agent-identity}'];
}

// The respawn shell wired into the pane-died hook (faithful to swarmy
// configure_pane_auto_restart): re-check auto_restart, and if allowed, respawn
// the SAME pane id in place so the agent restarts after a crash.
function restartShellFor(scriptPath, paneId) {
  return `bash ${shlexQuote(scriptPath)} --agentremote-should-restart && tmux respawn-pane -k -t ${shlexQuote(paneId)}`;
}

// ---------------------------------------------------------------------------
// Per-agent loop wrapper — faithful port of swarmy write_agent_loop_script.
// Honors auto_restart from the registry, exports any runtime overrides as the
// SWARMY_*_OVERRIDE env vars launch-agent.sh reads, then execs launch-agent.sh.
// ---------------------------------------------------------------------------
function buildAgentLoopScript({ agentId, registryPath, launchAgentPath, cwd, logPath, overrides = {} }) {
  const overrideExports = [];
  for (const [key, envVar] of Object.entries(OVERRIDE_ENV)) {
    const value = overrides[key];
    if (value !== undefined && value !== null && String(value).length > 0) {
      overrideExports.push(`export ${envVar}=${shlexQuote(value)}`);
    }
  }
  const resolvedLog = logPath || '/tmp/agentremote-deploy.log';
  const lines = [
    '#!/usr/bin/env bash',
    'set -u',
    `cd ${shlexQuote(cwd)}`,
    `LOG=${shlexQuote(resolvedLog)}`,
    `AGENT_ID=${shlexQuote(agentId)}`,
    `REGISTRY=${shlexQuote(registryPath)}`,
    `LAUNCH_AGENT=${shlexQuote(launchAgentPath)}`,
    ...overrideExports,
    'should_restart() {',
    '  ar=$(python3 - "${REGISTRY}" "${AGENT_ID}" <<\'PY\' 2>/dev/null',
    'import json, sys',
    'path, agent_id = sys.argv[1:3]',
    'data = json.load(open(path))',
    "for row in data.get('agents', []):",
    "    if row.get('id') == agent_id:",
    "        print(str(row.get('auto_restart', True)).lower())",
    '        break',
    'PY',
    '  )',
    '  if [[ -n "${ar}" && "${ar}" != "true" ]]; then',
    '    echo "[$(date \'+%F %T\')] auto_restart=false agent=${AGENT_ID}" | tee -a "${LOG}"',
    '    return 1',
    '  fi',
    '  echo "[$(date \'+%F %T\')] auto_restart=true agent=${AGENT_ID}" | tee -a "${LOG}"',
    '  return 0',
    '}',
    'if [[ "${1:-}" == "--agentremote-should-restart" ]]; then',
    '  should_restart',
    '  exit $?',
    'fi',
    'echo "[$(date \'+%F %T\')] agentremote exec launch agent=${AGENT_ID}" | tee -a "${LOG}"',
    'exec env AGENT_REGISTRY="${REGISTRY}" bash "${LAUNCH_AGENT}" "${AGENT_ID}"',
    ''
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Sidecar entry — identical shape to swarmy update_sidecar so pane-resolver's
// pane_id+session match keeps working. window/pane are coerced to int.
// ---------------------------------------------------------------------------
function nowIsoZ() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function sidecarEntryFromDisplay({ paneId, session, window, pane, team, runtimeMetadata }) {
  const entry = {
    pane_id: String(paneId),
    session: String(session),
    window: /^\d+$/.test(String(window)) ? Number(window) : window,
    pane: /^\d+$/.test(String(pane)) ? Number(pane) : pane
  };
  if (team) entry.team = team;
  if (runtimeMetadata) entry.runtime_metadata = runtimeMetadata;
  entry.updated_at = nowIsoZ();
  entry.runtime_source = 'agentremote';
  entry.runtime_dispatch = 'tmux-deploy';
  return entry;
}

// ---------------------------------------------------------------------------
// Default side effects (injectable for tests). runTmux runs a tmux argv array
// synchronously and returns { status, stdout, stderr }. All callers pass argv
// arrays built above — never a shell string.
// ---------------------------------------------------------------------------
function defaultRunTmux(args) {
  const res = childProcess.spawnSync('tmux', args, { encoding: 'utf8' });
  return {
    status: typeof res.status === 'number' ? res.status : (res.error ? 1 : 0),
    stdout: res.stdout || '',
    stderr: res.stderr || (res.error ? String(res.error.message) : '')
  };
}

function defaultWriteScript(scriptPath, body) {
  fs.writeFileSync(scriptPath, body);
  fs.chmodSync(scriptPath, 0o700);
}

function defaultReadSidecar(sidecarPath) {
  try {
    return JSON.parse(fs.readFileSync(sidecarPath, 'utf8')) || {};
  } catch {
    return {};
  }
}

function defaultWriteSidecar(sidecarPath, data) {
  const tmp = `${sidecarPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, sidecarPath);
}

function safeLabel(value, fallback) {
  const cleaned = String(value || '')
    .replace(/[^a-zA-Z0-9_.:@+ -]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || String(fallback || 'agent')).slice(0, 48);
}

// ---------------------------------------------------------------------------
// deploySingleWindow — the native, swarmy-free spawn. ONE session, ONE window,
// every selected agent a tiled pane. Faithful collapse of swarmy cmd_add's
// teams branch (all agents share one window) + create_agent_pane per pane.
//
// Side effects are injectable: { runTmux, writeScript, readSidecar, writeSidecar }.
// `commandForAgent` lets tests substitute a trivial command; in production it is
// the per-agent loop wrapper (buildAgentLoopScript) written to scriptDir.
//
// Returns { ok, session, layout, panes:[{id, paneId}], error? }.
// ---------------------------------------------------------------------------
function deploySingleWindow(opts = {}) {
  const {
    session,
    agents = [],
    registryPath,
    launchAgentPath,
    sidecarPath,
    scriptDir,
    windowName = DEFAULT_WINDOW_NAME,
    width = DEFAULT_TMUX_WIDTH,
    height = DEFAULT_TMUX_HEIGHT,
    runTmux = defaultRunTmux,
    writeScript = defaultWriteScript,
    readSidecar = defaultReadSidecar,
    writeSidecar = defaultWriteSidecar,
    commandForAgent = null,
    runtimeMetadataForAgent = null
  } = opts;

  if (!session || !/^[a-z0-9_-]+$/i.test(session)) {
    return { ok: false, error: 'invalid session name' };
  }
  const deployable = (agents || []).filter(a => a && /^[a-z0-9_-]+$/i.test(a.id));
  if (deployable.length === 0) {
    return { ok: false, error: 'no deployable agents' };
  }

  const windowTarget = `${session}:${windowName}`;
  const created = [];
  const skipped = [];

  // Resolve the per-agent command. In production this writes the loop wrapper
  // and returns `bash <script>`; in tests `commandForAgent` short-circuits it.
  function commandFor(agent) {
    if (typeof commandForAgent === 'function') return commandForAgent(agent);
    const scriptPath = path.join(scriptDir || os_tmpdir(), `${session}-${agent.id}.sh`);
    const body = buildAgentLoopScript({
      agentId: agent.id,
      registryPath,
      launchAgentPath,
      cwd: agent.cwd,
      logPath: path.join(scriptDir || os_tmpdir(), `${session}-${agent.id}.log`),
      overrides: agent.overrides || {}
    });
    writeScript(scriptPath, body);
    return { command: `bash ${shlexQuote(scriptPath)}`, scriptPath };
  }

  function resolveCommand(agent) {
    const c = commandFor(agent);
    if (typeof c === 'string') return { command: c, scriptPath: null };
    return c;
  }

  const sessionExists = runTmux(hasSessionArgs(session)).status === 0;
  let firstPaneCreated = false;

  // Agents already live in the session (by @agent-identity) are skipped so a
  // re-deploy never duplicates a pane (faithful to swarmy cmd_add, which skips
  // agents with a resolvable live pane). Identities are CANONICALIZED (trailing
  // -runtime stripped, same as the resolver) so a swarmy-tagged `kenpachi-claude`
  // pane is recognized when re-deploying the raw `kenpachi` id (H4).
  const liveIdentities = new Set();
  if (sessionExists) {
    const idRes = runTmux(listPaneIdentitiesArgs(session));
    if (idRes.status === 0) {
      for (const line of (idRes.stdout || '').split('\n')) {
        const id = canonicalAgentBase(line.trim());
        if (id) liveIdentities.add(id);
      }
    }
  }

  for (const agent of deployable) {
    if (liveIdentities.has(canonicalAgentBase(agent.id))) {
      // Already running — leave its pane untouched, just refresh the sidecar.
      skipped.push(agent.id);
      continue;
    }
    const { command, scriptPath } = resolveCommand(agent);
    let res;
    if (!sessionExists && !firstPaneCreated) {
      res = runTmux(newSessionArgs({ session, windowName, cwd: agent.cwd, command, width, height }));
      firstPaneCreated = true;
    } else {
      res = runTmux(splitWindowArgs({ windowTarget, cwd: agent.cwd, command }));
    }
    if (res.status !== 0) {
      return { ok: false, error: (res.stderr || 'tmux pane creation failed').trim(), session, panes: created };
    }
    const paneId = (res.stdout || '').trim();
    if (!paneId) {
      return { ok: false, error: 'tmux did not return a pane id', session, panes: created };
    }

    const label = safeLabel(agent.displayName, agent.id);
    runTmux(setPaneIdentityArgs(paneId, agent.id));
    runTmux(setPaneTitleArgs(paneId, label));
    runTmux(remainOnExitArgs(paneId));
    if (scriptPath) {
      // B1: surface a hook-install failure instead of silently dropping the
      // restart loop. tmux rejects a malformed run-shell value non-zero.
      const hookRes = runTmux(paneDiedHookArgs(paneId, restartShellFor(scriptPath, paneId)));
      if (hookRes.status !== 0) {
        return {
          ok: false,
          error: `failed to install auto-restart hook for ${agent.id}: ${(hookRes.stderr || 'set-hook failed').trim()}`,
          session,
          panes: created
        };
      }
    }

    // H2: probe liveness in ONE display-message (also collapses the old 3-call
    // sidecar query). An agent whose command exited instantly leaves a dead
    // remain-on-exit pane with an empty session_name — that is a failed launch,
    // not a deployed agent. Do NOT push it to `created` (no ghost identity/hook
    // entry) and do NOT claim ok:true.
    const probe = runTmux(displayMessageArgs(paneId, '#{pane_dead}\t#{session_name}\t#{window_index}\t#{pane_index}'));
    const [deadFlag = '', sName = '', wIndex = '', pIndex = ''] = (probe.status === 0 ? (probe.stdout || '') : '').trim().split('\t');
    if (probe.status !== 0 || deadFlag === '1' || sName === '') {
      return {
        ok: false,
        error: `agent ${agent.id} exited immediately (pane did not stay live)`,
        session,
        panes: created
      };
    }
    created.push({ id: agent.id, paneId, scriptPath, session: sName, window: wIndex, pane: pIndex });
  }

  // Re-tile so N panes stay balanced in the single window (only when we added
  // at least one pane — a pure re-deploy of already-live agents leaves the
  // existing layout untouched).
  if (created.length > 0) {
    runTmux(selectLayoutTiledArgs(windowTarget));
  }

  // Stamp session ownership + layout (idempotent on repeat deploys). Write BOTH
  // the native tag and the legacy @swarmy_runtime so swarmy-delegated Stop/Attach
  // still recognize the session until those paths are also native.
  runTmux(setOwnershipArgs(session));
  runTmux(setLegacyOwnershipArgs(session));
  runTmux(setSessionLayoutArgs(session, SINGLE_WINDOW_LAYOUT));

  // M1: swarmy configure_session parity — pane border shows the per-agent title
  // (the "select target" label in a single tiled window) and titles are protected.
  for (const optArgs of sessionDisplayOptionArgsList(session)) {
    runTmux(optArgs);
  }

  // Write the sidecar in swarmy shape for each created pane. session/window/pane
  // were captured by the liveness probe above (one display-message per pane), so
  // every entry here is from a pane proven live — no empty-session corruption.
  const sidecar = readSidecar(sidecarPath);
  for (const pane of created) {
    const meta = typeof runtimeMetadataForAgent === 'function' ? runtimeMetadataForAgent(pane.id) : undefined;
    sidecar[pane.id] = {
      ...(sidecar[pane.id] || {}),
      ...sidecarEntryFromDisplay({
        paneId: pane.paneId,
        session: pane.session || session,
        window: pane.window,
        pane: pane.pane,
        runtimeMetadata: meta
      })
    };
  }
  if (sidecarPath) writeSidecar(sidecarPath, sidecar);

  return { ok: true, session, layout: SINGLE_WINDOW_LAYOUT, panes: created, skipped };
}

function os_tmpdir() {
  return require('os').tmpdir();
}

module.exports = {
  // constants
  SINGLE_WINDOW_LAYOUT,
  OWNERSHIP_OPTION,
  LEGACY_OWNERSHIP_OPTION,
  OWNERSHIP_VALUE,
  LAYOUT_OPTION,
  DEFAULT_WINDOW_NAME,
  DEFAULT_TMUX_WIDTH,
  DEFAULT_TMUX_HEIGHT,
  OVERRIDE_ENV,
  // quoting
  shlexQuote,
  // argv builders
  newSessionArgs,
  splitWindowArgs,
  selectLayoutTiledArgs,
  setPaneIdentityArgs,
  setPaneTitleArgs,
  remainOnExitArgs,
  paneDiedHookArgs,
  setSessionLayoutArgs,
  sessionDisplayOptionArgsList,
  setOwnershipArgs,
  setLegacyOwnershipArgs,
  hasSessionArgs,
  displayMessageArgs,
  listPaneIdentitiesArgs,
  restartShellFor,
  // script + sidecar
  buildAgentLoopScript,
  sidecarEntryFromDisplay,
  nowIsoZ,
  // orchestrator + default side effects
  deploySingleWindow,
  defaultRunTmux,
  defaultReadSidecar,
  defaultWriteSidecar
};
