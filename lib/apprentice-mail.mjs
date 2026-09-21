import { OfficeError } from './store.mjs';
import { plainMessage } from './integrations.mjs';
import { digest, stamp, redact } from './apprentice-data.mjs';
const BASE='https://gmail.googleapis.com/gmail/v1/users/me';
export const ACCOUNT='customerservice@friendlypartyrental.com';
export function decodeMail(m,includeDrafts=false) {
  const labels=m.labelIds||[],h=n=>(m.payload?.headers||[]).find(x=>x.name.toLowerCase()===n)?.value||'';
  if(labels.includes('DRAFT')&&!includeDrafts)return null;
  let message=plainMessage(m.payload),previewOnly=false;
  if(!message){message=m.snippet||'';previewOnly=true;}
  const direction=labels.includes('DRAFT')?'draft':labels.includes('SENT')?'sent':'incoming';
  const automated=!!(h('list-id')||/auto-generated|auto-replied/i.test(h('auto-submitted'))||/bulk|list|junk/i.test(h('precedence'))||/no.?reply|mailer-daemon/i.test(h('from')));
  const timestamp=Number(m.internalDate);if(!Number.isFinite(timestamp)||timestamp<0||timestamp>Date.now()+300000)throw new OfficeError('A mailbox message had an invalid timestamp.');
  return {messageId:m.id,threadId:m.threadId,subject:h('subject').slice(0,160)||'Untitled message',from:h('from').slice(0,300),to:h('to').slice(0,500),
    message:redact(message.slice(0,14000)),direction,labels,automated,humanConfirmed:false,locationReviewNeeded:/friendlypartyrentalsc\.com|south carolina|\[SC\]/i.test(h('subject')+' '+message),at:new Date(timestamp).toISOString(),
    limitation:previewOnly?'Preview only; full message and attachments not reviewed.':'Plain-text message; attachments and HTML-only details not reviewed.',observedAt:stamp()};
}
export class MailObserver {
  constructor(data,integrations){this.data=data;this.store=data.store;this.i=integrations;this.busy=null;this.controller=null;this.timer=null;}
  status(){const s=this.store.get('ap:mail')||{};return {account:ACCOUNT,enabled:this.data.settings().observing,connected:this.i.status().gmail.connected,
    configured:this.i.status().gmail.configured,phase:s.phase||'not-started',lastAttempt:s.lastAttempt||null,lastSync:s.lastSync||null,
    initialSince:s.since||null,pending:s.pending?.length||0,backfillComplete:!!s.backfillComplete,gapDetected:!!s.gapDetected,
    lastError:s.lastError||null,nextAttempt:s.nextAttempt||null,intervalSeconds:60,busy:!!this.busy};}
  allowed(){const s=this.store.get('settings');return s.mode==='shadow'&&!s.paused&&this.data.settings().observing;}
  start(){this.timer=setInterval(()=>{if(this.allowed()){const s=this.store.get('ap:mail')||{};if(!s.nextAttempt||Date.parse(s.nextAttempt)<=Date.now())void this.sync().catch(()=>{});}},60000);this.timer.unref();}
  async stop(){clearInterval(this.timer);this.abort();await this.busy?.catch(()=>{});}
  abort(){this.controller?.abort();}
  async sync(){
    if(this.busy)throw new OfficeError('Mailbox synchronization is already running.',409);
    if(!this.allowed())throw new OfficeError('Enable authorized email observation in a resumed shadow workspace first.',409);
    this.data.needPrivate();const c=new AbortController();this.controller=c;
    this.busy=(this.i.env.MAIL_RELAY_URL&&this.i.env.MAIL_RELAY_TOKEN?this.runRelay(c.signal):this.run(c.signal)).finally(()=>{this.busy=null;this.controller=null;});return this.busy;
  }
  async runRelay(signal){
    let state=this.store.get('ap:mail')||{};
    const save=()=>{this.store.set('ap:mail',state);this.store.changed();};
    const checkpoint=()=>{signal.throwIfAborted();if(!this.allowed())throw new DOMException('Observation paused','AbortError');};
    state.lastAttempt=stamp();state.phase='relay';save();
    try{
      checkpoint();
      const box=await this.i.mailRelay(signal);checkpoint();
      if(String(box.account||'').toLowerCase()!==ACCOUNT)throw new OfficeError('The built-in mailbox relay is not the Friendly customer-service account.',403);
      let processed=0;
      for(const raw of box.messages||[]){
        checkpoint();
        if(!raw?.id||!raw?.direction||!raw?.date)continue;
        const subject=String(raw.subject||'Untitled message').slice(0,160);
        const threadSeed=String(raw.references?.[0]||raw.inReplyTo||raw.messageIdHeader||raw.id);
        const caseKey='relay-thread:'+ACCOUNT+':'+threadSeed;
        const current=this.data.create({key:caseKey,title:subject,lead:'email'});
        if(!current)continue;
        const msg={messageId:String(raw.id),threadId:threadSeed,subject,from:String(raw.from||'').slice(0,300),to:Array.isArray(raw.to)?raw.to.join(', ').slice(0,500):String(raw.to||'').slice(0,500),
          message:redact(String(raw.message||'').slice(0,14000)),direction:raw.direction==='sent'?'sent':'incoming',labels:[String(raw.folder||'')],automated:false,humanConfirmed:false,
          locationReviewNeeded:/friendlypartyrentalsc\.com|south carolina|\[SC\]/i.test(subject+' '+String(raw.message||'')),at:new Date(raw.date).toISOString(),
          limitation:'Built-in IMAP relay; plain-text body only. Attachments and full Gmail labels are not reviewed.',observedAt:stamp(),relayId:String(raw.id)};
        const changed=this.data.ingest(current.id,{key:'mail-relay:'+raw.id,kind:'email',payload:msg,fingerprint:JSON.stringify({body:msg.message,direction:msg.direction,subject})});
        if(changed&&this.data.settings().autoReview&&!msg.automated&&!msg.locationReviewNeeded){
          const active=this.data.db.prepare("SELECT 1 FROM ap_jobs WHERE case_id=? AND status IN ('queued','running')").get(current.id);
          if(!active)this.data.enqueue(current.id,{revision:this.data.row(current.id).revision});
        }
        processed++;
      }
      state.lastSync=stamp();state.lastError=null;state.failures=0;state.nextAttempt=null;state.backfillComplete=true;save();this.i.verified('gmail');
      return {processed,...this.status(),scope:'Built-in Friendly mailbox relay, recent inbox and sent mail only. Attachments and screen activity are not observed.'};
    }catch(e){
      state.lastError=e.name==='AbortError'?'Observation paused. Progress is retained.':e instanceof OfficeError?e.message:'Built-in mailbox read failed. Saved progress is retained.';
      state.failures=Math.min(8,(state.failures||0)+1);state.nextAttempt=new Date(Date.now()+Math.min(900000,60000*2**(state.failures-1))).toISOString();save();throw e;
    }
  }
  async run(signal){
    let state=this.store.get('ap:mail')||{};
    const save=()=>{this.store.set('ap:mail',state);this.store.changed();};
    const checkpoint=()=>{signal.throwIfAborted();if(!this.allowed())throw new DOMException('Observation paused','AbortError');};
    let headers;
    const get=async path=>{checkpoint();const r=await this.i.request(BASE+path,{headers,signal,maxBytes:1000000});checkpoint();return r;};
    state.lastAttempt=stamp();save();
    try{
      const token=await this.i.gmailToken(signal);headers={authorization:`Bearer ${token}`};
      const p=await get('/profile');if(p.status!==200||String(p.data?.emailAddress||'').toLowerCase()!==ACCOUNT)throw new OfficeError('Connect the exact Friendly customer-service mailbox. No other account may be observed.',403);
      if(!/^\d+$/.test(String(p.data.historyId)))throw new OfficeError('Mailbox synchronization position unavailable.');
      const labels=await get('/labels');if(labels.status!==200)throw new OfficeError('Private-label exclusions could not be checked. No messages imported.');
      const excluded=new Set(['SPAM','TRASH','CATEGORY_PROMOTIONS','CATEGORY_SOCIAL',...(labels.data?.labels||[]).filter(x=>/^(Friendly\/Do not learn|Friendly\/Private)$/i.test(x.name)).map(x=>x.id)]);
      if(!state.phase||state.phase==='not-started'||state.phase==='recover'){
        state={...state,phase:'backfill',anchor:String(p.data.historyId),pageToken:null,pending:[],since:new Date(Date.now()-this.data.settings().historyDays*86400000).toISOString(),backfillComplete:false,finalHistory:null};save();
      }
      if(!(state.pending?.length)){
        if(state.phase==='backfill'){
          const query=new URLSearchParams({maxResults:'25',q:`after:${Math.floor(Date.parse(state.since)/1000)} -in:spam -in:trash`});
          if(state.pageToken)query.set('pageToken',state.pageToken);
          const r=await get('/messages?'+query);if(r.status===400&&state.pageToken){state.phase='recover';state.gapDetected=true;save();throw new OfficeError('Backfill cursor expired. A bounded resynchronization is required.');}
          if(r.status!==200||!r.data)throw new OfficeError('Mailbox backfill could not be read. Saved progress retained.');
          state.pending=(r.data.messages||[]).map(x=>x.id);state.afterPage=r.data.nextPageToken||null;state.pageLoaded=true;save();
        }else{
          const query=new URLSearchParams({startHistoryId:state.cursor,maxResults:'50'});if(state.pageToken)query.set('pageToken',state.pageToken);
          const r=await get('/history?'+query);
          if(r.status===404){state.phase='recover';state.gapDetected=true;state.pageToken=null;save();throw new OfficeError('Gmail history expired. Recent messages will be resynchronized; older changes may be unavailable.');}
          if(r.status!==200||!r.data)throw new OfficeError('Mailbox changes could not be read. Saved progress retained.');
          const ids=new Set();for(const row of r.data.history||[])for(const field of ['messagesAdded','messagesDeleted','labelsAdded','labelsRemoved'])for(const e of row[field]||[])ids.add(e.message?.id);
          state.pending=[...ids].filter(Boolean);state.afterPage=r.data.nextPageToken||null;state.finalHistory=String(r.data.historyId||state.cursor);state.pageLoaded=true;save();
        }
      }
      let processed=0;
      while(state.pending?.length&&processed<25){
        checkpoint();const id=state.pending[0];if(!/^[a-zA-Z0-9_-]{1,200}$/.test(id))throw new OfficeError('Mailbox returned an invalid source identifier.');
        const old=this.data.db.prepare('SELECT id,case_id,payload FROM ap_sources WHERE source_key=?').get(digest('gmail-message:'+id));
        const r=await get('/messages/'+encodeURIComponent(id)+'?format=full');
        if(r.status===404){if(old){if(this.data.unpack(old.payload).direction==='draft'){this.data.db.prepare('DELETE FROM ap_sources WHERE id=?').run(old.id);this.data.db.prepare("UPDATE ap_cases SET revision=revision+1,status='open',draft='',draft_revision=NULL,updated=? WHERE id=?").run(stamp(),old.case_id);}else this.data.remove(old.case_id);}}
        else{
          if(r.status!==200||!r.data?.payload)throw new OfficeError('A message could not be read; synchronization will resume at this message.');
          const raw=r.data;
          if((raw.labelIds||[]).some(x=>excluded.has(x))){
            const thread=this.data.db.prepare('SELECT id FROM ap_cases WHERE source_key=?').get(digest('gmail-thread:'+ACCOUNT+':'+raw.threadId));
            if(old||thread)this.data.remove(old?.case_id||thread.id);
            else this.data.db.prepare('INSERT OR IGNORE INTO ap_suppression VALUES(?,?)').run(digest('gmail-thread:'+ACCOUNT+':'+raw.threadId),stamp());
          }
          else{
            const msg=decodeMail(raw,this.data.settings().includeDrafts);
            if(msg&&(old||Date.parse(msg.at)>=Date.parse(state.since))){
              const current=this.data.create({key:'gmail-thread:'+ACCOUNT+':'+msg.threadId,title:msg.subject,lead:'email'});
              if(current){
                const changed=this.data.ingest(current.id,{key:'gmail-message:'+id,kind:'email',payload:msg,fingerprint:JSON.stringify({body:msg.message,direction:msg.direction,automated:msg.automated})});
                if(changed&&this.data.settings().autoReview&&msg.direction!=='draft'&&!msg.automated&&!msg.locationReviewNeeded){
                  // Coalesce updates in the same thread. A running review will fail its revision checkpoint.
                  const active=this.data.db.prepare("SELECT 1 FROM ap_jobs WHERE case_id=? AND status IN ('queued','running')").get(current.id);
                  if(!active)this.data.enqueue(current.id,{revision:this.data.row(current.id).revision});
                }
              }
            }
          }
        }
        state.pending.shift();processed++;save();
      }
      if(!state.pending.length&&state.pageLoaded){
        state.pageToken=state.afterPage;state.pageLoaded=false;
        if(!state.pageToken){
          if(state.phase==='backfill'){state.phase='history';state.cursor=state.anchor;state.backfillComplete=true;}
          else{state.cursor=state.finalHistory;state.lastSync=stamp();}
        }
      }
      state.lastError=null;state.failures=0;state.nextAttempt=null;save();this.i.verified('gmail');
      return {processed,...this.status(),scope:'Authorized mailbox messages and label state, not screen activity. Initial lookback is bounded. Sent authors are not verified automatically.'};
    }catch(e){
      state.lastError=e.name==='AbortError'?'Observation paused. Progress is retained.':e instanceof OfficeError?e.message:'Mailbox read failed. Check the connection; saved progress is retained.';
      state.failures=Math.min(8,(state.failures||0)+1);state.nextAttempt=new Date(Date.now()+Math.min(900000,60000*2**(state.failures-1))).toISOString();save();throw e;
    }
  }
}
