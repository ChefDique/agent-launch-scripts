function parseTmuxClientLines(output) {
  return String(output || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [name = '', controlMode = '0'] = line.split('\t');
      return { name, controlMode };
    });
}

function hasRequiredTmuxClient(layout, clients) {
  const list = Array.isArray(clients) ? clients : [];
  if (String(layout || '') === 'ittab') {
    return list.some(client => String(client.controlMode) === '1');
  }
  return list.length > 0;
}

module.exports = {
  hasRequiredTmuxClient,
  parseTmuxClientLines
};
