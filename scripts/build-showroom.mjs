import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const write=(p,s)=>writeFileSync(resolve(root,p),s);
// Fixed, lossless fragments keep connector uploads bounded. They are one AVIF,
// not executable content. A missing or changed byte fails the build.
const parts=Array.from({length:9},(_,i)=>resolve(root,`assets/showroom/part-${String(i).padStart(2,'0')}.bin`));
const art=Buffer.concat(parts.map(p=>readFileSync(p)));
if(art.length!==52528||createHash('sha256').update(art).digest('hex')!=='7411791030cf72987bd543a0a8175c083c7d785c7d282675a471fec9964147a7')throw new Error('Showroom artwork integrity check failed.');
writeFileSync(resolve(root,'public/showroom.avif'),art);
const styles=Array.from({length:5},(_,i)=>read(`assets/styles/part-${String(i).padStart(2,'0')}.css`)).join('');
if(createHash('sha256').update(styles).digest('hex')!=='ace83de5ee535bca8b1a2361b1ba58e7011551ab53dd9726df1d6fe12a0e6e88')throw new Error('Showroom stylesheet integrity check failed.');
write('public/style.css',styles);
const marker='\n// FRIENDLY_SHOWROOM_EXTENSION_V2\n';
let app=read('public/app.js').split(marker)[0];
const init='if(!scene){scene=new OfficeScene';
const lazy="if(!scene && document.body.dataset.sceneMode==='spatial'){scene=new OfficeScene";
if(app.includes(init))app=app.replace(init,lazy);
else if(!app.includes(lazy))throw new Error('Unexpected office app source; refusing to apply a blind frontend patch.');
write('public/app.js',app+marker+read('public/hq.js'));
let server=read('server.mjs');
if(!server.includes("'/showroom.avif':'showroom.avif'")){
  const token="'/icon.svg':'icon.svg'";
  if(!server.includes(token))throw new Error('Static asset allowlist changed; check the server before building.');
  server=server.replace(token,token+",'/showroom.avif':'showroom.avif'");
}
const oldType="const type=file.endsWith('.js')?";
const newType="const type=file.endsWith('.avif')?'image/avif':file.endsWith('.js')?";
if(server.includes(oldType))server=server.replace(oldType,newType);
else if(!server.includes(newType))throw new Error('Static content type handling changed.');
write('server.mjs',server);
let spatial=read('public/scene.js');
const hiddenGuard='!this.lost && !document.hidden && this.canvas.offsetParent!==null &&';
if(!spatial.includes(hiddenGuard)){
 const token='!this.lost && !document.hidden &&';
 if(!spatial.includes(token))throw new Error('Spatial animation guard changed.');
 spatial=spatial.replace(token,hiddenGuard);write('public/scene.js',spatial);
}
// The deployment verifier is read-only and logs no credentials or task contents.
let boot=read('bootstrap.mjs');
const check="\n  if (process.env.SHOWROOM_HOSTED_CHECK === '1') {\n    const { verifyShowroom } = await import('./scripts/verify-showroom.mjs');\n    void verifyShowroom();\n  }\n";
if(!boot.includes('SHOWROOM_HOSTED_CHECK')){
 const token="  await import('./server.mjs');";
 if(!boot.includes(token))throw new Error('Bootstrap changed; verify the entrypoint.');
 boot=boot.replace(token,token+check);write('bootstrap.mjs',boot);
}
console.log('Showroom frontend ready. Task engine, login and business permissions unchanged.');
