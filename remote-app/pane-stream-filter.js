'use strict';

const DEFAULT_PROFILE = Object.freeze({
  id: 'agent-agnostic-pane-stream-v1',
  minProseWords: 3,
  maxRenderedLines: 18
});

function createPaneStreamFilterState() {
  return {
    profileId: DEFAULT_PROFILE.id,
    suppressedBlock: '',
    lastKeptLine: ''
  };
}

function sanitizeTerminalText(raw) {
  return String(raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b[P^_][\s\S]*?\x1b\\/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[()][0-2AB]/g, '')
    .replace(/\x1b[=>]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\t/g, '  ');
}

function normalizePaneLine(line) {
  return String(line || '')
    .replace(/\u00a0/g, ' ')
    .replace(/^\s*[│┃|]+\s*/, '')
    .replace(/^\s*[└├]\s*/, '')
    .replace(/^\s*[⏺●•]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mostlyMatches(text, pattern) {
  const stripped = text.replace(pattern, '');
  return stripped.length <= Math.max(2, text.length * 0.18);
}

function symbolRatio(text) {
  if (!text) return 1;
  const symbols = text.replace(/[A-Za-z0-9\s]/g, '').length;
  return symbols / text.length;
}

function wordCount(text) {
  const words = text.match(/[A-Za-z][A-Za-z0-9'_-]*/g);
  return words ? words.length : 0;
}

function effectiveProfile(profile = DEFAULT_PROFILE) {
  return {
    ...DEFAULT_PROFILE,
    ...(profile && typeof profile === 'object' ? profile : {})
  };
}

function hasSentenceShape(text, profile = DEFAULT_PROFILE) {
  const activeProfile = effectiveProfile(profile);
  const words = wordCount(text);
  if (words < activeProfile.minProseWords) return false;
  if (/[.!?]"?$/.test(text)) return true;
  if (words >= 5 && /[,;:]/.test(text)) return true;
  return words >= 7;
}

function isResidualTerminalFragment(text) {
  if (!text) return true;
  if (text.length <= 3) return true;
  if (/^(?:\[[0-?;<>]*[ -/]*[@-~]\s*)+$/.test(text)) return true;
  if (/^(?:[0-?;<>]+[ -/]*[@-~]\s*)+$/.test(text)) return true;
  return false;
}

function isChromeLine(text, rawLine = text) {
  if (mostlyMatches(text, /[─━═_\-=~\s]/g)) return true;
  if (mostlyMatches(text, /[█▓▒░▁▂▃▄▅▆▇\s]/g)) return true;
  if (/^[╭╮╯╰┌┐└┘├┤┬┴┼│┃─━═\s]+$/.test(rawLine)) return true;
  if (symbolRatio(text) > 0.72 && wordCount(text) < 3) return true;
  return false;
}

function isPromptOrInputChrome(text) {
  if (/^[›❯>$#]\s*/.test(text)) return true;
  if (/^⎿\s*\$/.test(text)) return true;
  if (/\b(tab to queue message|jump to bottom|enter to view|shift\+tab|ctrl\s*\+|esc to|context left|window\b)/i.test(text)) return true;
  if (/\b(describe your task|paste again to expand|please use --channels|loading development channels|downloaded off the internet)\b/i.test(text)) return true;
  return false;
}

function isStatusOrTelemetry(text, rawLine = text) {
  if (/^\s*[✻※]\s+/.test(rawLine)) return true;
  if (/^\[[^\]]+\].+\|.+/.test(text)) return true;
  if (/\bcontext\)?\]/i.test(text) && /[|/]/.test(text)) return true;
  if (/\d+%/.test(text) && /(\$[0-9]|\bcontext\b|\btokens?\b|\bwindow\b|[█▓▒░▁▂▃▄▅▆▇])/i.test(text)) return true;
  if (/\b\d+\s*(?:ms|s|m|h)\b/.test(text) && /\b(tokens?|thought|worked|running|left|elapsed)\b/i.test(text)) return true;
  if (/\b(tasks?|background tasks?|local agents?|done|open|in progress)\b/i.test(text) && /\b\d+\b/.test(text) && !hasSentenceShape(text)) return true;
  if (/\bby(?:pass)? permissions\b/i.test(text)) return true;
  if (/^\[[0-9]{4}-[0-9]{2}-[0-9]{2}[^\]]*\]/.test(text)) return true;
  if (/^\[[^\]]+\]\s+pre[_ -]?launch hook returned/i.test(text)) return true;
  if (/^\[[^\]]*(?:pasted|attachment|image|file)[^\]]*\]/i.test(text)) return true;
  if (/\b(?:tests? passed|smoke passed|checks? passed)\b$/i.test(text)) return true;
  return false;
}

function isToolOrHarnessRow(text, rawLine = text, profile = DEFAULT_PROFILE) {
  const hasUiPrefix = /^\s*(?:[⏺●•└├│┃]|[+]\d+\s+lines?\b)/.test(rawLine);
  const commandVerb = /^(?:run|ran|read|edit|edited|open|opened|search|searched|list|listed|call|called|calling|process|processing|create|created|delete|deleted|move|moved|copy|copied|patch|patched|apply|applied|write|wrote|update|updated)\b/i;
  if (hasUiPrefix && commandVerb.test(text)) return true;
  if (commandVerb.test(text) && /^[A-Za-z]+\s+(?:[\w.-]+:[\w:.-]+|[./~@-]|.*[|/])/.test(text)) return true;
  if (/^(?:ran|running)\s+\d+\s+shell commands?/i.test(text)) return true;
  if (/^Agent\s+["'][^"']+["']\s+(?:completed|launched|failed)\b/i.test(text)) return true;
  if (/^(?:explored|tool|command|shell|task|todo)\b/i.test(text) && !hasSentenceShape(text, profile)) return true;
  if (/^[ MADRCU?!]{1,2}\s+\S+\.(?:js|json|html|md|sh|ts|tsx|css|py)$/i.test(text)) return true;
  if (/^\d+\s+[+-]+/.test(text)) return true;
  if (/^[+-]\d+\s+/.test(text)) return true;
  if (/^[+-]\s*(?:implementation|ull\b|run\b|forensics\b|recurring\b|reviewer\b|[A-Za-z0-9_./-]+\.(?:js|json|html|md|sh|ts|tsx|css|py)\b)/i.test(text)) return true;
  if (/^--\S+/.test(text)) return true;
  if (/^\+?\d+\s+lines?\b/i.test(text)) return true;
  if (/^resume this session with:?.*$/i.test(text)) return true;
  if (/^[a-z][\w-]*\s+--resume\s+/i.test(text)) return true;
  if (/^channels?:\s+[\w:,@.-]+$/i.test(text)) return true;
  if (/^[a-z0-9_.-]+:[a-z0-9_.:-]+$/i.test(text)) return true;
  return false;
}

function isCodeLikeLine(text) {
  if (/^\d+\s+/.test(text) && /(?:[{};]|=>|\.test\(|\\[bdsw]|function\b|const\b|let\b|return\b)/.test(text)) return true;
  if (/^\d+\s+['"`].*['"`],?$/.test(text)) return true;
  if (/(?:\.test\(|=>|return\s+(?:true|false|null|undefined)\s*;|function\s+\w+\(|(?:const|let|var)\s+.+\s*=)/.test(text)) return true;
  if (/^(?:for|do|done|bash|python\d?|echo)\b.*(?:;|--|\$|\||\\)/.test(text)) return true;
  if (/[/\\][a-z]+\)?[gimsuy]*\)?\s*(?:return|=>|;)/i.test(text)) return true;
  return false;
}

function isTaskListRow(text, rawLine = text) {
  if (/^\s*(?:⎿\s*)?[✔✓☑☐◻◼■□○◯]\s+/.test(rawLine)) return true;
  if (/^\s*(?:[-*]|\d+[.)])\s+\[[ x~-]\]\s+/.test(rawLine)) return true;
  if (/^\s*(?:[-*]|\d+[.)])\s+\S.{0,90}$/.test(rawLine) && /\b(?:task|todo|reviewer|implementer|lane|ops-|acrm-)\b/i.test(rawLine)) return true;
  return false;
}

function classifyPaneLine(line, state = createPaneStreamFilterState(), profile = DEFAULT_PROFILE) {
  const activeProfile = effectiveProfile(profile);
  const raw = sanitizeTerminalText(line);
  const text = normalizePaneLine(raw);
  const result = { keep: false, text, kind: 'noise', reason: 'empty', confidence: 1 };

  if (!text) return result;

  if (isResidualTerminalFragment(text)) return { ...result, reason: 'terminal-fragment' };
  if (isChromeLine(text, raw)) return { ...result, reason: 'chrome' };
  if (isPromptOrInputChrome(text)) return { ...result, reason: 'prompt-or-input-chrome' };
  if (isStatusOrTelemetry(text, raw)) return { ...result, reason: 'status-or-telemetry' };
  if (isToolOrHarnessRow(text, raw, activeProfile)) return { ...result, reason: 'tool-or-harness-row' };
  if (isCodeLikeLine(text)) return { ...result, reason: 'code-like-line' };
  if (isTaskListRow(text, raw)) return { ...result, reason: 'task-list-row' };

  const words = wordCount(text);
  const proseLike = hasSentenceShape(text, activeProfile) || (words >= activeProfile.minProseWords && symbolRatio(text) < 0.38);
  if (!proseLike) return { ...result, reason: 'not-prose' };
  if (state.lastKeptLine === text) return { ...result, reason: 'duplicate' };

  state.lastKeptLine = text;
  return { keep: true, text, kind: 'prose', reason: 'prose', confidence: 0.86 };
}

function filterPaneLines(lines, state = createPaneStreamFilterState(), profile = DEFAULT_PROFILE) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => classifyPaneLine(line, state, profile))
    .filter((item) => item.keep)
    .map((item) => item.text);
}

function filterPaneChunk(rawChunk, state = createPaneStreamFilterState(), carry = '', profile = DEFAULT_PROFILE) {
  const text = sanitizeTerminalText(rawChunk);
  if (!text) return { lines: [], carry };
  const parts = `${carry || ''}${text}`.split('\n');
  const nextCarry = parts.pop() || '';
  return {
    lines: filterPaneLines(parts, state, profile),
    carry: nextCarry
  };
}

function cleanPaneLines(lines, options = {}) {
  return filterPaneLines(lines, options.state || createPaneStreamFilterState(), options.profile || DEFAULT_PROFILE);
}

module.exports = {
  DEFAULT_PROFILE,
  classifyPaneLine,
  cleanPaneLines,
  createPaneStreamFilterState,
  filterPaneChunk,
  filterPaneLines,
  normalizePaneLine,
  sanitizeTerminalText
};
