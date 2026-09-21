import { randomUUID } from 'node:crypto';
import { OfficeError, requireText } from './store.mjs';
import { TEAM, digest, stamp, member, redact } from './apprentice-data.mjs';
import { inspectHTML, reviewOrders } from './engine.mjs';

// One owner, one process. Commands reuse the encrypted, revision-checked case queue.
// This layer has no send, reservation, payment, shell or publishing capabilities.
export class CommandCenter {
  constructor(ap) {
    this.ap=ap;this.d=ap.data;this.s=ap.store;this.i=ap.i;this.worker=ap.worker;
    this.timer=null;this.active=null;this.live=null;this.heartbeat=null;
    if(!this.s.get('command:settings'))this.s.set('command:settings',{enabled:true,website:true,orders:true,queueSeconds:60,ordersMinutes:5,websiteMinutes:15});
    this.startedAt=stamp();
  }
  settings(){return this.s.get('command:settings');}
  paused(role){return this.worker.paused(role);}
  counts(){return {cases:this.d.counts(),tasks:Object.fromEntries(this.d.db.prepare('SELECT status,COUNT(*) AS n FROM tasks GROUP BY status').all().map(x=>[x.status,x.n]))};}
  attention(){
    const out=[];
    for(const c of this.d.db.prepare("SELECT id,title,lead,status,reason,updated FROM ap_cases WHERE status IN ('blocked','review') ORDER BY CASE status WHEN 'blocked' THEN 0 ELSE 1 END, updated DESC LIMIT 8").all()){
      out.push({type:'case',id:c.id,title:this.d.unpack(c.title),role:c.lead,status:c.status,detail:c.reason|| (c.status==='review'?'Draft ready for Bryan.':'Needs review'),at:c.updated});
    }
    for(const t of this.d.db.prepare("SELECT id,title,role,status,reason,updated FROM tasks WHERE status IN ('blocked','waiting_approval') ORDER BY CASE status WHEN 'blocked' THEN 0 ELSE 1 END, updated DESC LIMIT 8").all()){
      out.push({type:'task',id:t.id,title:t.title,role:t.role,status:t.status==='waiting_approval'?'review':t.status,detail:t.reason|| (t.status==='waiting_approval'?'Draft ready for Bryan.':'Needs review'),at:t.updated});
    }
    return out.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,8);
  }
  context(){return {asOf:stamp(),mode:this.s.get('settings').mode,paused:this.s.get('settings').paused,continuous:this.settings().enabled,
    work:this.counts(),connections:{gmail:this.ap.mail.status(),phone:{liveListening:false,lastTranscript:this.s.get('ap:phoneReceived')},orders:this.i.status().orders,website:this.i.status().website,model:this.i.status().ai},
    limits:'Office work counts, not bookings or employee productivity. Customer actions remain disabled. No live phone listening. Missing sources remain unknown.'};}
  card(role) {
    const r=member(role),paused=this.paused(role),live=this.worker.live;
    const task=this.d.db.prepare("SELECT id,title,kind FROM tasks WHERE role=? AND status='running' ORDER BY updated DESC LIMIT 1").get(role);
    const queue=this.d.db.prepare("SELECT COUNT(DISTINCT c.id) AS n FROM ap_cases c JOIN ap_jobs j ON j.case_id=c.id WHERE j.status='queued' AND (j.target IN (?, 'team') OR c.lead=?)").get(role,role).n;
    const review=this.d.db.prepare("SELECT COUNT(*) AS n FROM ap_cases WHERE lead=? AND status='review'").get(role).n + this.d.db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE role=? AND status='waiting_approval'").get(role).n;
    let status='available',activity='Available for your next instruction.',caseId=null,taskId=null;
    if(paused){status='paused';activity='Paused by the owner. No new work starts.';}
    else if(live?.role===role){status='working';activity='Reviewing shared evidence and consulting teammates.';caseId=live.caseId;}
    else if(role==='email'&&this.ap.mail.busy){status='working';activity='Reading changes from the authorized mailbox.';}
    else if(task){status='working';activity=task.title;taskId=task.id;}
    else if(this.live?.role===role){status='working';activity=this.live.label;}
    else if(queue){status='queued';activity=`${queue} shared case(s) queued; waiting for the work slot.`;}
    else if(review){status='review';activity=`${review} draft(s) need your decision. Available for other work.`;}
    else if(role==='phone'){const p=this.d.phoneSettings();status=p.carrierAttached?'available':'waiting';activity=p.carrierAttached?'Caught up. Watching Friendly Phone for calls, voicemail and follow-up work.':'Phone desk ready; waiting for the public carrier/SIP connection.';}
    else if(role==='email'&&!this.ap.mail.status().enabled){status='waiting';activity='Email observation is off. You can still send me instructions.';}
    else if(role==='email'){activity='Caught up. Watching the Friendly customer-service mailbox for new work.';}
    else if(role==='office'&&!this.i.status().orders.configured){status='waiting';activity='Order system is not connected. Monitoring the office queue.';}
    else if(role==='office'){activity='Caught up. Watching orders, readiness issues and the owner queue.';}
    else if(role==='tech'){activity=this.settings().website?'Caught up. Watching the website and deployment health.':'Available for an authorized technical check.';}
    return {...r,status,activity,caseId,taskId,queued:queue,review,paused:!!paused};
  }
  feed(){
    return this.d.db.prepare("SELECT n.*,c.title,c.practice,c.status FROM ap_notes n JOIN ap_cases c ON c.id=n.case_id WHERE n.kind!='request' ORDER BY n.id DESC LIMIT 36").all().map(n=>{const body=this.d.unpack(n.body);return {id:n.id,caseId:n.case_id,title:this.d.unpack(n.title),practice:!!n.practice,caseStatus:n.status,author:n.author,recipient:n.recipient,kind:n.kind,body:body.slice(0,2400),truncated:body.length>2400,at:n.created};});
  }
  snapshot(){return {settings:this.settings(),heartbeat:this.heartbeat,startedAt:this.startedAt,serverTime:stamp(),team:TEAM.map(r=>this.card(r.id)),counts:this.counts(),feed:this.feed(),attention:this.attention(),
    duties:['queue','orders','website','improvement','phone'].map(id=>({id,...this.s.get('command:duty:'+id)})),
    limits:'Service stays available while hosting is running. Pauses, unavailable sources, approvals and budgets still apply; no fabricated busy work.'};}
  threads(){return this.d.db.prepare("SELECT DISTINCT c.* FROM ap_cases c JOIN ap_sources s ON s.case_id=c.id WHERE s.kind='owner' ORDER BY c.updated DESC LIMIT 30").all().map(c=>({id:c.id,title:this.d.unpack(c.title),lead:c.lead,practice:!!c.practice,status:c.status,revision:c.revision,updated:c.updated}));}
  submit(b){
    const message=redact(requireText(b.message,'Owner instruction',2000)),recipient=b.recipient||'team';
    if(recipient!=='team')member(recipient);
    const action=b.action||'brief';if(!['brief','website','orders'].includes(action))throw new OfficeError('Choose an office brief, website check or order review.');
    if(!/^[a-f0-9-]{36}$/.test(b.requestId||''))throw new OfficeError('A unique message request ID is required.');
    const practice=this.s.get('settings').mode==='practice';if(!practice)this.d.needPrivate();
    const key='owner-message:'+b.requestId,old=this.d.db.prepare('SELECT * FROM ap_sources WHERE source_key=?').get(digest(key));
    if(old){const p=this.d.unpack(old.payload);if(p.message!==message||p.recipient!==recipient||p.action!==action)throw new OfficeError('Request ID already belongs to a different message.',409);return {caseId:old.case_id,duplicate:true};}
    let c;
    if(b.caseId){c=this.d.row(b.caseId);if(!!c.practice!==practice)throw new OfficeError('Start a new conversation after changing workspace mode.',409);if(!this.d.sources(c.id).some(x=>x.kind==='owner'))throw new OfficeError('Use the shared case controls for customer-source cases.');
      this.d.checked(c.id,b.revision);
      if(this.d.db.prepare("SELECT 1 FROM ap_jobs WHERE case_id=? AND status IN ('queued','running')").get(c.id))throw new OfficeError('Let the current answer finish, or cancel it before adding another instruction.',409);
    }else c=this.d.create({key:'owner-thread:'+b.requestId,title:message.slice(0,150),lead:recipient==='team'?'office':recipient,practice});
    if(!c)throw new OfficeError('This conversation was excluded. Start a new one.');
    if(this.d.db.prepare("SELECT COUNT(*) AS n FROM ap_jobs WHERE status='queued'").get().n>=100)throw new OfficeError('Review the existing backlog before adding another instruction.',429);
    this.d.db.exec('BEGIN IMMEDIATE');
    try{
      this.d.ingest(c.id,{key,kind:'owner',payload:{message,recipient,action,at:stamp(),requestId:b.requestId,limitation:'Authenticated owner instruction; cannot expand provider permissions.'}});
      this.d.note(c.id,'owner',recipient,'owner-request',message);
      if(recipient!=='team')this.d.db.prepare('UPDATE ap_cases SET lead=? WHERE id=?').run(recipient,c.id);
      this.d.enqueue(c.id,{revision:this.d.row(c.id).revision,target:recipient,question:message});
      this.d.db.exec('COMMIT');
    }catch(e){this.d.db.exec('ROLLBACK');throw e;}
    this.worker.tick();this.s.changed();return {caseId:c.id,queued:true,paused:!!this.s.get('settings').paused};
  }
  async prepare(job,signal){
    const owner=this.d.sources(job.case_id).filter(s=>s.kind==='owner').at(-1);if(!owner)return;
    const before=this.d.row(job.case_id).revision,p=owner.payload,practice=!!this.d.row(job.case_id).practice;
    this.worker.live={caseId:job.case_id,role:p.action==='website'?'tech':'office',lead:this.d.row(job.case_id).lead,startedAt:stamp()};this.s.changed();
    let message=JSON.stringify(this.context(),null,2),kind='office-state';
    if(p.action!=='brief'){
      kind='authorized-check';
      if(practice)message='Practice mode: no live website or order source was read. Switch to Shadow for an authorized check.';
      else if(this.paused(p.action==='website'?'tech':'office'))message='The employee required for this source check is paused. No source was read.';
      else try{message=await this.read(p.action,signal);}catch(e){if(signal.aborted)throw e;message='SOURCE BLOCKED: '+(e instanceof OfficeError?e.message:'The source could not be read. No success was assumed.');}
    }
    signal.throwIfAborted();if(this.s.get('settings').paused)throw new DOMException('Paused','AbortError');this.d.checked(job.case_id,before);
    this.d.ingest(job.case_id,{key:'owner-context:'+owner.id,kind,payload:{message:redact(message),at:stamp(),limitation:'Point-in-time evidence, not a live screen recording.'}});
    this.d.db.prepare("UPDATE ap_cases SET status='working' WHERE id=?").run(job.case_id);
    job.source_revision=this.d.row(job.case_id).revision;this.d.db.prepare('UPDATE ap_jobs SET source_revision=? WHERE id=?').run(job.source_revision,job.id);
  }
  async read(id,signal){
    if(id==='website'){const p=await this.i.website('/',signal),report=inspectHTML(p.html,p.status);return JSON.stringify({url:p.url,asOf:p.observedAt,status:p.status,...report},null,2);}
    if(id==='orders')return reviewOrders(await this.i.orderSnapshot(signal));
    throw new OfficeError('Unknown standing source check.');
  }
  local(role,detail,final){
    const owner=detail.sources.filter(s=>s.kind==='owner').at(-1),source=detail.sources.filter(s=>['office-state','authorized-check'].includes(s.kind)).at(-1);
    if(!owner)return null;
    const label=member(role).name;
    if(!final)return `CHECKLIST RESPONSE · ${label}\nI received the owner's instruction. ${role==='office'?'Verify order facts against the connected rental source.':role==='email'?'I can prepare a follow-up; sending remains disabled.':role==='phone'?'I need an authorized transcript to evaluate a customer call.':'A source report is not a published fix.'}\n${this.card(role).activity}\nNo free-form AI model is enabled for this review.`;
    const head=`${label} → Bryan\n${detail.practice?'PRACTICE · ':''}OFFICE BRIEF · CHECKLIST MODE\n\n`;
    if(source?.kind==='authorized-check')return head+source.payload.message+'\n\nThis is the actual read-only check result, not a website fix or order change. Review before making a commitment.';
    const x=source?JSON.parse(source.payload.message):this.context(),c=x.work.cases,t=x.work.tasks;
    return head+`Your instruction is saved in this conversation.\n\nCurrent office records:\n• ${ (c.queued||0)+(t.queued||0)} queued case(s)/task(s).\n• ${(c.review||0)+(t.waiting_approval||0)} draft(s) waiting for owner review.\n• ${(c.blocked||0)+(t.blocked||0)} blocked case(s)/task(s).\n\nConnections:\nEmail observation: ${x.connections.gmail.enabled?'enabled; check last sync':'off'}.\nLive phone: not connected.\nOrder source: ${x.connections.orders.configured?'configured; check source timestamp':'not connected'}.\nDraft model: ${x.connections.model.configured?'configured; model assistance must also be enabled':'not configured'}.\n\nI can record assignments, coordinate the case queue and return the allowed checks without a model. A personalized answer to other instructions needs the configured model. Nothing was sent, charged, reserved or published.`;
  }
  async tick(force=false){
    this.heartbeat=stamp();
    if(this.active||!this.settings().enabled||this.s.get('settings').paused)return;
    if(this.worker.active||this.worker.engine?.active.size)return;
    const settings=this.settings(),now=Date.now(),queueMs=Math.max(15000,Math.min(300000,(Number(settings.queueSeconds)||60)*1000)),ordersMs=Math.max(60000,Math.min(3600000,(Number(settings.ordersMinutes)||5)*60000)),websiteMs=Math.max(60000,Math.min(3600000,(Number(settings.websiteMinutes)||15)*60000)),improvementMs=6*3600000,phoneMs=60000;
    const controller=new AbortController();
    const promise=(async()=>{
      const q=this.s.get('command:duty:queue');
      if(force||!q||Date.parse(q.nextAt)<=now){
        const counts=this.counts();this.s.set('command:duty:queue',{lastAt:stamp(),nextAt:new Date(now+queueMs).toISOString(),status:'checked',detail:'Reviewed saved queue, blockers and owner-review counts. If nothing is actionable, Morgan remains caught up rather than generating busy-work.',counts});
      }
      for(const id of ['website','orders']){
        const role=id==='website'?'tech':'office',old=this.s.get('command:duty:'+id)||{};
        if(!force&&old.nextAt&&Date.parse(old.nextAt)>now)continue;
        const nextAt=new Date(now+(id==='orders'?ordersMs:websiteMs)).toISOString();
        const ready=settings[id]&&this.s.get('settings').mode==='shadow'&&!this.paused(role)&&this.i.status()[id].configured;
        if(!ready){this.s.set('command:duty:'+id,{...old,nextAt,status:'waiting',detail:!settings[id]?'Standing check turned off.':this.s.get('settings').mode!=='shadow'?'Practice mode; live source checks are off.':this.paused(role)?'Required employee is paused.':'Source connection is not configured.'});continue;}
        if(this.d.db.prepare("SELECT COUNT(*) AS n FROM ap_cases WHERE status IN ('open','queued','working','review')").get().n>=60){this.s.set('command:duty:'+id,{...old,nextAt,status:'waiting',detail:'Resolve the existing case backlog before collecting more reports.'});continue;}
        this.live={role,label:id==='website'?'Reading approved website HTML.':'Reading the configured order snapshot.'};this.s.changed();
        try{
          const report=await this.read(id,controller.signal);controller.signal.throwIfAborted();if(this.s.get('settings').paused)throw new DOMException('Paused','AbortError');
          // Ignore changing timestamps for deduplication, not changes in actual findings.
          const fingerprint=digest(report.replace(/\d{4}-\d{2}-\d{2}T[0-9:.]+Z/g,'[timestamp]'));
          let caseId=old.caseId;
          if(fingerprint!==old.fingerprint || (caseId&&!this.d.db.prepare('SELECT 1 FROM ap_cases WHERE id=?').get(caseId))){
            const c=this.d.create({key:'standing:'+id+':'+fingerprint,title:id==='website'?'Standing website check · read-only':'Standing order-readiness report',lead:role});
            if(c){
              caseId=c.id;
              this.d.ingest(c.id,{key:'standing-report:'+id+':'+fingerprint,kind:'authorized-check',payload:{message:redact(report),at:stamp()}});
              this.d.note(c.id,role,'team','finding',id==='orders'?'Morgan found a material change in the live order-readiness report. The team should identify what is verified, what needs customer follow-up, and what needs Bryan.':'Alex found a material change in the website check. The team should separate verified technical findings from customer/operations impact.',this.d.sources(c.id).map(s=>s.id));
              if(!this.d.db.prepare("SELECT 1 FROM ap_jobs WHERE case_id=? AND status IN ('queued','running')").get(c.id))this.d.enqueue(c.id,{revision:this.d.row(c.id).revision,target:'team',question:id==='orders'?'Review this live order-readiness change together. Morgan owns operations; Avery identifies necessary customer communication; Riley flags phone follow-up only when supported; Alex only flags system issues supported by evidence. Prepare one owner brief.':'Review this website change together. Alex owns the technical finding; Morgan identifies operational impact; Avery identifies customer-facing impact; Riley identifies call impact only if supported. Prepare one owner brief.'});
            }
          }
          this.s.set('command:duty:'+id,{lastAt:stamp(),nextAt,status:'checked',detail:fingerprint===old.fingerprint?'Checked; no material report change.':'New read-only report recorded for the owner.',fingerprint,caseId});
        }catch(e){this.s.set('command:duty:'+id,{...old,lastAt:stamp(),nextAt,status:'blocked',detail:controller.signal.aborted?'Check stopped by owner.':e instanceof OfficeError?e.message:'Read failed. Check connection; no passing result assumed.'});}
        finally{this.live=null;}
        if(controller.signal.aborted)break;
      }
      // Riley: turn missed/no-answer/voicemail carrier events into one reviewable follow-up case.
      {
        const old=this.s.get('command:duty:phone')||{},nextAt=new Date(now+phoneMs).toISOString(),phone=this.d.phoneSettings();
        if(!phone.carrierAttached)this.s.set('command:duty:phone',{...old,nextAt,status:'waiting',detail:'Friendly Phone is built, but the public carrier/SIP number is not attached yet.'});
        else if(force||!old.nextAt||Date.parse(old.nextAt)<=now){
          const rows=this.d.phoneCalls(25).filter(x=>/missed|voicemail|no.?answer/i.test(x.state+' '+String(x.payload?.type||'')));
          const latest=rows[0],fp=latest?digest(JSON.stringify([latest.provider_call_id,latest.state,latest.updated])):null;
          if(latest&&fp!==old.fingerprint){
            const cc=this.d.create({key:'standing:phone:'+fp,title:'Phone follow-up · '+String(latest.payload?.from||'caller').slice(0,70),lead:'phone'});
            if(cc){
              this.d.ingest(cc.id,{key:'standing-phone-event:'+fp,kind:'phone-event',payload:{message:`Phone event requires follow-up: ${latest.state}. Caller: ${latest.payload?.from||'unknown'}. Time: ${latest.updated}. No transcript or customer promise is inferred.`,at:latest.updated,provider:latest.payload?.provider||phone.carrierName||'Friendly Phone'}});
              this.d.note(cc.id,'phone','team','handoff','A missed-call/voicemail event needs follow-up. Morgan should check for an order match only if there is reliable identifying information; Avery should prepare written follow-up only if a verified email is attached.',this.d.sources(cc.id).map(s=>s.id));
              if(!this.d.db.prepare("SELECT 1 FROM ap_jobs WHERE case_id=? AND status IN ('queued','running')").get(cc.id))this.d.enqueue(cc.id,{revision:this.d.row(cc.id).revision,target:'team',question:'Review this phone follow-up together. Do not invent customer identity or booking details.'});
            }
            this.s.set('command:duty:phone',{lastAt:stamp(),nextAt,status:'checked',detail:'New missed-call/voicemail follow-up recorded for Riley and the team.',fingerprint:fp,caseId:cc?.id||null});
          }else this.s.set('command:duty:phone',{...old,lastAt:stamp(),nextAt,status:'checked',detail:'Checked recent phone events; no new missed-call or voicemail work.',fingerprint:fp||old.fingerprint});
        }
      }
      // Team improvement pulse: only creates work when real unresolved material exists.
      {
        const old=this.s.get('command:duty:improvement')||{},nextAt=new Date(now+improvementMs).toISOString();
        if(force||!old.nextAt||Date.parse(old.nextAt)<=now){
          const blocked=this.d.db.prepare("SELECT COUNT(*) AS n FROM ap_cases WHERE status='blocked'").get().n;
          const lessons=this.d.db.prepare("SELECT COUNT(*) AS n FROM ap_lessons WHERE status='pending'").get().n;
          const oldReviews=this.d.db.prepare("SELECT COUNT(*) AS n FROM ap_cases WHERE status='review' AND updated<?").get(new Date(now-12*3600000).toISOString()).n;
          const material=blocked+lessons+oldReviews;
          if(material){
            const fp=digest(JSON.stringify({blocked,lessons,oldReviews,day:new Date(now).toISOString().slice(0,10)}));
            if(fp!==old.fingerprint){
              const cc=this.d.create({key:'standing:improvement:'+fp,title:'Continuous improvement · unresolved work',lead:'office'});
              if(cc){
                this.d.ingest(cc.id,{key:'standing-improvement-source:'+fp,kind:'office-state',payload:{message:JSON.stringify({blockedCases:blocked,pendingLessons:lessons,ownerReviewsOlderThan12h:oldReviews},null,2),at:stamp(),limitation:'Internal queue counts only; no customer facts are inferred.'}});
                this.d.enqueue(cc.id,{revision:this.d.row(cc.id).revision,target:'team',question:'Review unresolved internal work. Suggest only concrete process improvements supported by these records; do not create customer promises or busy-work.'});
              }
              this.s.set('command:duty:improvement',{lastAt:stamp(),nextAt,status:'checked',detail:'Material unresolved work exists; the team opened one bounded improvement review.',fingerprint:fp,caseId:cc?.id||null});
            }else this.s.set('command:duty:improvement',{...old,lastAt:stamp(),nextAt,status:'checked',detail:'Unresolved-work pattern unchanged; no duplicate improvement case created.'});
          }else this.s.set('command:duty:improvement',{...old,lastAt:stamp(),nextAt,status:'checked',detail:'Nothing useful to improve from current records. Team is caught up.',fingerprint:null});
        }
      }
      this.s.changed();
    })();
    this.active={controller,promise};try{await promise;}finally{this.active=null;this.live=null;}
  }
  start(){this.timer=setInterval(()=>void this.tick().catch(()=>{}),15000);this.timer.unref();void this.tick().catch(()=>{});}
  pause(role){if(!role||this.live?.role===role)this.active?.controller.abort();}
  async stop(){clearInterval(this.timer);this.pause();await this.active?.promise;}
  async route(method,path,b){
    const suffix=path.slice('/api/apprentice/command'.length);
    if(method==='GET'&&suffix==='')return this.snapshot();
    if(method==='GET'&&suffix==='/threads')return {threads:this.threads()};
    if(method!=='POST')throw new OfficeError('Command route not found.',404);
    if(suffix==='/message')return this.submit(b);
    if(suffix==='/settings'){
      const next={...this.settings()};for(const k of ['enabled','website','orders'])if(b[k]!==undefined){if(typeof b[k]!=='boolean')throw new OfficeError(k+' must be true or false.');next[k]=b[k];}
      for(const [k,min,max] of [['queueSeconds',15,300],['ordersMinutes',1,60],['websiteMinutes',1,60]])if(b[k]!==undefined){const n=Number(b[k]);if(!Number.isFinite(n)||n<min||n>max)throw new OfficeError(k+' is outside the allowed range.');next[k]=n;}
      if(b.resume!==undefined&&typeof b.resume!=='boolean')throw new OfficeError('resume must be true or false.');
      this.s.set('command:settings',next);
      if(!next.enabled){this.pause();this.s.set('settings',{...this.s.get('settings'),paused:true});this.ap.pause();}
      if(b.resume===true||next.enabled===true)this.s.set('settings',{...this.s.get('settings'),paused:false});
      this.s.event(null,'owner',next.enabled?'24/7 office enabled':'24/7 office disabled','Master switch changed. Provider permissions, customer-send approvals and model safety boundaries are unchanged.');
      void this.tick(true).catch(()=>{});return this.snapshot();
    }
    if(suffix==='/check'){await this.tick(true);return this.snapshot();}
    throw new OfficeError('Command route not found.',404);
  }
}

