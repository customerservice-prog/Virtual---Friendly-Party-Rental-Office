/** Pure viewport math: keep every scenic crop inside its image boundaries. */
export function showroomLayout(width, height, room = 'overview') {
  if (![width, height].every(n => Number.isFinite(n) && n > 0)) return null;
  const scale = Math.max(width / 1354, height / 741);
  const w = 1354 * scale, h = 741 * scale;
  const targets = { overview: [.5,.5,1], door: [.9,.33,1.85], concessions: [.71,.30,2.15], storage: [.34,.16,1.95] };
  const [x,y,zoom] = Object.hasOwn(targets,room) ? targets[room] : targets.overview;
  const limitX = Math.max(0,(w * zoom - width)/2);
  const limitY = Math.max(0,(h * zoom - height)/2);
  const clamp = (value,limit) => Math.max(-limit,Math.min(limit,value));
  return { width:w,height:h,zoom,dx:clamp(-(x-.5)*w*zoom,limitX),dy:clamp(-(y-.5)*h*zoom,limitY) };
}
