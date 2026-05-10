'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const MAX_READ_BYTES = 1024 * 1024;
const HEAD_READ_BYTES = 64 * 1024;

function expandHome(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text === '~') return os.homedir();
  if (text.startsWith('~/')) return path.join(os.homedir(), text.slice(2));
  return text;
}

function safeRealpath(value) {
  const expanded = expandHome(value);
  if (!expanded) return '';
  try {
    return fs.realpathSync(expanded);
  } catch {
    return path.resolve(expanded);
  }
}

function normalizedPath(value) {
  const expanded = expandHome(value);
  if (!expanded) return '';
  return path.resolve(expanded).replace(/\/+$/, '');
}

function claudeSlugForPath(value) {
  return value ? value.replace(/[\/_]/g, '-') : '';
}

function pathOnlySlugForPath(value) {
  return value ? value.replace(/\//g, '-') : '';
}

function claudeProjectSlug(cwd) {
  const resolved = normalizedPath(cwd);
  return claudeSlugForPath(resolved);
}

function claudeProjectSlugCandidates(cwd) {
  const lexical = normalizedPath(cwd);
  const real = safeRealpath(cwd).replace(/\/+$/, '');
  const candidates = [];
  for (const item of [lexical, real].filter(Boolean)) {
    candidates.push(claudeSlugForPath(item));
    candidates.push(pathOnlySlugForPath(item));
  }
  return [...new Set(candidates.filter(Boolean))];
}

function escapeJsonString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function latestJsonlFile(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map((entry) => {
        const filePath = path.join(dir, entry.name);
        const stat = fs.statSync(filePath);
        return { filePath, mtimeMs: stat.mtimeMs, size: stat.size };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return entries[0] || null;
  } catch {
    return null;
  }
}

// Detect whether a Claude session jsonl was renamed to a given agent name on
// startup (via /rename, which writes a `custom-title` event, or the
// `agent-name` event some skills set). Reads the file's head only (cheap) so
// we can scan many sessions without paying for the full body.
function fileMatchesAgentTitle(filePath, expectedTitle) {
  if (!expectedTitle) return false;
  const want = String(expectedTitle).trim().toLowerCase();
  if (!want) return false;
  let head;
  try {
    head = readHead(filePath, HEAD_READ_BYTES);
  } catch {
    return false;
  }
  for (const line of head.split('\n')) {
    if (!line.trim()) continue;
    let parsed;
    try { parsed = JSON.parse(line); } catch { continue; }
    if (!parsed || typeof parsed !== 'object') continue;
    if (parsed.type === 'custom-title' && String(parsed.customTitle || '').trim().toLowerCase() === want) return true;
    if (parsed.type === 'agent-name' && String(parsed.agentName || '').trim().toLowerCase() === want) return true;
  }
  return false;
}

// Pick the most recent Claude session file across one or more project-slug
// directories that also matches the agent's display name. Falls back to plain
// latest-mtime when no displayName is supplied (legacy callers) or no session
// announces itself with a matching custom-title / agent-name event (SDK agents,
// automation-spawned sessions). Crucially, the title-match search runs against
// the union of entries across all candidate dirs before the latest-mtime
// fallback — otherwise a stale slug variant with any jsonl would shadow the
// live slug whenever the same cwd hashes to multiple Claude project slugs
// (e.g. ai_projects vs ai-projects). This binds operator-facing TUI agents
// (Xavier, Lucius, Neo, …) to their own session.
function latestJsonlFileForAgentAcrossDirs(dirs, displayName) {
  const entries = [];
  for (const dir of dirs) {
    let dirEntries;
    try {
      dirEntries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of dirEntries) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      const filePath = path.join(dir, entry.name);
      try {
        const stat = fs.statSync(filePath);
        entries.push({ filePath, mtimeMs: stat.mtimeMs, size: stat.size });
      } catch {
        // skip unreadable session files
      }
    }
  }
  if (!entries.length) return null;
  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (displayName) {
    for (const entry of entries) {
      if (fileMatchesAgentTitle(entry.filePath, displayName)) return entry;
    }
  }
  return entries[0];
}

function claudeProjectsRoot() {
  return process.env.AGENTREMOTE_CLAUDE_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects');
}

function codexSessionsRoot() {
  return process.env.AGENTREMOTE_CODEX_SESSIONS_DIR || path.join(os.homedir(), '.codex', 'sessions');
}

function readHead(filePath, maxBytes = HEAD_READ_BYTES) {
  const stat = fs.statSync(filePath);
  const length = Math.min(stat.size, maxBytes);
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function fileContainsCodexCwd(filePath, size, cwdCandidates) {
  const samples = [
    readHead(filePath),
    readTail(filePath, Math.min(size, MAX_READ_BYTES))
  ];
  return cwdCandidates.some((candidateCwd) => {
    const escaped = escapeJsonString(candidateCwd).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`"cwd"\\s*:\\s*"${escaped}"`);
    return samples.some((sample) => pattern.test(sample));
  });
}

function latestCodexSessionFile(cwd) {
  const cwdCandidates = [...new Set([
    normalizedPath(cwd),
    safeRealpath(cwd).replace(/\/+$/, '')
  ].filter(Boolean))];
  const sessionsRoot = codexSessionsRoot();
  const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const candidates = [];

  function walk(dir, depth = 0) {
    if (depth > 5) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(child, depth + 1);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      try {
        const stat = fs.statSync(child);
        if (stat.mtimeMs < cutoffMs) continue;
        candidates.push({ filePath: child, mtimeMs: stat.mtimeMs, size: stat.size });
      } catch {
        // Ignore unreadable session files.
      }
    }
  }

  walk(sessionsRoot);
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const candidate of candidates.slice(0, 80)) {
    if (fileContainsCodexCwd(candidate.filePath, candidate.size, cwdCandidates)) {
      return candidate;
    }
  }
  return null;
}

