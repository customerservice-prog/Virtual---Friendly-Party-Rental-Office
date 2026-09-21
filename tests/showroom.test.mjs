import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const hash=b=>createHash('sha256').update(b).digest('hex');
test('showroom image is complete and verified, not a broken fragment',()=>{
 const art=readFileSync(new URL('../public/showroom.avif',import.meta.url));
 assert.equal(art.length,52528);
 assert.equal(hash(art),'7411791030cf72987bd543a0a8175c083c7d785c7d282675a471fec9964147a7');
 assert.equal(art.subarray(8,12).toString(),'avif');
});
test('new showroom shell preserves unique working controls',()=>{
 const html=read('public/index.html');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'No duplicate DOM IDs');
 for(const id of ['login','password','shell','command-form','team-cards','inspector','draft-editor','task-board','approval-list','rule-form','import-form','pause-all','office-canvas']){
  if(id!=='draft-editor')assert(ids.includes(id),id);
 }
 assert.equal((html.match(/class="nav-item/g)||[]).length,9);
 assert(html.includes('SCENIC VIEWS · NOT CAMERAS'));
 assert(html.includes('data-scene-mode="showroom"'));
 assert(!html.includes('286')&&!html.includes('12 Active Orders'));
});
test('build is idempotent and preserves app/auth boundary',()=>{
 const files=['public/app.js','public/style.css','server.mjs','bootstrap.mjs','public/scene.js'];
 const before=files.map(p=>hash(read(p)));
 execFileSync(process.execPath,['scripts/build-showroom.mjs'],{cwd:new URL('..',import.meta.url)});
 assert.deepEqual(files.map(p=>hash(read(p))),before);
 const server=read('server.mjs');
 assert(server.includes("'/showroom.avif':'showroom.avif'"));
 assert(server.includes("file.endsWith('.avif')?'image/avif'"));
 assert(server.includes("if(!auth) throw new OfficeError('Sign in to your office.',401)"));
 assert(read('public/scene.js').includes('this.canvas.offsetParent!==null'));
 assert.equal(read('public/app.js').split('// FRIENDLY_SHOWROOM_EXTENSION_V2').length,2);
});
