import { caseList,phoneView,observationView,escapeHTML as apEsc } from './apprentice-views.js';
import { caseView,lessonsView } from './apprentice-case.js';
{
 const ap={active:false,tab:'cases',caseId:null,cases:[],lessons:[],detail:null,more:null,role:'all',loading:false,pending:null,lastLoad:0,dirty:false};
 const area=document.createElement('section');area.id='apprentice-view';area.className='view ap-root';area.hidden=true;$('#main').append(area);
 const links=document.createElement('div');links.className='ap-nav';links.setAttribute('aria-label','Apprenticeship workspaces');
 links.innerHTML='<button data-ap-route="cases"><span>◈</span> Team case room <b id="ap-case-count">0</b></button><button data-ap-route="phone"><span>☎</span> Riley · Phone apprentice</button><button data-ap-route="observations"><span>✉</span> Email shadowing</button><button data-ap-route="lessons"><span>✧</span> Learning review <b id="ap-lesson-count">0</b></button>';
 $('.scene-area').before(links);
 const team=()=>state?.apprenticeship?.team||[];
 async function get(path){const r=await fetch(path,{cache:'no-store'});if(r.status===401){signedOut();throw new Error('Sign in again.');}const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not read training records.');return data;}
 function top(){const s=state.apprenticeship;return `<div class="ap-headline"><span class="badge warm">${state.settings.mode==='practice'?'Practice · fictional':'Shadow · private sources'}</span><span>${state.settings.paused?'Office paused':s.live?'Team reviewing a case':'Team available'}</span><span>${state.settings.useAI&&s.modelReady?'Model assistance enabled':'Checklist mode · model not enabled'}</span></div><div class="ap-team-status">${s.team.map(t=>`<button data-ap-pause="${t.id}" aria-label="${t.apprenticeshipPaused?'Resume':'Pause'} ${t.name} shared casework"><b>${t.name}</b><span>${t.paused?'Paused':s.live?.role===t.id?'Working on shared case':'Available'}</span><small>${t.officePaused?'Office pause applies · ':''}${t.apprenticeshipPaused?'Resume desk':'Pause desk'}</small></button>`).join('')}</div><nav class="ap-tabs" aria-label="Training sections">${[['cases','Team room'],['phone','Phone training'],['lessons','Learning review'],['observations','Observation setup']].map(([k,v])=>`<button data-ap-route="${k}" class="${ap.tab===k?'active':''}">${v}</button>`).join('')}<button data-ap-action="reload">↻ Refresh</button></nav>`;}
 function paint(){if(!ap.active||!state?.apprenticeship)return;const s=state.apprenticeship;
  area.innerHTML=top()+(ap.caseId&&ap.detail?caseView(ap.detail,team()):ap.tab==='phone'?phoneView(s,ap.cases):ap.tab==='lessons'?lessonsView(ap.lessons):ap.tab==='observations'?observationView(s):caseList(ap.cases,ap.more,ap.role));
 }
 async function load(force=false){
  if(!ap.active||(!force&&(ap.dirty||Date.now()-ap.lastLoad<1000)))return;
  if(ap.loading){if(force){await ap.pending;return load(true);}return;}
  if(!force&&area.contains(document.activeElement)&&document.activeElement.matches('input,textarea,select'))return;
  ap.loading=true;const requestedCase=ap.caseId,requestedTab=ap.tab;
  ap.pending=(async()=>{
    const data=await get('/api/apprentice/cases');
    const detail=requestedCase?await get('/api/apprentice/cases/'+requestedCase):null;
    const lessons=requestedTab==='lessons'?(await get('/api/apprentice/lessons')).lessons:ap.lessons;
    if(!ap.active||ap.caseId!==requestedCase||ap.tab!==requestedTab)return;
    ap.cases=data.cases;ap.more=data.nextOffset;ap.detail=detail;ap.lessons=lessons;
    if(!ap.dirty&&(force||ap.tab==='cases'||ap.tab==='lessons'||ap.caseId))paint();ap.lastLoad=Date.now();
  })();
  try{await ap.pending;}finally{ap.loading=false;ap.pending=null;}
 }
 async function open(tab='cases',caseId=null,role='all'){
  if(!state)return;if(ap.dirty&&!confirm('Discard unsaved training edits?'))return;
  if($('#inspector').open)closeInspector();if($('#inspector').open)return;
  ap.dirty=false;ap.active=false;oldView('office');ap.active=true;ap.tab=tab;ap.caseId=caseId;ap.detail=null;ap.role=role;view='apprentice';
  for(const id of ['team-dialog','activity-dialog'])if($('#'+id).open)$('#'+id).close();
  $$('.view').forEach(x=>x.hidden=true);$('#records-view').hidden=true;area.hidden=false;
  document.body.dataset.hqView='apprentice';document.body.classList.remove('command-open');
  $('#page-eyebrow').textContent='FRIENDLY PARTY RENTAL · APPRENTICESHIP';$('#page-title').textContent='Learn from Nicole. Work as a team.';$('#page-subtitle').textContent='Real conversations, scoped collaboration, and owner-approved lessons.';
  area.innerHTML=top()+'<div class="ap-empty">Loading private workspace…</div>';await load(true);window.scrollTo({top:0,behavior:'instant'});
 }
 const oldView=setView;setView=function(next){if(headings[next]){if(ap.dirty&&!confirm('Discard unsaved training edits?'))return;ap.dirty=false;ap.active=false;area.hidden=true;}oldView(next);};
 const oldRender=render;render=function(){oldRender();decorateAp();if(ap.active&&state)void load().catch(err=>toast(err.message));};
 function decorateAp(){
  const s=state?.apprenticeship;if(!s)return;
  $('#ap-case-count').textContent=Object.values(s.counts).reduce((a,b)=>a+b,0);$('#ap-lesson-count').textContent=s.lessonsPending;
  const dir=$('#team-directory');if(dir&&!$('#ap-team-phone')){const b=document.createElement('button');b.id='ap-team-phone';b.className='team-directory-card';b.dataset.apRoute='phone';b.innerHTML='<span class="avatar">RI</span><span><strong>Riley · Phone apprentice</strong><p>Learns from authorized completed calls with Nicole. Works with Morgan, Avery and Alex.</p><small>No live phone connection</small></span><b>→</b>';dir.append(b);}
  if(s.live&&!state.settings.paused)for(const b of $$(`#team-cards [data-agent="${s.live.role}"],#mobile-team [data-agent="${s.live.role}"]`)){const label=b.querySelector('.team-task');if(label)label.textContent='Working in shared case room · owner review required';}
  if(ap.active)$$('#navigation .nav-item').forEach(b=>{b.classList.remove('active');b.removeAttribute('aria-current');});
 }
 const oldRules=renderRules;renderRules=function(){oldRules();state.rules.forEach((r,i)=>{if(r.status==='revoked'){const b=$$('#rule-list .rule-card')[i]?.querySelector('.badge');if(b)b.textContent='Revoked · not used';}});};
 const oldInspector=renderInspector;renderInspector=function(){oldInspector();if(!$('#inspector').open||$('#ap-inspector-link'))return;const b=document.createElement('button');b.id='ap-inspector-link';b.className='button secondary ap-desk-link';b.dataset.apRoute='cases';b.dataset.apRole=selectedRole;b.textContent='Open this employee’s shared cases →';$('#inspector-content').append(b);};
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(ap.active&&b?.dataset.hqRoute&&b.dataset.hqRoute!=='team'){if(ap.dirty&&!confirm('Discard unsaved training edits?')){e.preventDefault();e.stopImmediatePropagation();return;}ap.active=false;ap.dirty=false;area.hidden=true;}},true);
 area.addEventListener('input',()=>ap.dirty=true);
 window.addEventListener('beforeunload',e=>{if(ap.dirty){e.preventDefault();e.returnValue='';}});
 const values=form=>Object.fromEntries(new FormData(form));
 function callPayload(form){const v=values(form);return {...v,at:v.at?new Date(v.at).toISOString():'',consent:{staff:form.elements.staffConsent.checked,caller:form.elements.callerConsent.checked,businessOnly:form.elements.businessOnly.checked,at:v.consentAt?new Date(v.consentAt).toISOString():'',basis:v.consentBasis},sameCaseConfirmed:form.elements.sameCaseConfirmed.checked};}
 document.addEventListener('click',safe(async event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.apRoute){await open(b.dataset.apRoute,null,b.dataset.apRole||'all');return;}
  if(b.dataset.apCase){await open('cases',b.dataset.apCase);return;}
  if(b.dataset.apPause){const role=team().find(t=>t.id===b.dataset.apPause);await post('/api/apprentice/agent',{role:role.id,paused:!role.apprenticeshipPaused});paint();return;}
  const action=b.dataset.apAction;if(!action)return;b.disabled=true;
  try{
   if(action==='cancel'){await post('/api/apprentice/cases/'+ap.caseId+'/cancel',{revision:ap.detail.revision});ap.dirty=false;await load(true);toast('Shared review cancelled. Saved contributions remain available.');}
   if(action==='practice'){const r=await post('/api/apprentice/practice');ap.dirty=false;await open('cases',r.caseId);}
   if(action==='reload'){if(ap.dirty&&!confirm('Discard unsaved training edits and refresh?'))return;ap.dirty=false;await load(true);}
   if(action==='sync'){await post('/api/apprentice/sync');ap.dirty=false;paint();toast('Mailbox synchronization cycle completed. Check coverage and pending messages.');}
   if(action==='more'){const r=await get('/api/apprentice/cases?offset='+ap.more);ap.cases.push(...r.cases);ap.more=r.nextOffset;paint();}
   if(action==='phone-settings'){const d=$('#ap-phone-settings-dialog');if(d&&!d.open)d.showModal();}
   if(action==='erase'){if(!confirm('Erase and exclude this conversation and revoke its linked lessons in this app? This cannot be undone here.'))return;await post('/api/apprentice/cases/'+ap.caseId+'/delete',{revision:ap.detail.revision,confirm:true});ap.dirty=false;await open('cases');}
   if(action==='send-email'){if(!confirm('Send this exact owner-approved reply through customerservice@friendlypartyrental.com?'))return;const r=await post('/api/apprentice/cases/'+ap.caseId+'/send-email',{revision:ap.detail.revision,confirm:true});ap.dirty=false;await open('cases',ap.caseId);toast('Approved email sent to '+r.to+'.');}
   if(action==='transcribe'){
    const form=$('#ap-phone-form'),payload=callPayload(form),file=$('#ap-audio-file').files[0];if(!file||file.size>8*1024*1024)throw new Error('Choose an audio file of at most 8 MB.');
    payload.providerConsent=form.elements.providerConsent.checked;payload.sensitiveContentRemoved=form.elements.sensitiveContentRemoved.checked;
    const encoded=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('Could not read audio file.'));r.readAsDataURL(file);});
    const result=await post('/api/apprentice/audio',{...payload,audio:encoded});form.elements.transcript.value=result.transcript;ap.dirty=true;toast('Transcribed. Check wording and label Nicole / customer correctly before importing.');
   }
  }finally{if(b.isConnected)b.disabled=false;}
 }));
 area.addEventListener('change',safe(async e=>{if(e.target.id==='ap-transcript-file'){const file=e.target.files[0];if(!file)return;if(file.size>120000)throw new Error('Transcript file is too large.');const text=await file.text();if(text.length>30000)throw new Error('Transcript limit is 30,000 characters.');$('#ap-phone-form').elements.transcript.value=text;ap.dirty=true;}}));
 area.addEventListener('submit',safe(async event=>{
  event.preventDefault();const form=event.target,v=values(form),button=event.submitter;if(button)button.disabled=true;
  try{
   let caseId=ap.caseId;
   if(form.id==='ap-phone-form'){const r=await post('/api/apprentice/phone',callPayload(form));if(r.excluded)throw new Error('This source was previously excluded.');caseId=r.caseId;}
   else if(form.id==='ap-phone-settings-form'){if(event.submitter?.value==='cancel'){form.closest('dialog')?.close();return;}const split=x=>String(x||'').split(',').map(v=>v.trim()).filter(Boolean);await post('/api/apprentice/phone-system/settings',{businessHours:v.businessHours,businessRoute:split(v.businessRoute),afterHoursRoute:split(v.afterHoursRoute),recording:form.elements.recording.checked,aiAnswering:form.elements.aiAnswering.checked,confirm:true});form.closest('dialog')?.close();ap.dirty=false;await load(true);toast('Friendly Phone routing saved. Carrier permissions remain separate.');return;}
   else if(form.id==='ap-settings-form'){
    const body={historyDays:Number(v.historyDays),retentionDays:Number(v.retentionDays)};for(const k of ['observing','includeDrafts','autoReview','phoneWebhook','consent'])body[k]=form.elements[k].checked;
    await post('/api/apprentice/settings',body);ap.dirty=false;paint();toast('Observation settings saved. Connections and office pause still apply.');return;
   }else if(form.classList.contains('ap-lesson-decision')){await post('/api/apprentice/lessons/'+form.dataset.lesson+'/decide',{...v,revision:Number(form.dataset.revision),decision:event.submitter.value});ap.dirty=false;await load(true);toast('Learning decision recorded. Only approved real-source procedures enter the handbook.');return;}
   else{
    const action=form.id==='ap-question-form'?'review':form.id==='ap-approve-form'?'approve':form.id==='ap-lesson-form'?'lesson':form.classList.contains('ap-human-form')?'confirm-sent':'edit-transcript';
    const body={...v,revision:ap.detail.revision,sourceId:form.dataset.sourceId};if(action==='confirm-sent')body.confirm=form.elements.confirm.checked;
    await post('/api/apprentice/cases/'+ap.caseId+'/'+action,body);
    if(action==='approve')toast('Exact shared draft approved. Nothing was sent.');
   }
   ap.dirty=false;await open('cases',caseId);
  }finally{if(button?.isConnected)button.disabled=false;}
 }));
 decorateAp();
}