function resolveTranscriptFile(agent) {
  const runtime = String(agent && agent.runtime || '').toLowerCase();
  const cwd = agent && agent.cwd;

  if (runtime === 'claude') {
    const displayName = agent && agent.displayName;
    const root = claudeProjectsRoot();
    const slugDirs = claudeProjectSlugCandidates(cwd).map((slug) => path.join(root, slug));
    const direct = latestJsonlFileForAgentAcrossDirs(slugDirs, displayName);
    if (direct) return { ...direct, source: 'claude-transcript' };
  }

  if (runtime === 'codex') {
    const latest = latestCodexSessionFile(cwd);
    if (latest) return { ...latest, source: 'codex-transcript' };
  }

  return null;
}

function readTail(filePath, maxBytes = MAX_READ_BYTES) {
  const stat = fs.statSync(filePath);
  const start = Math.max(0, stat.size - maxBytes);
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    return buffer.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function extractClaudeText(entry) {
  if (!entry || entry.type !== 'assistant') return [];
  const message = entry.message || {};
  if (message.role !== 'assistant') return [];
  const content = message.content;
  if (typeof content === 'string') return [content];
  if (!Array.isArray(content)) return [];
  return content
    .filter((item) => item && item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text);
}

function extractCodexText(entry) {
  if (!entry || entry.type !== 'response_item') return [];
  const payload = entry.payload || {};
  if (payload.type !== 'message' || payload.role !== 'assistant') return [];
  const content = payload.content;
  if (typeof content === 'string') return [content];
  if (!Array.isArray(content)) return [];
  return content
    .filter((item) => item && (item.type === 'output_text' || item.type === 'text') && typeof item.text === 'string')
    .map((item) => item.text);
}

function normalizeMessageText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function transcriptMessagesForAgent(agent, options = {}) {
  const transcript = resolveTranscriptFile(agent);
  if (!transcript) return { ok: false, error: 'agent transcript unavailable', messages: [] };

  const maxMessages = Number.isFinite(Number(options.maxMessages)) ? Number(options.maxMessages) : 8;
  let text = '';
  try {
    text = readTail(transcript.filePath);
  } catch (err) {
    return { ok: false, error: err.message, messages: [] };
  }

  const messages = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const parts = transcript.source === 'claude-transcript'
      ? extractClaudeText(entry)
      : extractCodexText(entry);
    for (const part of parts) {
      const normalized = normalizeMessageText(part);
      if (!normalized) continue;
      if (messages[messages.length - 1] && messages[messages.length - 1].text === normalized) continue;
      messages.push({
        id: entry.uuid || entry.requestId || entry.timestamp || `${transcript.filePath}:${messages.length}`,
        text: normalized,
        timestamp: entry.timestamp || null,
        source: transcript.source
      });
    }
  }

  return {
    ok: true,
    filePath: transcript.filePath,
    source: transcript.source,
    mtimeMs: transcript.mtimeMs,
    messages: messages.slice(-Math.max(1, Math.min(20, maxMessages)))
  };
}

module.exports = {
  claudeProjectSlug,
  expandHome,
  extractClaudeText,
  extractCodexText,
  normalizeMessageText,
  resolveTranscriptFile,
  transcriptMessagesForAgent
};
