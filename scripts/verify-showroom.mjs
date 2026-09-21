import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function verifyShowroom(env=process.env){
 const checks={};
 try{
  const origin=new URL(env.PUBLIC_ORIGIN);
  if(origin.protocol!=='https:'||origin.origin!==env.PUBLIC_ORIGIN)throw new Error('invalid_origin');
  let healthy=false;
  for(let i=0;i<10&&!healthy;i++){
   await wait(i?6000:12000);
   try{const r=await fetch(origin.origin+'/healthz',{signal:AbortSignal.timeout(7000),redirect:'error'});healthy=r.ok&&(await r.json()).service==='friendly-office';}catch{}
  }
  checks.publicHttpsHealth=healthy;
  for(const [route,path,key] of [['/','../public/index.html','html'],['/style.css?v=showroom-2','../public/style.css','css'],['/app.js?v=showroom-2','../public/app.js','javascript'],['/showroom.avif','../public/showroom.avif','artwork'],['/apprentice-views.js','../public/apprentice-views.js','apprenticeViews'],['/apprentice-case.js','../public/apprentice-case.js','apprenticeCases']]){
   const r=await fetch(origin.origin+route,{signal:AbortSignal.timeout(10000),redirect:'error'});
   const bytes=Buffer.from(await r.arrayBuffer());
   checks[key]=r.ok&&digest(bytes)===digest(readFileSync(new URL(path,import.meta.url)));
   if(key==='artwork')checks.avifMime=String(r.headers.get('content-type')).startsWith('image/avif');
  }
  const r=await fetch(origin.origin+'/api/state',{signal:AbortSignal.timeout(10000),redirect:'error'});
  checks.unauthenticatedStateDenied=r.status===401;
  for(const route of ['cases','lessons']){const denied=await fetch(origin.origin+'/api/apprentice/'+route,{signal:AbortSignal.timeout(10000),redirect:'error'});checks['private_'+route]=denied.status===401;}
  checks.securityHeaders=!!r.headers.get('content-security-policy')&&r.headers.get('x-frame-options')==='DENY';
 }catch(error){checks.verificationError=String(error.cause?.code||error.code||error.name||'error').replace(/[^a-zA-Z0-9_]/g,'').slice(0,60);}
 console.log('SHOWROOM_HOSTED_CHECK '+JSON.stringify({checks,allCheckedPassed:Object.values(checks).every(v=>v===true)}));
 return checks;
}
