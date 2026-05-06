const DEFAULT_WINDOW_GEOMETRY = {
  minWidth: 380,
  minHeight: 180,
  maxWidth: 1200,
  maxHeight: 900,
  safety: 4
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeWindowBounds(currentBounds, requestedSize, workArea, options = {}) {
  const config = { ...DEFAULT_WINDOW_GEOMETRY, ...options };
  const current = currentBounds || { x: 0, y: 0, width: 620, height: 240 };
  const work = workArea || {
    x: current.x,
    y: current.y,
    width: Math.max(config.minWidth, config.maxWidth),
    height: Math.max(config.minHeight, config.maxHeight)
  };

  const usableWidth = Math.max(config.minWidth, work.width - config.safety * 2);
  const usableHeight = Math.max(config.minHeight, work.height - config.safety * 2);
  const maxWidth = Math.min(config.maxWidth, usableWidth);
  const maxHeight = Math.min(config.maxHeight, usableHeight);

  const requestedWidth = Math.round(requestedSize && requestedSize.width ? requestedSize.width : current.width);
  const requestedHeight = Math.round(requestedSize && requestedSize.height ? requestedSize.height : current.height);

  const width = clamp(requestedWidth, config.minWidth, maxWidth);
  const height = clamp(requestedHeight, config.minHeight, maxHeight);

  const minX = work.x + config.safety;
  const maxX = work.x + work.width - config.safety - width;
  const minY = work.y + config.safety;
  const maxY = work.y + work.height - config.safety - height;

  const x = clamp(current.x, minX, Math.max(minX, maxX));
  const y = clamp(current.y, minY, Math.max(minY, maxY));

  return { x, y, width, height };
}

module.exports = {
  DEFAULT_WINDOW_GEOMETRY,
  computeWindowBounds
};