// Explicit adapter to the existing apprenticeship lifecycle and queue.
export function installCommandCenter(ap){
  const center=new CommandCenter(ap);ap.command=center;
  const summary=ap.summary.bind(ap);ap.summary=()=>({...summary(),command:center.snapshot()});
  const route=ap.route.bind(ap);ap.route=(method,path,url,b)=>path==='/api/apprentice/command'||path.startsWith('/api/apprentice/command/')?center.route(method,path,b):route(method,path,url,b);
  const start=ap.start.bind(ap);ap.start=()=>{start();center.start();};
  const pause=ap.pause.bind(ap);ap.pause=role=>{center.pause(role);pause(role);};
  const stop=ap.stop.bind(ap);ap.stop=async()=>{await center.stop();await stop();};
  const busy=ap.busy.bind(ap);ap.busy=()=>!!center.active||busy();
  const run=ap.worker.run.bind(ap.worker);
  ap.worker.run=async(job,signal)=>{
    try{await center.prepare(job,signal);}
    catch(e){ap.data.db.prepare("UPDATE ap_jobs SET status='blocked',updated=? WHERE id=?").run(stamp(),job.id);ap.data.db.prepare("UPDATE ap_cases SET status='blocked',reason=?,updated=? WHERE id=?").run(signal.aborted?'Owner request paused. Review before retrying.':'Source changed or could not be prepared. Review and retry.',stamp(),job.case_id);ap.store.changed();return;}
    return run(job,signal);
  };
  const contribute=ap.worker.contribute.bind(ap.worker);
  ap.worker.contribute=(role,detail,question,signal,final=false)=>{
    if(detail.practice||!ap.store.get('settings').useAI){const answer=center.local(role,detail,final);if(answer!==null)return Promise.resolve(answer);}
    return contribute(role,detail,question,signal,final);
  };
  const tick=ap.worker.tick.bind(ap.worker);ap.worker.tick=()=>{if(!center.active)tick();};
  if(ap.worker.engine){const engine=ap.worker.engine,engineTick=engine.tick.bind(engine);engine.tick=()=>{if(!ap.worker.active&&!center.active)engineTick();};}
  return center;
}
