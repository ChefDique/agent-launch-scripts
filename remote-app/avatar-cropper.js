/*
 * avatar-cropper.js — Avatar crop modal for AgentRemote
 *
 * Design: Standalone center-screen modal (Option C). After the native file
 * dialog returns a path, the renderer calls openAvatarCropper(dataUrl) which
 * presents this modal. On Save, the caller receives a PNG data URL and sends it
 * to the existing save-pasted-image IPC, getting back a temp file path that
 * becomes pickedAvatarPath. update-agent-form then copies that temp file to
 * assets/<agentId>.png as usual. No new storage location is needed.
 *
 * DOM: The overlay is appended to document.body on open and removed on close or
 * Cancel. Only one instance exists at a time.
 *
 * IPC contract: This module needs no new IPC. The read-image-as-data-url IPC
 * (added to main.js) converts a local file path to a base64 data URL so it can
 * be loaded into an HTMLImageElement inside the sandboxed renderer. The cropped
 * result goes to save-pasted-image (existing) for temp storage.
 *
 * Replaced avatar pick site: pickAvatar() in index.html, which previously set
 * pickedAvatarPath directly from the native dialog result. The modified version
 * reads the file as a data URL, opens this modal, waits for the result, then
 * sends the cropped PNG to save-pasted-image.
 *
 * Pure crop-math exports at the bottom are used by test/avatar-cropper.test.js
 * without any DOM or canvas dependency.
 */

