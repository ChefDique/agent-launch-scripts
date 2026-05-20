function validateTmuxSendTarget(value) {
  const target = String(value || '').trim();
  if (!target || !/^(?:%[0-9]+|[a-z0-9_.:@/-]+)$/i.test(target)) {
    throw new Error('invalid tmux send target');
  }
  return target;
}

function normalizeSubmittedText(value) {
  const text = typeof value === 'string' ? value : '';
  if (!text) throw new Error('message required');
  return text;
}

function tmuxSendSubmittedTextArgs(target, text) {
  const message = normalizeSubmittedText(text);
  return [
    'send-keys',
    '-t',
    validateTmuxSendTarget(target),
    '-l',
    '--',
    message,
    ';',
    'send-keys',
    '-t',
    validateTmuxSendTarget(target),
    'Enter'
  ];
}

module.exports = {
  normalizeSubmittedText,
  tmuxSendSubmittedTextArgs,
  validateTmuxSendTarget
};
