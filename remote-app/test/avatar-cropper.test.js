const test = require('node:test');
const assert = require('node:assert/strict');
const { computeCropRect, clampPan, zoomClamp, VIEW_SIZE, ZOOM_MIN, ZOOM_MAX } =
  require('../avatar-cropper.js');

test('zoomClamp clamps below minimum', () => {
  assert.equal(zoomClamp(0), ZOOM_MIN);
  assert.equal(zoomClamp(-1), ZOOM_MIN);
  assert.equal(zoomClamp(0.1), ZOOM_MIN);
});

test('zoomClamp clamps above maximum', () => {
  assert.equal(zoomClamp(5), ZOOM_MAX);
  assert.equal(zoomClamp(100), ZOOM_MAX);
});

test('zoomClamp passes through valid values', () => {
  assert.equal(zoomClamp(1), 1);
  assert.equal(zoomClamp(2), 2);
  assert.equal(zoomClamp(ZOOM_MIN), ZOOM_MIN);
  assert.equal(zoomClamp(ZOOM_MAX), ZOOM_MAX);
});

test('clampPan: image larger than viewport — pan is constrained to cover crop square', () => {
  // 640×640 image at zoom=1, viewport=320 → image fills 640×640, can pan [320-640, 0] in x
  const result = clampPan({ x: 100, y: 100 }, 1, 320, 640, 640);
  assert.equal(result.x, 0);
  assert.equal(result.y, 0);
  // pan that scrolls right
  const r2 = clampPan({ x: -200, y: -100 }, 1, 320, 640, 640);
  assert.equal(r2.x, -200);
  assert.equal(r2.y, -100);
  // pan that goes too far left (image would leave gap on right)
  const r3 = clampPan({ x: -999, y: -999 }, 1, 320, 640, 640);
  assert.equal(r3.x, 320 - 640); // = -320
  assert.equal(r3.y, 320 - 640);
});

test('clampPan: image smaller than viewport — centers the image', () => {
  // 100×100 image at zoom=1, viewport=320 → image fills 100×100, should be centered
  const result = clampPan({ x: 0, y: 0 }, 1, 320, 100, 100);
  assert.equal(result.x, (320 - 100) / 2); // = 110
  assert.equal(result.y, (320 - 100) / 2);
});

test('clampPan: image smaller than viewport ignores requested pan', () => {
  const result = clampPan({ x: -500, y: 999 }, 1, 320, 100, 100);
  assert.equal(result.x, (320 - 100) / 2);
  assert.equal(result.y, (320 - 100) / 2);
});

test('clampPan: zoom=2 on 200×200 image makes 400×400 scaled — can pan', () => {
  const result = clampPan({ x: -50, y: -80 }, 2, 320, 200, 200);
  assert.equal(result.x, -50);
  assert.equal(result.y, -80);
  // clamp at max left
  const r2 = clampPan({ x: -999, y: -999 }, 2, 320, 200, 200);
  assert.equal(r2.x, 320 - 400); // = -80
  assert.equal(r2.y, 320 - 400);
});

test('computeCropRect: centered image at zoom=1 returns full image', () => {
  // 320×320 image at zoom=1, pan=(0,0), viewport=320
  const r = computeCropRect({ x: 0, y: 0 }, 1, 320, 320, 320);
  assert.equal(r.sx, 0);
  assert.equal(r.sy, 0);
  assert.equal(r.sw, 320);
  assert.equal(r.sh, 320);
});

test('computeCropRect: pan pans into image correctly', () => {
  // 640×640 image at zoom=1, pan=(-160,-80) → viewport shows x=160..480, y=80..400
  const r = computeCropRect({ x: -160, y: -80 }, 1, 320, 640, 640);
  assert.equal(r.sx, 160);
  assert.equal(r.sy, 80);
  assert.equal(r.sw, 320);
  assert.equal(r.sh, 320);
});

test('computeCropRect: zoom=2 on 640×640 shows smaller source region', () => {
  // At zoom=2, viewport 320px = 160px source. pan=0,0 → shows top-left 160×160
  const r = computeCropRect({ x: 0, y: 0 }, 2, 320, 640, 640);
  assert.equal(r.sx, 0);
  assert.equal(r.sy, 0);
  assert.equal(r.sw, 160);
  assert.equal(r.sh, 160);
});

test('computeCropRect: clamps sw/sh to image bounds', () => {
  // 320×320 image at zoom=0.5 → source size = 640×640, but image is only 320×320
  const r = computeCropRect({ x: 0, y: 0 }, 0.5, 320, 320, 320);
  assert.equal(r.sx, 0);
  assert.equal(r.sy, 0);
  assert.equal(r.sw, 320); // clamped to image width
  assert.equal(r.sh, 320);
});

test('VIEW_SIZE is 320', () => {
  assert.equal(VIEW_SIZE, 320);
});

test('avatar-cropper module exports do not reference DOM (no ReferenceError on require)', () => {
  // The require at the top of this file would have thrown if top-level DOM was accessed.
  assert.equal(typeof computeCropRect, 'function');
  assert.equal(typeof clampPan, 'function');
  assert.equal(typeof zoomClamp, 'function');
});
