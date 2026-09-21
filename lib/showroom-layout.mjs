/** Keep every scenic crop inside the supplied illustration, including after resize. */
export function showroomPlacement(width, height, room = 'overview') {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('A positive, finite viewport is required.');
  }
  const views = {
    overview: [0.5, 0.5, 1],
    door: [0.9, 0.33, 1.85],
    concessions: [0.71, 0.30, 2.15],
    storage: [0.34, 0.16, 1.95]
  };
  const [x, y, zoom] = views[room] || views.overview;
  const scale = Math.max(width / 1354, height / 741);
  const stageWidth = 1354 * scale, stageHeight = 741 * scale;
  const maxX = Math.max(0, (stageWidth * zoom - width) / 2);
  const maxY = Math.max(0, (stageHeight * zoom - height) / 2);
  const clamp = (value, max) => Math.max(-max, Math.min(max, value));
  const dx = clamp(-(x - 0.5) * stageWidth * zoom, maxX);
  const dy = clamp(-(y - 0.5) * stageHeight * zoom, maxY);
  return { width: stageWidth, height: stageHeight, zoom, dx, dy,
    transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(${zoom})` };
}
