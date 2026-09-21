import test from 'node:test';
import assert from 'node:assert/strict';
import { showroomPlacement } from '../lib/showroom-layout.mjs';
const sizes = [[1672,941],[1354,741],[1024,768],[768,1024],[390,844],[360,293],[844,220],[2560,1080]];
for (const room of ['overview','door','concessions','storage']) {
  test(`scenic ${room} covers all viewport edges at desktop, mobile and landscape sizes`, () => {
    for (const [w,h] of sizes) {
      const p=showroomPlacement(w,h,room),epsilon=0.001;
      assert.ok(w/2+p.dx-p.width*p.zoom/2 <= epsilon);
      assert.ok(w/2+p.dx+p.width*p.zoom/2 >= w-epsilon);
      assert.ok(h/2+p.dy-p.height*p.zoom/2 <= epsilon);
      assert.ok(h/2+p.dy+p.height*p.zoom/2 >= h-epsilon);
      assert.ok(p.transform.includes('scale('));
    }
  });
}
test('unknown viewpoint falls back to overview',()=>assert.deepEqual(showroomPlacement(800,600,'unknown'),showroomPlacement(800,600)));
test('invalid geometry is rejected',()=>{for(const w of [0,-1,NaN,Infinity])assert.throws(()=>showroomPlacement(w,600),RangeError);});
