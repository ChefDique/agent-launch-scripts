const test = require('node:test');
const assert = require('node:assert/strict');

const { computeWindowBounds } = require('../window-geometry');

test('resize geometry grows upward when downward growth would clip at the workarea bottom', () => {
  const current = { x: 100, y: 760, width: 620, height: 240 };
  const workArea = { x: 0, y: 0, width: 1440, height: 900 };
  const next = computeWindowBounds(current, { width: 620, height: 420 }, workArea);

  assert.equal(next.height, 420);
  assert.equal(next.y + next.height <= workArea.y + workArea.height - 4, true);
  assert.equal(next.y < current.y, true);
});

test('resize geometry clamps oversized overlays to the visible workarea', () => {
  const current = { x: 20, y: 20, width: 620, height: 240 };
  const workArea = { x: 0, y: 0, width: 700, height: 500 };
  const next = computeWindowBounds(current, { width: 1600, height: 1200 }, workArea);

  assert.equal(next.width, 692);
  assert.equal(next.height, 492);
  assert.equal(next.x, 4);
  assert.equal(next.y, 4);
});
