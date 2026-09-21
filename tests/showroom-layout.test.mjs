import test from 'node:test';
import assert from 'node:assert/strict';
import { showroomLayout } from '../public/showroom-layout.mjs';
for (const [width,height] of [[1672,741],[1354,741],[1024,600],[768,500],[390,214],[320,176],[844,330]]) {
 for (const room of ['overview','door','concessions','storage']) {
  test(`${room} covers ${width} x ${height} without empty edges`, () => {
   const p=showroomLayout(width,height,room);
   assert.ok(p);
   assert.ok(Math.abs(p.dx) <= (p.width*p.zoom-width)/2+1e-7);
   assert.ok(Math.abs(p.dy) <= (p.height*p.zoom-height)/2+1e-7);
   assert.ok(p.width*p.zoom >= width-1e-7);
   assert.ok(p.height*p.zoom >= height-1e-7);
  });
 }
}
test('empty, invalid and hidden viewports are ignored',()=>{
 for(const pair of [[0,1],[1,0],[-1,1],[NaN,1],[Infinity,2],['390',214]]) assert.equal(showroomLayout(...pair),null);
});
test('unknown room values use overview',()=>{
 for(const room of ['missing','__proto__','constructor']) assert.deepEqual(showroomLayout(390,214,room),showroomLayout(390,214,'overview'));
});
