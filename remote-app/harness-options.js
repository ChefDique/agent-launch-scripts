const HARNESS_OPTIONS = [
  {
    id: 'claude',
    label: 'Claude',
    logo: 'claude.svg',
    themeColor: '#e07c4c'
  },
  {
    id: 'codex',
    label: 'Codex',
    logo: 'codex.svg',
    themeColor: '#10a37f'
  },
  {
    id: 'hermes',
    label: 'Hermes',
    logo: 'hermes.svg',
    themeColor: '#f5c542'
  },
  {
    id: 'openclaw',
    label: 'OpenClaw',
    logo: 'openclaw.svg',
    themeColor: '#ff4b4b'
  }
];

const HARNESS_RUNTIME_IDS = HARNESS_OPTIONS.map(option => option.id);
const DEFAULT_HARNESS_RUNTIME = 'codex';

function normalizeRuntime(runtime) {
  const clean = String(runtime || '').trim().toLowerCase();
  return HARNESS_RUNTIME_IDS.includes(clean) ? clean : DEFAULT_HARNESS_RUNTIME;
}

function harnessOptionFor(runtime) {
  const id = normalizeRuntime(runtime);
  return HARNESS_OPTIONS.find(option => option.id === id) || HARNESS_OPTIONS[1];
}

module.exports = {
  DEFAULT_HARNESS_RUNTIME,
  HARNESS_OPTIONS,
  HARNESS_RUNTIME_IDS,
  harnessOptionFor,
  normalizeRuntime
};
