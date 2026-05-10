const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

// --------------------------------------------------------------------------
// Regression test (v1.4.1): when the add/edit-agent form is open, the panel
// measurement must add the form's hidden-by-overflow height back so the window
// grows to fit the FULL form even after .add-form's max-height clamp triggers.
// Static check on the renderer source — verifies the syncWindowSize() loop
// reads addForm.scrollHeight - addForm.clientHeight when body.adding is set.
// --------------------------------------------------------------------------

test('syncWindowSize compensates for .add-form max-height clamp when body.adding is set', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  // The fix lives in syncWindowSize: when body.adding is true, add the form's
  // hidden overflow height (scrollHeight - clientHeight) to the requested
  // window height. Without this, .add-form's max-height: calc(100vh - 48px)
  // clamps the form's box before measurement and the window never grows past
  // the current viewport height — so additional dock rows (3+) cause form
  // rows to clip behind an internal scrollbar that Richard didn't ask for.
  assert.match(html, /classList\.contains\('adding'\)/,
    'syncWindowSize must check the body.adding class');
  assert.match(html, /addForm\.scrollHeight\s*-\s*addForm\.clientHeight/,
    'syncWindowSize must add the form overflow (scrollHeight - clientHeight) back to the requested height');
  assert.match(html, /extraFormGrow/,
    'extraFormGrow accumulator must participate in the panel height calc');
});

test('add-form keeps its max-height + dark scrollbar styling as the absolute fallback', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  // The fix is window-grow first, internal-scroll-as-fallback. The CSS clamp
  // and dark scrollbar styling must remain so a tiny workarea (laptop without
  // external display, e.g. 13" at HiDPI) still degrades gracefully without
  // exposing the white native Chromium scrollbar.
  assert.match(html, /\.add-form\s*\{[\s\S]*?max-height:\s*calc\(100vh\s*-\s*\d+px\)[\s\S]*?overflow-y:\s*auto/,
    '.add-form must keep its max-height + overflow-y:auto fallback');
  assert.match(html, /\.add-form::-webkit-scrollbar-thumb/,
    '.add-form must keep its dark scrollbar thumb styling');
});
