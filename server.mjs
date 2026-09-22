import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { Store, OfficeError, roleById, requireText } from './lib/store.mjs';
import { Integrations, validateSnapshot } from './lib/integrations.mjs';
import { Engine, seedPractice, classify } from './lib/engine.mjs';
import { Apprenticeship } from './lib/apprentice-api.mjs';
import { installCommandCenter } from './lib/command-center.mjs';

const ROOT=dirname(fileURLToPath(import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
const jsonHeaders={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
export function validateConfig(env) {
  const production=env.NODE_ENV==='production';
  if(production && (!env.OWNER_PASSWORD || env.OWNER_PASSWORD.length<16)) throw new Error('Production requires an OWNER_PASSWORD of at least 16 characters.');
  if(production && (!env.PUBLIC_ORIGIN || !/^https:\/\/[^/]+$/.test(env.PUBLIC_ORIGIN))) throw new Error('Production requires PUBLIC_ORIGIN=https://your-office-domain without a trailing slash.');
  if(env.PUBLIC_ORIGIN && new URL(env.PUBLIC_ORIGIN).origin!==env.PUBLIC_ORIGIN) throw new Error('PUBLIC_ORIGIN must be an origin only, with no path or trailing slash.');
  if(env.INTEGRATION_ENCRYPTION_KEY && Buffer.from(env.INTEGRATION_ENCRYPTION_KEY,'base64').length!==32) throw new Error('INTEGRATION_ENCRYPTION_KEY must decode to 32 bytes.');
  if(!env.OWNER_PASSWORD && (env.OPENAI_API_KEY || env.GOOGLE_CLIENT_SECRET || env.FPR_READONLY_TOKEN || env.GITHUB_READ_TOKEN)) throw new Error('Set OWNER_PASSWORD before configuring private integrations.');
}
export function createOffice({env=process.env,store=new Store(resolve(env.DATA_DIR||'data','office.sqlite')),integrations,worker=true}={}) {
  validateConfig(env);
  integrations ||= new Integrations(store,env);
  if(env.ENABLE_BUILTIN_AI==='true' && integrations.status().ai.provider==='Friendly private brain') { const settings=store.get('settings'); if(!settings.useAI) store.set('settings',{...settings,useAI:true}); store.set('builtin-ai-initialized',{at:new Date().toISOString(),model:integrations.status().ai.model,enabled:true}); }
  const engine=new Engine(store,integrations),streams=new Set(),attempts=new Map(),requests=new Map(),imports=new Set();
  const apprenticeship=new Apprenticeship(store,integrations,engine);
  if(env.ENABLE_LIVE_SHADOW==='true' && !store.get('live-shadow-initialized')) {
    const settings=store.get('settings');
    store.set('settings',{...settings,mode:'shadow',paused:false,useAI:integrations.status().ai.configured});
    const ap=apprenticeship.data.settings();
    store.set('ap:settings',{...ap,observing:integrations.status().gmail.connected,autoReview:true,includeDrafts:false,consentAt:new Date().toISOString()});
    store.set('live-shadow-initialized',{at:new Date().toISOString(),scope:'read-only orders/site + mailbox observation; outbound email remains owner-approved; phone answering/recording off'});
    store.event(null,'owner','Supervised live shadow initialized','Real read-only business sources may be observed. Customer sends still require exact owner approval; phone answering/recording remain off.');
  }
  installCommandCenter(apprenticeship);
  let timer;
  const passwordSalt=randomBytes(16),expected=env.OWNER_PASSWORD?scryptSync(env.OWNER_PASSWORD,passwordSalt,32):null;
  const anonymousCsrf=randomBytes(24).toString('hex');
  function session(req,{touch=false}={}) {
    if(!expected) return {hash:'local',csrf:anonymousCsrf,expires:Date.now()+8*3600000};
    const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('office_session='))?.slice(15);
    if(!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const tokenHash=hash(token),row=store.db.prepare('SELECT * FROM sessions WHERE hash=? AND expires>?').get(tokenHash,Date.now())||null;
    if(row&&touch){const expires=Date.now()+8*3600000;store.db.prepare('UPDATE sessions SET expires=? WHERE hash=?').run(expires,tokenHash);row.expires=expires;}
    return row;
  }
  function broadcast() {
    if(timer) return;
    timer=setTimeout(()=>{timer=null; for(const stream of streams) stream.res.write('event: refresh\ndata: {}\n\n');},75);
  }
  store.changed=broadcast;
  function output(res,status,data,headers={}) { res.writeHead(status,{...jsonHeaders,...headers}); res.end(JSON.stringify(data)); }
  function checkOrigin(req) {
    const origin=req.headers.origin;
    const allowed=env.PUBLIC_ORIGIN || `http://127.0.0.1:${server.address()?.port}`;
    const localhost=`http://localhost:${server.address()?.port}`;
    if(origin!==allowed && !(env.NODE_ENV!=='production' && !env.PUBLIC_ORIGIN && origin===localhost)) throw new OfficeError('Request origin was not accepted.',403);
  }
  async function body(req,maxBytes=90000,withRaw=false) {
    if(!String(req.headers['content-type']||'').startsWith('application/json')) throw new OfficeError('Use application/json.',415);
    let size=0; const chunks=[];
    for await(const chunk of req) { size+=chunk.length; if(size>maxBytes) throw new OfficeError('Request too large.',413); chunks.push(chunk); }
    try { const value=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'); if(!value || Array.isArray(value) || typeof value!=='object') throw new Error(); return withRaw?{value,raw:Buffer.concat(chunks)}:value; } catch { throw new OfficeError('Invalid JSON object.'); }
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('x-content-type-options','nosniff');
    res.setHeader('referrer-policy','no-referrer');
    res.setHeader('x-frame-options','DENY');
    res.setHeader('permissions-policy','camera=(), microphone=(self), geolocation=()');
    res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if(env.NODE_ENV==='production') res.setHeader('strict-transport-security','max-age=31536000');
    const url=new URL(req.url,'http://office.local'),path=url.pathname;
    try {
      if(path==='/healthz' && req.method==='GET') { output(res,200,{status:'ok',service:'friendly-office'}); return; }
      if(path==='/api/login' && req.method==='POST') {
        checkOrigin(req);
        const key=req.socket.remoteAddress||'unknown';
        let a=attempts.get(key)||{count:0,until:Date.now()+900000};
        if(a.until<Date.now()) a={count:0,until:Date.now()+900000};
        if(a.count>=8) throw new OfficeError('Too many sign-in attempts. Try again after 15 minutes.',429);
        a.count++; attempts.set(key,a);
        const b=await body(req);
        if(expected) {
          if(typeof b.password!=='string' || b.password.length>1000 || !timingSafeEqual(scryptSync(b.password,passwordSalt,32),expected)) throw new OfficeError('The owner password is incorrect.',401);
        }
        attempts.delete(key);
        const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
        if(expected) store.db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token),csrf,Date.now()+8*3600000);
        output(res,200,{ok:true},{'set-cookie':`office_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${env.NODE_ENV==='production'?'; Secure':''}`});return;
      }
      if(path==='/api/apprentice/phone-hook' && req.method==='POST') {
        if(!apprenticeship.summary().phone.enabled)throw new OfficeError('Phone transcript intake is disabled.',403);
        const {value,raw}=await body(req,90000,true);
        output(res,200,await apprenticeship.webhook(raw,req.headers,value));return;
      }
      if(path==='/api/apprentice/phone-event-hook' && req.method==='POST') {
        const {value,raw}=await body(req,90000,true);
        output(res,200,await apprenticeship.phoneEventWebhook(raw,req.headers,value));return;
      }
      if(path.startsWith('/api/')) {
        const auth=session(req,{touch:true}); if(!auth) throw new OfficeError('Sign in to your office.',401);
        if(req.method==='POST') {
          checkOrigin(req);
          if(req.headers['x-csrf-token']!==auth.csrf) throw new OfficeError('Session verification failed. Reload and try again.',403);
          let limit=requests.get(auth.hash)||{count:0,until:Date.now()+60000};
          if(limit.until<Date.now()) limit={count:0,until:Date.now()+60000};
          if(++limit.count>90) throw new OfficeError('Too many actions; pause briefly before continuing.',429);
          requests.set(auth.hash,limit);
        }
        if(path==='/api/state' && req.method==='GET') { output(res,200,{...store.snapshot(),integrations:integrations.status(),apprenticeship:apprenticeship.summary(),csrf:auth.csrf,localAccess:!expected});return; }
        if(path==='/api/events' && req.method==='GET') {
          if(streams.size>=20) throw new OfficeError('Too many office windows are open.',429);
          res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','connection':'keep-alive','x-accel-buffering':'no'});
          res.write('event: refresh\ndata: {}\n\n');
          const stream={res,hash:auth.hash};streams.add(stream);
          const heartbeat=setInterval(()=>{if(!session(req,{touch:true})){res.end();return;}res.write('event: heartbeat\ndata: {}\n\n');},15000);
          req.on('close',()=>{clearInterval(heartbeat);streams.delete(stream);});return;
        }
        if(path==='/api/export' && req.method==='GET') {
          // No session tokens, OAuth material or configuration secrets in exports.
          const snapshot=store.snapshot(); delete snapshot.usage;
          output(res,200,snapshot,{'content-disposition':'attachment; filename="friendly-office-records.json"'});return;
        }
        if(path==='/api/oauth/gmail/callback' && req.method==='GET') {
          if(store.get('settings').paused || store.get('settings').mode!=='shadow') throw new OfficeError('Resume a shadow workspace before finishing the connection.');
          await integrations.oauthFinish(requireText(url.searchParams.get('state'),'OAuth state',200),requireText(url.searchParams.get('code'),'OAuth code',4000),auth.hash);
          res.writeHead(303,{location:'/?connected=gmail'});res.end();return;
        }
        if(path.startsWith('/api/apprentice') && req.method==='GET'){output(res,200,await apprenticeship.route('GET',path,url));return;}
        if(req.method!=='POST') throw new OfficeError('Route not found.',404);
        const b=await body(req,path==='/api/apprentice/audio'?11300000:90000);
        if(path.startsWith('/api/apprentice')){output(res,200,await apprenticeship.route('POST',path,url,b));return;}
        if(path==='/api/logout') {
          if(expected) store.db.prepare('DELETE FROM sessions WHERE hash=?').run(auth.hash);
          for(const stream of streams) if(stream.hash===auth.hash) stream.res.end();
          output(res,200,{ok:true},{'set-cookie':'office_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'});return;
        }
        if(path==='/api/practice') {
          if(store.get('settings').mode!=='practice') throw new OfficeError('Switch to practice mode before starting the sample shift.');
          const tasks=seedPractice(store);
          store.set('settings',{...store.get('settings'),paused:false});store.event(null,'owner','Practice shift started','Three fictional scenarios queued once. No live integrations or model credits used.');engine.tick();
          output(res,200,{tasks:tasks.map(t=>t.id)});return;
        }
        if(path==='/api/settings') {
          const current=store.get('settings'),next={...current};
          if(b.paused!==undefined && typeof b.paused!=='boolean') throw new OfficeError('paused must be true or false.');
          if(b.mode!==undefined) {
            if(!['practice','shadow'].includes(b.mode)) throw new OfficeError('Available modes: practice and shadow. Autonomous actions are not implemented.');
            if(engine.active.size || imports.size || apprenticeship.busy()) throw new OfficeError('Pause and allow in-progress requests to settle before changing modes.',409);
            next.mode=b.mode;
          }
          if(b.useAI!==undefined) {
            if(typeof b.useAI!=='boolean') throw new OfficeError('useAI must be true or false.');
            if(b.useAI && !integrations.status().ai.configured) throw new OfficeError('Configure the Friendly AI brain before enabling model-assisted work.');
            if(b.useAI && integrations.status().ai.provider!=='Friendly private brain' && b.consent!==true) throw new OfficeError('Explicitly consent before sharing selected task data with an external model provider.');
            next.useAI=b.useAI;
          }
          if(b.paused!==undefined) next.paused=b.paused;
          store.set('settings',next);
          if(b.useAI===false){apprenticeship.pause();for(const entry of engine.active.values())entry.controller.abort();}
          if(b.paused===true) {apprenticeship.pause();engine.pauseAll();for(const c of imports)c.abort();}
          else {store.event(null,'owner','Office settings updated',`Mode: ${next.mode}; paused: ${next.paused}; model-assisted drafts: ${next.useAI}. Outbound business actions remain disabled.`);engine.tick();}
          output(res,200,{ok:true});return;
        }
        if(path==='/api/agents') {
          roleById(b.role);if(typeof b.paused!=='boolean') throw new OfficeError('paused must be true or false.');
          store.set(`agent:${b.role}`,{paused:b.paused});if(b.paused){engine.pauseAgent(b.role);apprenticeship.pause(b.role);}
          store.event(null,'owner',b.paused?'Employee paused':'Employee resumed',roleById(b.role).name);output(res,200,{ok:true});return;
        }
        if(path==='/api/tasks') {
          const instruction=requireText(b.instruction,'Instruction',4000),settings=store.get('settings');
          const role=b.role && b.role!=='auto'?roleById(b.role).id:classify(instruction);
          const kind=role==='tech'&&b.kind==='github'?'github':'instruction';
          const task=store.addTask({title:instruction.slice(0,150),role,kind,source:settings.mode==='practice'?'practice':'owner',payload:{instruction,message:role==='email'?instruction:undefined,path:b.path||'/'}});
          engine.tick();output(res,201,{task});return;
        }
        const actionMatch=path.match(/^\/api\/tasks\/([a-f0-9-]{36})\/(edit|approve|reject|retry|handoff|cancel)$/);
        if(actionMatch) {const task=store.action(actionMatch[1],actionMatch[2],b);engine.tick();output(res,200,{task});return;}
        if(path==='/api/rules') {const id=store.proposeRule(b.title,b.body);output(res,201,{id});return;}
        const ruleMatch=path.match(/^\/api\/rules\/([a-f0-9-]{36})\/approve$/);
        if(ruleMatch) {store.approveRule(ruleMatch[1]);output(res,200,{ok:true});return;}
        if(path==='/api/integrations/gmail/disconnect') { apprenticeship.mail.abort();store.set('ap:settings',{...apprenticeship.data.settings(),observing:false});integrations.disconnectGmail();output(res,200,{ok:true});return; }
        if(path.startsWith('/api/integrations/') || path==='/api/import/orders') {
          const settings=store.get('settings');
          if(settings.mode!=='shadow') throw new OfficeError('Use shadow mode for explicitly authorized real-data reads.');
          if(settings.paused) throw new OfficeError('Office paused. Resume before importing or requesting new data.',409);
          if(path==='/api/integrations/gmail/connect') {output(res,200,{url:integrations.oauthStart(auth.hash)});return;}
          if(path==='/api/import/orders') {
            const snapshot=validateSnapshot(b.snapshot);store.addTask({title:'Review owner-imported order snapshot',role:'office',kind:'orders',source:'manual',payload:{snapshot}});
            engine.tick();output(res,201,{ok:true});return;
          }
          if(path==='/api/integrations/gmail/import') {
            if(imports.size) throw new OfficeError('An import is already in progress.',409);
            const c=new AbortController();imports.add(c);
            try {const result=await integrations.importGmail(c.signal);store.event(null,'email','Inbox import finished',`${result.added} new tasks. ${result.scope}`);engine.tick();output(res,200,result);} finally{imports.delete(c);}return;
          }
          if(path==='/api/integrations/orders/read') {
            const task=store.addTask({title:'Review configured order source',role:'office',kind:'orders',source:'owner',payload:{}});engine.tick();output(res,201,{task});return;
          }
          if(path==='/api/integrations/website/read' || path==='/api/integrations/github/read') {
            const kind=path.includes('/github/')?'github':'website';
            const task=store.addTask({title:kind==='github'?'Inspect repository check results':'Inspect Friendly Party Rental homepage HTML',role:'tech',kind,source:'owner',payload:{path:'/'}});engine.tick();output(res,201,{task});return;
          }
        }
        throw new OfficeError('Route not found.',404);
      }
      if(!['GET','HEAD'].includes(req.method)) throw new OfficeError('Method not allowed.',405);
      const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/scene.js':'scene.js','/style.css':'style.css','/icon.svg':'icon.svg','/apprentice-views.js':'apprentice-views.js','/apprentice-case.js':'apprentice-case.js','/showroom.avif':'showroom.avif'};
      const file=files[path]; if(!file) throw new OfficeError('Page not found.',404);
      const bytes=await readFile(resolve(ROOT,'public',file));
      const type=file.endsWith('.avif')?'image/avif':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html';
      res.writeHead(200,{'content-type':`${type}; charset=utf-8`,'cache-control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);
    } catch(error) {
      if(res.headersSent){res.end();return;}
      const status=error instanceof OfficeError?error.status:error.name==='AbortError'?409:500;
      output(res,status,{error:status===500?'The office could not complete this request. No external business action was executed.':error.name==='AbortError'?'Request stopped by the owner. Review any previously imported tasks.':error.message});
    }
  });
  server.requestTimeout=30000;server.headersTimeout=10000;
  const cleanup=setInterval(()=>{store.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());for(const map of [attempts,requests])for(const[k,v]of map)if(v.until<Date.now())map.delete(k);},60000);cleanup.unref();
  if(worker){engine.start();apprenticeship.start();}
  return {server,store,engine,integrations,apprenticeship,async close(){clearInterval(cleanup);clearTimeout(timer);for(const c of imports)c.abort();for(const stream of streams)stream.res.end();await apprenticeship.stop();await engine.stop();await new Promise(r=>server.close(r));store.close();}};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  validateConfig(process.env);
  const app=createOffice(),port=Number(process.env.PORT)||3000;
  // Without authentication, bind only to loopback. Hosted operation requires production configuration.
  const host=process.env.OWNER_PASSWORD?'0.0.0.0':'127.0.0.1';
  app.server.listen(port,host,()=>{
    console.log(`Friendly Office listening on ${host}:${port}. Supervised shadow supported; outbound business writes remain permission-gated.`);
    if(process.env.VERIFY_PRIVATE_SERVICES==='true') void (async()=>{
      const result={brain:false,chatBrain:false,transcriber:false,orders:false,mail:false};
      try{
        if(process.env.AI_BRAIN_URL&&process.env.AI_BRAIN_MODEL){
          const r=await fetch(new URL('/api/tags',process.env.AI_BRAIN_URL),{signal:AbortSignal.timeout(30000)});
          const d=await r.json().catch(()=>({}));result.brain=r.ok&&Array.isArray(d.models);if(result.brain)app.store.set('verified:ai',new Date().toISOString());
        }
        if(process.env.AI_CHAT_URL&&process.env.AI_CHAT_MODEL){
          const r=await fetch(new URL('/api/tags',process.env.AI_CHAT_URL),{signal:AbortSignal.timeout(30000)});
          result.chatBrain=r.ok;
        }
      }catch{}
      try{
        if(process.env.LOCAL_TRANSCRIBE_URL){const r=await fetch(new URL('/docs',process.env.LOCAL_TRANSCRIBE_URL),{signal:AbortSignal.timeout(30000)});result.transcriber=r.ok;if(r.ok)app.store.set('verified:transcriber',new Date().toISOString());}
      }catch{}
      try{if(process.env.FPR_READONLY_URL){const data=await app.integrations.orderSnapshot(AbortSignal.timeout(30000));result.orders=Array.isArray(data.orders);}}catch{}
      try{if(process.env.MAIL_RELAY_URL){const data=await app.integrations.mailRelay(AbortSignal.timeout(30000));result.mail=Array.isArray(data.messages);}}catch{}
      console.log('FRIENDLY_PRIVATE_SERVICES '+JSON.stringify(result));
    })();
  });
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)));
}
