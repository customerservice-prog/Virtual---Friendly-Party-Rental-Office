import { randomUUID } from 'node:crypto';
import { OfficeError, requireText } from './store.mjs';
import { ApprenticeData, TEAM, stamp, digest, member, redact } from './apprentice-data.mjs';
import { MailObserver, ACCOUNT } from './apprentice-mail.mjs';
import { CaseWorker, comparison } from './apprentice-worker.mjs';
import { validateCall, verifyPhoneSignature, transcribeAudio } from './apprentice-phone.mjs';
export class Apprenticeship {
  constructor(store,integrations,engine){this.store=store;this.i=integrations;this.data=new ApprenticeData(store,integrations);this.mail=new MailObserver(this.data,integrations);this.worker=new CaseWorker(this.data,integrations,engine);this.audio=new Set();this.pruneTimer=null;}
  start(){this.worker.start();this.mail.start();this.pruneTimer=setInterval(()=>{if(!this.busy())this.data.prune();},3600000);this.pruneTimer.unref();}
  busy(){return !!(this.worker.active||this.mail.busy||this.audio.size);}
  pause(role){this.worker.pause(role);if(!role){this.mail.abort();for(const c of this.audio)c.abort();}}
  async stop(){clearInterval(this.pruneTimer);this.pause();await Promise.all([this.mail.stop(),this.worker.stop()]);}
  summary(){return {settings:this.data.settings(),mail:this.mail.status(),counts:this.data.counts(),live:this.worker.live,
    team:TEAM.map(r=>({...r,paused:!!this.worker.paused(r.id),apprenticeshipPaused:!!this.store.get('ap:agent:'+r.id)?.paused,officePaused:!!(this.store.get('settings').paused||this.store.get('agent:'+r.id)?.paused)})),lessonsPending:this.data.db.prepare("SELECT COUNT(*) AS n FROM ap_lessons WHERE status='pending'").get().n,
    phone:{configured:!!(this.i.env.PHONE_WEBHOOK_SECRET?.length>=32),enabled:this.data.settings().phoneWebhook,lastReceived:this.store.get('ap:phoneReceived'),liveListening:false,system:this.data.phoneSettings(),recentCalls:this.data.phoneCalls(12)},
    storageReady:!!this.i.env.INTEGRATION_ENCRYPTION_KEY,modelReady:this.i.status().ai.configured,transcriptionReady:!!(this.i.env.LOCAL_TRANSCRIBE_URL||(this.i.env.OPENAI_API_KEY&&this.i.env.OPENAI_TRANSCRIBE_MODEL)),transcriptionMode:this.i.env.LOCAL_TRANSCRIBE_URL?'Friendly private Whisper':(this.i.env.OPENAI_API_KEY&&this.i.env.OPENAI_TRANSCRIBE_MODEL?'External provider':null),businessActionsEnabled:false};}
  real(){if(this.store.get('settings').mode!=='shadow'||this.store.get('settings').paused)throw new OfficeError('Resume a shadow workspace for real business observation.',409);this.data.needPrivate();}
  async phoneEventWebhook(raw,headers,b){
    verifyPhoneSignature(raw,headers,this.i.env.PHONE_WEBHOOK_SECRET);this.real();
    if(!b||typeof b!=='object')throw new OfficeError('Invalid phone event.');
    const result=this.data.recordPhoneEvent(b);this.store.event(null,'phone','Phone carrier event',String(b.type||b.state||'event').slice(0,120));return result;
  }
  async webhook(raw,headers,b){
    if(!this.data.settings().phoneWebhook)throw new OfficeError('Phone transcript intake is disabled.',403);
    this.real();verifyPhoneSignature(raw,headers,this.i.env.PHONE_WEBHOOK_SECRET);const receipt=digest(requireText(b.eventId,'Event identifier',200));
    if(this.data.db.prepare('SELECT 1 FROM ap_receipts WHERE id=?').get(receipt))return {duplicate:true};
    if(b.caseId)throw new OfficeError('External deliveries cannot attach themselves to another case.');
    const result=this.importPhone(b,'webhook');this.data.db.prepare('INSERT INTO ap_receipts VALUES(?,?)').run(receipt,stamp());return result;
  }
  importPhone(b,channel='owner'){
    this.real();const call=validateCall(b);let c;
    if(b.caseId){if(b.sameCaseConfirmed!==true)throw new OfficeError('Confirm this call belongs to the selected customer case.');c=this.data.row(b.caseId);if(c.practice)throw new OfficeError('Real calls cannot be attached to fictional practice.');}
    else c=this.data.create({key:'call:'+call.provider+':'+call.callId,title:b.title||'Completed call with '+call.trainer,lead:'phone'});
    if(!c)return {excluded:true};const changed=this.data.ingest(c.id,{key:'call-source:'+call.provider+':'+call.callId,kind:'phone',payload:{...call,channel},fingerprint:JSON.stringify([call.message,call.trainer,call.at,call.consent])});
    if(changed&&this.data.settings().autoReview&&!this.data.db.prepare("SELECT 1 FROM ap_jobs WHERE case_id=? AND status IN ('queued','running')").get(c.id))this.data.enqueue(c.id,{revision:this.data.row(c.id).revision});
    this.store.set('ap:phoneReceived',{at:stamp(),channel});this.data.event('Consented call transcript imported');
    return {caseId:c.id,changed};
  }
  async route(method,path,url,b={}){
    const d=this.data;
    if(method==='GET'){
      if(path==='/api/apprentice')return this.summary();
      if(path==='/api/apprentice/cases'){const offset=Math.max(0,Math.min(1000,Number(url.searchParams.get('offset'))||0));return {cases:d.list(40,offset),offset,nextOffset:d.list(1,offset+40).length?offset+40:null};}
      if(path==='/api/apprentice/lessons')return {lessons:d.lessons(),limit:100};
      if(path==='/api/apprentice/phone-system')return {settings:d.phoneSettings(),calls:d.phoneCalls(50),transcriptionReady:this.summary().transcriptionReady,modelReady:this.summary().modelReady,carrierWebhookConfigured:!!(this.i.env.PHONE_WEBHOOK_SECRET?.length>=32)};
      const m=path.match(/^\/api\/apprentice\/cases\/([a-f0-9-]{36})$/);if(m){const c=d.detail(m[1]);return {...c,comparison:comparison(c.sources,c.draftHistory)};}
      throw new OfficeError('Apprenticeship route not found.',404);
    }
    if(method!=='POST')throw new OfficeError('Method not allowed.',405);
    if(path==='/api/apprentice/settings'){
      const old=d.settings(),next={...old};
      for(const k of ['observing','autoReview','includeDrafts','phoneWebhook'])if(b[k]!==undefined){if(typeof b[k]!=='boolean')throw new OfficeError(k+' must be true or false.');next[k]=b[k];}
      for(const k of ['historyDays','retentionDays'])if(b[k]!==undefined){if(!Number.isInteger(b[k])||b[k]<7||b[k]>90)throw new OfficeError(k+' must be 7–90 days.');next[k]=b[k];}
      if((!old.observing&&next.observing)||(!old.phoneWebhook&&next.phoneWebhook)||(!old.includeDrafts&&next.includeDrafts)||(!old.autoReview&&next.autoReview)){
        this.real();if(b.consent!==true)throw new OfficeError('Confirm the private business observation scope, retention and processing permissions.');next.consentAt=stamp();
      }
      if(next.observing&&!this.i.status().gmail.connected)throw new OfficeError('Authorize the customer-service mailbox before enabling observation.');
      if(next.phoneWebhook&&!this.summary().phone.configured)throw new OfficeError('Configure a strong PHONE_WEBHOOK_SECRET before enabling transcript delivery.');
      if(old.historyDays!==next.historyDays){if(this.mail.busy)throw new OfficeError('Pause synchronization before changing the initial lookback.',409);this.store.set('ap:mail',{phase:'recover',gapDetected:true});}
      this.store.set('ap:settings',next);if(!next.observing)this.mail.abort();this.data.event('Apprenticeship permissions updated');return this.summary();
    }
    if(path==='/api/apprentice/sync')return await this.mail.sync();
    if(path==='/api/apprentice/phone-system/settings'){
      this.real();
      if(b.confirm!==true)throw new OfficeError('Confirm the phone routing/settings change.');
      return {settings:d.updatePhoneSettings(b)};
    }
    if(path==='/api/apprentice/phone')return this.importPhone(b);
    if(path==='/api/apprentice/audio'){
      this.real();if(this.audio.size)throw new OfficeError('A transcription is already running.',409);
      const c=new AbortController();this.audio.add(c);try{return await transcribeAudio(b,this.i,c.signal);}finally{this.audio.delete(c);}
    }
    if(path==='/api/apprentice/practice'){
      if(this.store.get('settings').mode!=='practice')throw new OfficeError('Use practice mode for the fictional apprenticeship example.');
      const c=d.create({key:'apprentice-practice-v1',title:'Fictional call → email team handoff',lead:'phone',practice:true});if(!c)throw new OfficeError('This example was excluded.');
      d.ingest(c.id,{key:'apprentice-practice-call',kind:'phone',payload:{trainer:'Nicole (fictional exercise)',at:'2026-09-21T12:00:00Z',message:'Customer: I need a tent and chairs for a backyard event.\nNicole: What is the event date and delivery address?\nCustomer: I still need to confirm the venue.\nNicole: Please email the date, address and quantities so we can check the options.',consent:{basis:'Fictional example; no real recording'},limitation:'Fictional practice transcript, not a call Nicole actually made.'}});
      d.ingest(c.id,{key:'apprentice-practice-email',kind:'email',payload:{message:'Thank you for the call. I am still checking the address. Can you hold a tent?',direction:'incoming',at:'2026-09-21T12:05:00Z',automated:false,from:'Fictional customer',subject:'Sample follow-up',limitation:'Fictional practice. No real reservation.'}});
      return {caseId:c.id};
    }
    if(path==='/api/apprentice/agent'){
      member(b.role);if(typeof b.paused!=='boolean')throw new OfficeError('paused must be true or false.');this.store.set('ap:agent:'+b.role,{paused:b.paused});if(b.paused)this.pause(b.role);this.data.event('Shared-work employee permission updated');return {ok:true};
    }
    const lm=path.match(/^\/api\/apprentice\/lessons\/([a-f0-9-]{36})\/decide$/);if(lm)return d.decideLesson(lm[1],b);
    const cm=path.match(/^\/api\/apprentice\/cases\/([a-f0-9-]{36})\/(review|note|lesson|approve|send-email|delete|confirm-sent|edit-transcript|cancel)$/);
    if(cm){const id=cm[1],action=cm[2];d.checked(id,b.revision);
      if(action==='cancel'){await this.worker.cancel(id);return {cancelled:true};}
      if(action==='review'){const jobId=d.enqueue(id,b);this.worker.tick();return {jobId};}
      if(action==='note'){d.note(id,'owner',b.recipient||'team','owner-note',b.message,b.evidence||[]);return {ok:true};}
      if(action==='lesson')return {lessonId:d.propose(id,b)};
      if(action==='approve'){d.approve(id,b);return {approved:true,sent:false};}
      if(action==='send-email'){
        this.real();const detail=d.detail(id);if(detail.practice)throw new OfficeError('Practice conversations cannot send email.');
        if(detail.status!=='approved')throw new OfficeError('Approve the exact final draft before sending.',409);
        if(d.db.prepare("SELECT 1 FROM ap_decisions WHERE case_id=? AND kind='sent-email' AND revision=?").get(id,detail.revision))throw new OfficeError('This approved revision was already sent.',409);
        const incoming=[...detail.sources].filter(s=>s.kind==='email'&&s.payload.direction==='incoming').sort((a,b)=>Date.parse(b.payload.at||b.updated)-Date.parse(a.payload.at||a.updated))[0];
        if(!incoming)throw new OfficeError('No incoming customer email is attached to this case.');
        const address=String(incoming.payload.from||'').match(/<([^<>\s]+@[^<>\s]+)>/)?.[1]||String(incoming.payload.from||'').match(/[^\s<>]+@[^\s<>]+/)?.[0];
        if(!address)throw new OfficeError('The customer reply address could not be verified.');
        const decision=detail.decisions.find(x=>x.kind==='approved-not-sent'&&x.revision===detail.revision);
        if(!decision)throw new OfficeError('The approved message could not be found.',409);
        if(b.confirm!==true)throw new OfficeError('Confirm sending this exact approved email.');
        const subject=String(incoming.payload.subject||detail.title||'Friendly Party Rental').replace(/^\s*(re:\s*)?/i,'Re: ').slice(0,200);
        const result=await this.i.sendRelayEmail({to:address,subject,text:decision.content},new AbortController().signal);
        d.db.prepare('INSERT INTO ap_decisions(case_id,kind,revision,content,created) VALUES(?,?,?,?,?)').run(id,'sent-email',detail.revision,d.pack(JSON.stringify({to:address,subject,sentAt:result.sentAt}),false),stamp());
        d.db.prepare("UPDATE ap_cases SET status='sent',updated=? WHERE id=?").run(stamp(),id);
        d.note(id,'owner','email','sent',`Sent the owner-approved revision to ${address}. No other customer action was performed.`);
        d.event('Owner-approved email sent');return {sent:true,to:address,subject,sentAt:result.sentAt};
      }
      if(action==='delete'){if(b.confirm!==true)throw new OfficeError('Confirm erasing and excluding this conversation.');if(this.busy())throw new OfficeError('Pause the office and let in-progress work settle before erasing a conversation.',409);d.remove(id);return {erased:true};}
      if(action==='edit-transcript'){
        const source=d.sources(id).find(s=>s.id===b.sourceId);if(!source||source.kind!=='phone')throw new OfficeError('Only a phone transcript can be corrected here.');
        const message=redact(requireText(b.message,'Corrected transcript',30000)),c=d.row(id);
        const payload={...source.payload,message,correctedBy:'owner',correctedAt:stamp(),providerFingerprint:source.payload.providerFingerprint||source.fingerprint};
        d.db.prepare('UPDATE ap_sources SET payload=?,fingerprint=?,updated=? WHERE id=?').run(d.pack(payload,c.practice),digest(message),stamp(),source.id);
        d.db.prepare("UPDATE ap_cases SET revision=revision+1,status='open',draft='',draft_revision=NULL,updated=? WHERE id=?").run(stamp(),id);d.event('Call transcript corrected by owner');return {ok:true};
      }
      if(action==='confirm-sent'){
        const source=d.sources(id).find(s=>s.id===b.sourceId);if(!source||source.kind!=='email'||source.payload.direction!=='sent'||source.payload.automated)throw new OfficeError('Choose a non-automated sent reply.');
        if(b.confirm!==true)throw new OfficeError('Confirm a human wrote this reply before using it as a training example.');
        const payload={...source.payload,humanConfirmed:true,humanAuthor:requireText(b.author,'Human author',100),confirmedAt:stamp()};
        d.db.prepare('UPDATE ap_sources SET payload=?,updated=? WHERE id=?').run(d.pack(payload,d.row(id).practice),stamp(),source.id);
        d.db.prepare("UPDATE ap_cases SET revision=revision+1,status='open',draft='',draft_revision=NULL,updated=? WHERE id=?").run(stamp(),id);d.event('Human reply example confirmed by owner');return {ok:true};
      }
    }
    throw new OfficeError('Apprenticeship route not found.',404);
  }
}