(function () {
  const VIEW_SIZE = 320;
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 4.0;
  const ZOOM_STEP_BTN = 1.2;

  // ─── Pure crop math ────────────────────────────────────────────────────────

  function zoomClamp(z) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  }

  // Constrain pan so the image always fills the crop square.
  // If the image is smaller than viewSize at this zoom, center it instead.
  function clampPan(pan, zoom, viewSize, imgW, imgH) {
    const sw = imgW * zoom;
    const sh = imgH * zoom;
    let x = pan.x;
    let y = pan.y;
    if (sw <= viewSize) {
      x = (viewSize - sw) / 2;
    } else {
      x = Math.min(0, Math.max(viewSize - sw, x));
    }
    if (sh <= viewSize) {
      y = (viewSize - sh) / 2;
    } else {
      y = Math.min(0, Math.max(viewSize - sh, y));
    }
    return { x, y };
  }

  // Returns the source rectangle on the original image that maps to the crop
  // viewport (sx, sy, sw, sh in image-pixel coordinates).
  function computeCropRect(pan, zoom, viewSize, imgW, imgH) {
    const sx = -pan.x / zoom;
    const sy = -pan.y / zoom;
    const sw = viewSize / zoom;
    const sh = viewSize / zoom;
    const csx = Math.max(0, sx);
    const csy = Math.max(0, sy);
    return {
      sx: csx,
      sy: csy,
      sw: Math.min(sw, imgW - csx),
      sh: Math.min(sh, imgH - csy),
    };
  }

  // ─── Canvas rendering ──────────────────────────────────────────────────────

  function renderCrop(ctx, img, pan, zoom, viewSize) {
    ctx.clearRect(0, 0, viewSize, viewSize);
    ctx.drawImage(img, pan.x, pan.y, img.naturalWidth * zoom, img.naturalHeight * zoom);
  }

  function cropToDataUrl(img, pan, zoom, viewSize) {
    const c = document.createElement('canvas');
    c.width = viewSize;
    c.height = viewSize;
    renderCrop(c.getContext('2d'), img, pan, zoom, viewSize);
    return c.toDataURL('image/png');
  }

  // ─── Modal ─────────────────────────────────────────────────────────────────

  let _activeModal = null;

  function openAvatarCropper(dataUrl) {
    return new Promise((resolve) => {
      if (_activeModal) { _activeModal.remove(); _activeModal = null; }

      const overlay = document.createElement('div');
      overlay.className = 'avatar-cropper-overlay';
      overlay.innerHTML = `
        <div class="avatar-cropper-modal">
          <div class="avatar-cropper-header">
            <span class="avatar-cropper-title">Crop Avatar</span>
            <button class="avatar-cropper-x" title="Cancel">&#x2715;</button>
          </div>
          <div class="avatar-cropper-viewport">
            <canvas class="avatar-cropper-canvas" width="${VIEW_SIZE}" height="${VIEW_SIZE}"></canvas>
          </div>
          <div class="avatar-cropper-zoom-row">
            <button class="avatar-cropper-zoom-btn" data-dir="-1" title="Zoom out">&#x2212;</button>
            <input class="avatar-cropper-slider" type="range"
              min="${ZOOM_MIN}" max="${ZOOM_MAX}" step="0.01" value="1" />
            <button class="avatar-cropper-zoom-btn" data-dir="1" title="Zoom in">+</button>
          </div>
          <div class="avatar-cropper-actions">
            <button class="avatar-cropper-cancel">Cancel</button>
            <button class="avatar-cropper-save">Save</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      _activeModal = overlay;

      const canvas = overlay.querySelector('.avatar-cropper-canvas');
      const ctx = canvas.getContext('2d');
      const slider = overlay.querySelector('.avatar-cropper-slider');

      let state = { pan: { x: 0, y: 0 }, zoom: 1 };
      let drag = null;

      function redraw() {
        renderCrop(ctx, img, state.pan, state.zoom, VIEW_SIZE);
      }

      function applyZoom(newZoom, pivotX, pivotY) {
        const px = pivotX == null ? VIEW_SIZE / 2 : pivotX;
        const py = pivotY == null ? VIEW_SIZE / 2 : pivotY;
        const clamped = zoomClamp(newZoom);
        const scale = clamped / state.zoom;
        const newPan = {
          x: px - (px - state.pan.x) * scale,
          y: py - (py - state.pan.y) * scale,
        };
        state.zoom = clamped;
        state.pan = clampPan(newPan, clamped, VIEW_SIZE, img.naturalWidth, img.naturalHeight);
        slider.value = clamped;
        redraw();
      }

      canvas.addEventListener('mousedown', e => {
        drag = { startX: e.clientX, startY: e.clientY, panStart: { ...state.pan } };
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
      });

      const onMouseMove = e => {
        if (!drag) return;
        const newPan = {
          x: drag.panStart.x + (e.clientX - drag.startX),
          y: drag.panStart.y + (e.clientY - drag.startY),
        };
        state.pan = clampPan(newPan, state.zoom, VIEW_SIZE, img.naturalWidth, img.naturalHeight);
        redraw();
      };

      const onMouseUp = () => {
        drag = null;
        canvas.style.cursor = 'grab';
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);

      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        applyZoom(state.zoom * (1 - e.deltaY * 0.001), e.clientX - rect.left, e.clientY - rect.top);
      }, { passive: false });

      slider.addEventListener('input', () => applyZoom(parseFloat(slider.value)));

      overlay.querySelectorAll('.avatar-cropper-zoom-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = parseInt(btn.dataset.dir, 10);
          applyZoom(state.zoom * (dir > 0 ? ZOOM_STEP_BTN : 1 / ZOOM_STEP_BTN));
        });
      });

      function cleanup() {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        overlay.remove();
        _activeModal = null;
      }

      const doCancel = () => { cleanup(); resolve(null); };

      overlay.querySelector('.avatar-cropper-x').addEventListener('click', doCancel);
      overlay.querySelector('.avatar-cropper-cancel').addEventListener('click', doCancel);
      overlay.addEventListener('click', e => { if (e.target === overlay) doCancel(); });

      overlay.querySelector('.avatar-cropper-save').addEventListener('click', () => {
        const dataUrlOut = cropToDataUrl(img, state.pan, state.zoom, VIEW_SIZE);
        cleanup();
        resolve(dataUrlOut);
      });

      const img = new Image();

      img.onload = () => {
        const initZoom = zoomClamp(Math.max(VIEW_SIZE / img.naturalWidth, VIEW_SIZE / img.naturalHeight));
        state.zoom = initZoom;
        state.pan = clampPan({ x: 0, y: 0 }, initZoom, VIEW_SIZE, img.naturalWidth, img.naturalHeight);
        slider.value = initZoom;
        redraw();
      };

      img.onerror = () => { cleanup(); resolve(null); };
      img.src = dataUrl;

      canvas.style.cursor = 'grab';
    });
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  if (typeof window === 'undefined') {
    // Node.js test environment
    module.exports = { computeCropRect, clampPan, zoomClamp, VIEW_SIZE, ZOOM_MIN, ZOOM_MAX };
  } else {
    window.AvatarCropper = { openAvatarCropper };
  }
})();
