import { OfficeScene } from './scene.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
 office:'M3 10 12 3l9 7M5 9v12h14V9M9 21v-7h6v7',board:'M3 4h18v16H3zM9 4v16m6-16v16M5 8h2m4 0h2m4 0h2M5 12h2m6 0h-2',
 check:'m7 12 3 3 7-7M21 12a9 9 0 1 1-5-8',book:'M12 5v16M3 3c4 0 7 0 9 2 2-2 5-2 9-2v16c-4 0-7 0-9 2-2-2-5-2-9-2V3Z',
 connect:'m8 12 8 0M8 8H5a4 4 0 0 0 0 8h3m8-8h3a4 4 0 0 1 0 8h-3',pause:'M8 5v14M16 5v14',play:'m7 4 14 8-14 8V4Z',
 spark:'m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z',shield:'m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Zm-4 10 3 3 5-6',
 lock:'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4m-4 5v2',search:'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',mail:'M3 5h18v14H3V5Zm0 1 9 7 9-7',
 code:'m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18',clock:'M12 7v5l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
 alert:'m12 3 10 18H2L12 3Zm0 6v5m0 3v1',arrow:'M4 12h16m-6-6 6 6-6 6',user:'M4 21v-3a8 8 0 0 1 16 0v3M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18',download:'M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.office}"/></svg>`;
function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
const statusLabel={queued:'Queued',running:'Working',waiting_approval:'Needs review',blocked:'Blocked',approved:'Approved · not sent',rejected:'Changes requested',cancelled:'Cancelled'};
const badge=t=>`<span class="badge ${t.status==='blocked'?'red':t.status==='waiting_approval'?'warm':t.status==='approved'?'green':t.status==='running'?'purple':''}">${statusLabel[t.status]||esc(t.status)}</span>`;
const sourceBadge=t=>`<span class="badge ${t.source==='practice'?'warm':''}">${t.source==='practice'?'Fictional practice':t.source==='manual'?'Owner import':t.source==='gmail'?'Gmail read-only':'Owner task'}</span>`;
const fmtTime=time=>new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}).format(new Date(time));
const fmtDate=time=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}).format(new Date(time));
let state=null,view='office',scene=null,stream=null,connected=false,loading=false,selectedRole=null,selectedTask=null,tab='work',dirty=false,toastTimer,reconnectTimer,retryDelay=1000,lastStateAt=0;
const pending=new Set();
function toast(message){const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,6500);}
function network(ok){
 connected=ok;
 const badge=$('#network'),error=$('#connection-error');
 badge.classList.toggle('offline',!ok);
 badge.innerHTML=`<i></i>${ok?'Office live':'Reconnecting…'}`;
 error.hidden=ok;
 if(!ok)error.textContent='Reconnecting automatically. Your saved work is still here.';
 $('#pause-all').disabled=false;
 window.dispatchEvent(new CustomEvent('office-network',{detail:{connected:ok}}));
}
function signedOut(){connected=false;clearTimeout(reconnectTimer);stream?.close();stream=null;$('#shell').hidden=true;$('#login').hidden=false;$('#inspector').close();state=null;setTimeout(()=>$('#password').focus(),50);}
function scheduleReconnect(){
 if(reconnectTimer||!state)return;
 network(false);
 reconnectTimer=setTimeout(async()=>{reconnectTimer=null;stream?.close();stream=null;await refresh(true);retryDelay=Math.min(15000,Math.round(retryDelay*1.7));},retryDelay);
}
function openStream(){
 if(stream||!state)return;
 const s=new EventSource('/api/events');stream=s;
 s.addEventListener('refresh',()=>{network(true);void refresh(true);});
 s.addEventListener('heartbeat',()=>network(true));
 s.onopen=()=>{retryDelay=1000;network(true);};
 s.onerror=()=>{if(stream===s){s.close();stream=null;}scheduleReconnect();};
}
async function refresh(force=false){
 if(loading&&!force)return false;
 loading=true;
 try{
  const r=await fetch('/api/state',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(r.status===401){signedOut();return false;}
  if(!r.ok)throw new Error('Office state unavailable');
  state=await r.json();lastStateAt=Date.now();clearTimeout(reconnectTimer);reconnectTimer=null;retryDelay=1000;network(true);$('#login').hidden=true;$('#shell').hidden=false;render();
  if(!scene){scene=new OfficeScene($('#office-canvas'),$('#desk-labels'),openAgent,()=>{$('#scene-fallback').hidden=false;$('#desk-labels').hidden=true;});scene.update(state);}
  openStream();return true;
 }catch{
  if(state)scheduleReconnect();
  else{$('#login').hidden=false;$('#login-error').textContent='Trying to reconnect to your office automatically…';}
  return false;
 }finally{loading=false;}
}
async function ensureConnection(){if(connected&&state&&Date.now()-lastStateAt<30000)return true;return await refresh(true);}
async function post(path,data={}){
 if(!state||!(await ensureConnection()))throw new Error('The office is reconnecting. Try again in a moment.');
 if(pending.has(path))throw new Error('That request is already in progress.');
 pending.add(path);
 try{
  const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':state.csrf},body:JSON.stringify(data),signal:AbortSignal.timeout(30000)});
  const value=await r.json();if(r.status===401){signedOut();throw new Error('Please sign in again.');}
  if(!r.ok)throw new Error(value.error||'Request failed.');
  await refresh(true);return value;
 }finally{pending.delete(path);}
}
const safe=fn=>async(...args)=>{try{await fn(...args);}catch(error){toast(error.message);}};
function agentStatus(a){const tasks=state.tasks.filter(t=>t.role===a.id);if(state.settings.paused||a.paused)return'Paused';if(tasks.some(t=>t.status==='running'))return'Working';if(tasks.some(t=>t.status==='waiting_approval'))return'Waiting for review';if(tasks.some(t=>t.status==='blocked'))return'Needs your help';if(tasks.some(t=>t.status==='queued'))return'Queued';return'Available';}
function currentTask(role){const priority={running:0,waiting_approval:1,blocked:2,queued:3,rejected:4,approved:5,cancelled:6};return [...state.tasks.filter(t=>t.role===role)].sort((a,b)=>(priority[a.status]-priority[b.status])||b.created.localeCompare(a.created))[0];}
function empty(title,detail,name='check'){return `<div class="empty-state">${icon(name)}<h2>${esc(title)}</h2><p>${esc(detail)}</p></div>`;}
function render(){
 $('#logout').hidden=state.localAccess;
 $('#mode-badge').textContent=state.settings.mode==='practice'?'Practice workspace':'Shadow workspace';
 const firstShift=state.settings.mode==='practice'&&!state.tasks.some(t=>t.source==='practice');
 $('#pause-all').innerHTML=`${icon(state.settings.paused?'play':'pause')}<span>${firstShift?'Start practice shift':state.settings.paused?'Resume office':'Pause all employees'}</span>`;
 $('#pause-all').classList.toggle('danger',!state.settings.paused);
 $('#workspace-note').innerHTML=state.settings.mode==='practice'?'<strong>Practice mode.</strong> Fictional scenarios use local templates and checks. No live data, emails or AI credits.':'<strong>Shadow mode.</strong> Explicitly configured sources can be read. Drafts require review; business actions remain disabled.';
 $('#nav-review').hidden=!state.stats.review;$('#nav-review').textContent=state.stats.review;
 const stats=[['clock','',state.stats.queued,'Tasks in queue','SHARED'],['check','warm',state.stats.review,'Awaiting your review','OWNER'],['alert','purple',state.stats.blocked,'Need attention','CHECK'],['shield','slate',state.stats.reviewed,'Drafts reviewed','NOT SENT']];
 $('#stats').innerHTML=stats.map(([i,c,n,label,note])=>`<div class="stat"><span class="stat-symbol ${c}">${icon(i)}</span><div><div class="stat-number">${n}</div><div class="stat-label">${label}</div></div><span class="stat-note">${note}</span></div>`).join('');
 $('#activity-feed').innerHTML=state.events.slice(0,10).map(e=>`<div class="event"><span class="event-symbol">${icon(e.role==='email'?'mail':e.role==='tech'?'code':e.role==='owner'?'shield':'board')}</span><div><strong>${esc(e.action)}</strong><p>${esc(e.detail.slice(0,115))}${e.detail.length>115?'…':''}</p><time datetime="${esc(e.time)}">${fmtTime(e.time)} · New York</time></div></div>`).join('');
 $('#team-cards').innerHTML=state.agents.map(a=>{const t=currentTask(a.id);return `<button class="team-card" data-agent="${a.id}" style="--agent-color:${a.color}"><div class="team-head"><span class="avatar">${a.initials}</span><div><div class="team-name">${a.name}</div><div class="team-role">${a.role} · AI</div></div><span class="team-status"></span></div><div class="team-task"><b>${agentStatus(a)}</b>${t?' · '+esc(t.title):' · No task running'}</div></button>`;}).join('')+`<button class="team-card" data-agent="owner" style="--agent-color:#73876b"><div class="team-head"><span class="avatar">BP</span><div><div class="team-name">Bryan</div><div class="team-role">Owner · You</div></div></div><div class="team-task"><b>Your review desk</b> · ${state.stats.review} waiting</div></button>`;
 $('#practice-welcome').hidden=state.settings.mode!=='practice'||state.tasks.some(t=>t.source==='practice');
 scene?.update(state);
 if(view==='tasks')renderBoard();if(view==='approvals')renderApprovals();if(view==='handbook')renderRules();if(view==='connections')renderConnections();
 if($('#inspector').open&&!dirty)renderInspector();
}
const headings={office:['YOUR BUSINESS, IN VIEW','Welcome to the office, Bryan.','A small team. A shared mission. You’re in control.'],tasks:['ONE SHARED WORKSPACE','Every task has an owner.','Follow work from the queue to your review desk. No duplicate conversations.'],approvals:['THE OWNER’S DESK','Your decisions move work forward.','Inspect the evidence. Refine the draft. Approve the exact version.'],handbook:['HOW FRIENDLY WORKS','A shared way of doing things.','Teach procedures deliberately. Keep one-off corrections separate.'],connections:['CONTROL THE CONNECTIONS','Real work starts with real sources.','Connect only what the office needs. Permissions stay narrow and visible.']};
function setView(next){if(!headings[next])return;view=next;$$('.view').forEach(e=>e.hidden=e.id!==`${view}-view`);$$('.nav-item').forEach(e=>{e.classList.toggle('active',e.dataset.view===view);e.setAttribute('aria-current',e.dataset.view===view?'page':'false');});const [eyebrow,title,subtitle]=headings[view];$('#page-eyebrow').textContent=eyebrow;$('#page-title').textContent=title;$('#page-subtitle').textContent=subtitle;render();if(view==='office')scene?.setCamera('overview');}
function renderBoard(){const query=$('#task-search').value.toLowerCase(),role=$('#task-filter').value;const tasks=state.tasks.filter(t=>(role==='all'||t.role===role)&&`${t.title} ${t.result}`.toLowerCase().includes(query));const columns=[['To do',['queued','running']],['Owner review',['waiting_approval']],['Needs attention',['blocked','rejected']],['Reviewed / closed',['approved','cancelled']]];$('#task-board').innerHTML=columns.map(([name,statuses])=>{const list=tasks.filter(t=>statuses.includes(t.status));return `<div class="board-column"><div class="column-heading">${name}<span>${list.length}</span></div>${list.length?list.map(taskCard).join(''):'<p class="board-empty">Nothing here right now.</p>'}</div>`;}).join('');}
function taskCard(t){const a=state.agents.find(a=>a.id===t.role);return `<button class="task-card" data-task="${t.id}">${badge(t)}<h3>${esc(t.title)}</h3><div class="task-card-footer"><span>${a.name} · ${t.source==='practice'?'Practice':'Shadow'}</span><span>${fmtTime(t.updated)}</span></div></button>`;}
function renderApprovals(){const tasks=state.tasks.filter(t=>t.status==='waiting_approval');$('#approval-list').innerHTML=tasks.length?tasks.map(t=>{const a=state.agents.find(a=>a.id===t.role);return `<article class="approval-card"><span class="avatar" style="--agent-color:${a.color}">${a.initials}</span><div>${sourceBadge(t)}<h3>${esc(t.title)}</h3><p>Prepared by ${a.name} · Revision ${t.revision} · ${t.evidence.length} evidence record(s)</p></div><button class="button primary" data-task="${t.id}">Inspect draft ${icon('arrow')}</button></article>`;}).join(''):empty('Your review desk is clear.','Drafts arrive here only after an employee has prepared an actual result.');}
function renderRules(){$('#rule-list').innerHTML=state.rules.map(r=>`<article class="rule-card"><div class="rule-header"><h3>${esc(r.title)}</h3><span class="badge ${r.status==='approved'?'green':'warm'}">${r.status==='approved'?'Approved':'Awaiting approval'}</span></div><p>${esc(r.body)}</p>${r.status==='proposed'?`<button class="button small secondary" data-rule-approve="${r.id}">Approve as a permanent procedure</button>`:''}</article>`).join('');}
function connectionCard(key,title,description,symbol,vars,buttons){const c=state.integrations[key];const label=c.verified?'Last successful read':c.connected?'Authorized · not read':c.configured?'Configured · unverified':'Not configured';return `<article class="panel connection-card"><span class="connection-icon">${icon(symbol)}</span><h3>${title}</h3><div><span class="badge ${c.verified?'green':c.connected?'warm':''}">${label}</span></div><p>${description}</p>${c.verified?`<small>Last verified: ${fmtDate(c.verified)} ET. Not a continuous connection guarantee.</small>`:`<small>Server configuration: <code>${esc(vars)}</code></small>`}<div class="connection-controls">${buttons}</div></article>`;}
function renderConnections(){const i=state.integrations;$('#mode-settings').innerHTML=`<div class="settings-bar"><div><h3>Office operating mode</h3><p>Practice is fictional. Shadow can read authorized sources.</p></div><select id="operating-mode" aria-label="Office operating mode"><option value="practice" ${state.settings.mode==='practice'?'selected':''}>Practice · sample data only</option><option value="shadow" ${state.settings.mode==='shadow'?'selected':''}>Shadow · drafts and read-only checks</option></select><div><label class="toggle"><input type="checkbox" id="use-ai" ${state.settings.useAI?'checked':''} ${!i.ai.configured?'disabled':''}> Model-assisted drafts</label><p>${state.usage.calls} / ${i.ai.limit} model requests today · New York</p></div></div>`;
 $('#connection-cards').innerHTML=
 connectionCard('ai','AI drafting','Optional model-assisted drafts. The selected task, source evidence and approved procedures are sent only after opt-in. Practice never calls a model.','spark','OPENAI_API_KEY + OPENAI_MODEL',`<span class="badge">${i.ai.model?esc(i.ai.model):'No model selected'}</span>`)+
 connectionCard('gmail','Gmail inbox','Read up to 10 recent inbox messages per manual import. Deduplicates message IDs. No sending permission; no automatic inbox polling.','mail','GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET',i.gmail.connected?'<button class="button secondary small" data-integration="gmail/import">Import recent messages</button><button class="text-button" data-integration="gmail/disconnect">Disconnect</button>':`<button class="button secondary small" data-integration="gmail/connect" ${!i.gmail.configured?'disabled':''}>Connect read-only inbox</button>`)+
 connectionCard('orders','Friendly rental records','Review an explicitly configured JSON order snapshot. No endpoint is guessed and no old chat information is treated as live inventory.','board','FPR_READONLY_URL',`<button class="button secondary small" data-integration="orders/read" ${!i.orders.configured?'disabled':''}>Read order snapshot</button>`)+
 connectionCard('website','Website checks','Inspect approved Friendly Party Rental pages for HTTP status and a small HTML checklist. Not a visual browser QA or a code-fixing agent.','globe','ENABLE_WEBSITE_CHECKS=true',`<button class="button secondary small" data-integration="website/read" ${!i.website.configured?'disabled':''}>Check homepage HTML</button>`)+
 connectionCard('github','Repository checks','Read the latest commit and check-run metadata for one configured repository. No file writes, code execution or deployments.','code','GITHUB_READ_REPO + GITHUB_READ_TOKEN',`<button class="button secondary small" data-integration="github/read" ${!i.github.configured?'disabled':''}>Read check results</button>`)+
 `<article class="panel connection-card"><span class="connection-icon">${icon('shield')}</span><h3>Supervised by design</h3><div><span class="badge warm">Business writes disabled</span></div><p>Pause the office, inspect sources and approve exact draft revisions. This release does not have an autonomous execution mode.</p><small>${state.stats.corrections} one-off draft correction(s) recorded. No invented time-saved or employee-replacement score.</small></article>`;
}
function openAgent(role,taskId){if(role==='owner'){setView('approvals');return;}if(!state)return;selectedRole=role;selectedTask=taskId||currentTask(role)?.id||null;tab='work';dirty=false;scene?.select(role);renderInspector();if(!$('#inspector').open)$('#inspector').showModal();}
function renderInspector(){const a=state.agents.find(a=>a.id===selectedRole);if(!a)return;const tasks=state.tasks.filter(t=>t.role===a.id);let task=state.tasks.find(t=>t.id===selectedTask);if(!task||task.role!==a.id){task=currentTask(a.id);selectedTask=task?.id||null;}
 const t=task;
 let content='';
 if(!t)content=empty('Available, not pretending to be busy.',`${a.name} has no assigned tasks. Give this employee an instruction, or start the practice shift from the office.`,'user');
 else if(tab==='evidence')content=`<p class="draft-note">These are recorded inputs and observations, not hidden reasoning. External content is untrusted data.</p>${(t.evidence.length?t.evidence:[{label:'Task input · not yet verified',detail:JSON.stringify(t.payload,null,2),observedAt:t.created}]).map(e=>`<article class="evidence-block"><h3>${esc(e.label)}</h3><small>${esc(e.observedAt||'Timestamp unavailable')}</small><pre>${esc(e.detail)}</pre></article>`).join('')}`;
 else if(tab==='history'){const events=state.events.filter(e=>e.task_id===t.id).reverse();content=`<p class="draft-note">Recorded actions, oldest first. This is a history, not a live desktop video. The office retains the full event log in SQLite; this panel shows the latest 120 global events.</p><br>${events.map(e=>`<div class="history-event"><h3>${esc(e.action)}</h3><p>${esc(e.detail)}</p><time>${fmtDate(e.time)} ET · ${esc(e.role)}</time></div>`).join('')}`;}
 else content=`<div class="task-title-block">${sourceBadge(t)} <span>${badge(t)}</span><h3>${esc(t.title)}</h3><p>Task ${t.id.slice(0,8)} · Revision ${t.revision} · Updated ${fmtDate(t.updated)} ET</p></div>
 ${t.reason?`<div class="alert ${t.status==='blocked'?'error':''}" style="margin-top:16px">${esc(t.reason)}</div>`:''}
 <details class="evidence-block" style="margin-top:17px"><summary>Original task input</summary><pre>${esc(t.payload.message||t.payload.instruction||JSON.stringify(t.payload,null,2))}</pre></details>
 ${t.result?`<div class="draft-label"><span>${t.result.startsWith('MODEL-ASSISTED')?'MODEL-ASSISTED · CHECK ALL FACTS':'TEMPLATE / DETERMINISTIC CHECK'}</span><span>${t.run_ms} ms recorded run</span></div>${t.status==='waiting_approval'?`<textarea id="draft-editor" class="draft-text" aria-label="Edit prepared draft" maxlength="20000">${esc(t.result)}</textarea><div class="draft-actions"><button class="button primary" data-task-action="approve">Approve draft</button><button class="button secondary" data-task-action="edit">Save my changes</button><button class="button secondary" data-task-action="reject">Request changes</button></div><p class="draft-note">Approval stores this exact draft. It does not send, book, charge, refund or publish anything.</p>`:`<div class="draft-text readonly">${esc(t.result)}</div>`}`:
 `<div class="empty-state" style="padding:30px 15px"><h2>${t.status==='running'?'Work is in progress.':t.status==='blocked'?'A source or decision is missing.':'No draft has been prepared yet.'}</h2><p>${t.status==='queued'?(state.settings.paused?'The office is paused. Resume it when you are ready.':t.source!=='practice'&&state.settings.mode==='practice'?'Real-data tasks stay queued until shadow mode is selected.':'This employee will process the queued task when available.'):'Inspect the evidence and history for the actual steps recorded.'}</p></div>`}
 ${['blocked','rejected'].includes(t.status)?'<div class="draft-actions"><button class="button secondary" data-task-action="retry">Retry with available sources</button></div>':''}
 ${['queued','blocked','waiting_approval','rejected'].includes(t.status)?`<div class="handoff-row"><select id="handoff-role" aria-label="Hand off to employee">${state.agents.filter(x=>x.id!==a.id).map(x=>`<option value="${x.id}">${x.name} · ${x.role}</option>`).join('')}</select><button class="button secondary small" data-task-action="handoff">Hand off task</button><button class="text-button" data-task-action="cancel">Cancel</button></div><p class="draft-note">Handoff keeps one task record and clears the previous draft. Missing source data will block the new employee rather than be invented.</p>`:''}`;
 $('#inspector-content').innerHTML=`<div class="inspector-head"><div class="head-top"><div class="person"><span class="avatar" style="background:${a.color}20;color:${a.color}">${a.initials}</span><div><h2>${a.name}'s desk</h2><p>${a.role} · ${agentStatus(a)}</p></div></div><button class="icon-button" id="close-inspector" aria-label="Close employee desk">×</button></div><div class="permission">${icon('shield')} ${esc(a.permissions)}</div><div class="inspector-actions"><small>AI role · ${state.settings.mode==='practice'?'practice checks':'supervised work'}</small><button class="text-button" data-agent-pause="${a.id}">${a.paused?'Resume employee':'Pause employee'}</button></div></div><div class="inspector-tabs" role="tablist">${[['work','Work screen'],['evidence','Evidence'],['history','Activity history']].map(([id,label])=>`<button role="tab" aria-selected="${tab===id}" data-inspector-tab="${id}" class="${tab===id?'active':''}">${label}</button>`).join('')}</div><div class="inspector-body">${tasks.length?`<div class="inspector-task-select"><select id="inspector-task-select" aria-label="Select task at this desk">${tasks.map(x=>`<option value="${x.id}" ${t?.id===x.id?'selected':''}>${statusLabel[x.status]} · ${esc(x.title)}</option>`).join('')}</select></div>`:''}${content}</div>`;
 $('#draft-editor')?.addEventListener('input',()=>dirty=true);
}
function closeInspector(){if(dirty&&!confirm('Discard unsaved draft edits?'))return;dirty=false;$('#inspector').close();scene?.select(null);}

hydrateIcons();
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:$('#password').value})});const data=await r.json();if(!r.ok)throw new Error(data.error);$('#password').value='';$('#login-error').textContent='';await refresh();}catch(error){$('#login-error').textContent=error.message;}finally{button.disabled=false;}});
$('#pause-all').addEventListener('click',safe(()=>state.settings.mode==='practice'&&!state.tasks.some(t=>t.source==='practice')?post('/api/practice'):post('/api/settings',{paused:!state.settings.paused})));
$('#start-practice').addEventListener('click',safe(async()=>{await post('/api/practice');toast('Practice shift started. Click any desk to inspect its sample work.');}));
$('#logout').addEventListener('click',safe(async()=>{await post('/api/logout');signedOut();}));
$('#help').addEventListener('click',()=>$('#help-dialog').showModal());
$$('.close-dialog').forEach(b=>b.addEventListener('click',()=>$('#help-dialog').close()));
$('#inspector').addEventListener('cancel',e=>{if(dirty&&!confirm('Discard unsaved draft edits?')){e.preventDefault();return;}dirty=false;scene?.select(null);});
$('#task-search').addEventListener('input',renderBoard);$('#task-filter').addEventListener('change',renderBoard);
$('#command-form').addEventListener('submit',safe(async e=>{e.preventDefault();const input=$('#command'),instruction=input.value.trim();if(!instruction)return;const result=await post('/api/tasks',{instruction,role:$('#command-role').value});input.value='';openAgent(result.task.role,result.task.id);toast('Task assigned. Missing information will be flagged, not guessed.');}));
$('#rule-form').addEventListener('submit',safe(async e=>{e.preventDefault();await post('/api/rules',{title:$('#rule-title').value,body:$('#rule-body').value});e.target.reset();toast('Procedure proposed. Approve it separately to make it a permanent rule.');}));
$('#import-form').addEventListener('submit',safe(async e=>{e.preventDefault();let snapshot;try{snapshot=JSON.parse($('#import-json').value);}catch{throw new Error('Snapshot must be valid JSON. See docs/INTEGRATIONS.md for the exact format.');}await post('/api/import/orders',{snapshot});e.target.reset();toast('Owner-imported snapshot queued for review. It is not marked as live-verified data.');}));
document.addEventListener('click',safe(async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.view){setView(b.dataset.view);return;}
 if(b.dataset.agent){openAgent(b.dataset.agent);return;}
 if(b.dataset.task){const t=state.tasks.find(t=>t.id===b.dataset.task);if(t)openAgent(t.role,t.id);return;}
 if(b.dataset.camera){scene?.setCamera(b.dataset.camera);if(!['zoom','out'].includes(b.dataset.camera))$$('[data-camera]').forEach(x=>x.classList.toggle('selected',x===b));return;}
 if(b.id==='close-inspector'){closeInspector();return;}
 if(b.dataset.inspectorTab){if(dirty&&!confirm('Discard unsaved draft edits?'))return;dirty=false;tab=b.dataset.inspectorTab;renderInspector();return;}
 if(b.dataset.agentPause){const a=state.agents.find(a=>a.id===b.dataset.agentPause);await post('/api/agents',{role:a.id,paused:!a.paused});return;}
 if(b.dataset.ruleApprove){await post(`/api/rules/${b.dataset.ruleApprove}/approve`);toast('Permanent procedure approved. Tool permissions did not change.');return;}
 if(b.dataset.taskAction){
   const t=state.tasks.find(t=>t.id===selectedTask),action=b.dataset.taskAction;if(!t)return;
   if(action==='approve'&&dirty)throw new Error('Save your draft changes before approving this version.');
   const data={revision:t.revision};if(action==='edit')data.result=$('#draft-editor').value;if(action==='handoff')data.role=$('#handoff-role').value;
   b.disabled=true;try{const result=await post(`/api/tasks/${t.id}/${action}`,data);dirty=false;if(action==='handoff'){selectedRole=result.task.role;scene?.select(selectedRole);}renderInspector();toast(action==='approve'?'Draft approved and recorded. Nothing was sent or published.':action==='edit'?'One-off draft correction saved. Company procedures unchanged.':action==='handoff'?'Same task handed off. Previous draft is no longer actionable.':'Task updated.');}finally{b.disabled=false;}return;
 }
 if(b.dataset.integration){const result=await post(`/api/integrations/${b.dataset.integration}`);if(result.url){const url=new URL(result.url);if(url.origin!=='https://accounts.google.com')throw new Error('Unexpected authorization destination.');location.assign(url.href);}else toast(result.scope?`${result.added} new task(s). ${result.scope}`:'Connection action recorded. Check the task board and status.');}
}));
document.addEventListener('change',safe(async e=>{
 if(e.target.id==='inspector-task-select'){if(dirty&&!confirm('Discard unsaved draft edits?')){e.target.value=selectedTask;return;}dirty=false;selectedTask=e.target.value;renderInspector();}
 if(e.target.id==='operating-mode'){try{await post('/api/settings',{mode:e.target.value});}catch(error){renderConnections();throw error;}}
 if(e.target.id==='use-ai'){const enabled=e.target.checked;if(enabled&&!confirm('Allow selected task content, source evidence and approved procedures to be sent to your configured OpenAI model for supervised drafts? This may incur API charges.')){e.target.checked=false;return;}try{await post('/api/settings',{useAI:enabled,consent:enabled});}catch(error){renderConnections();throw error;}}
}));
setInterval(()=>{if(!document.hidden)void refresh(true);},15000);
window.addEventListener('online',()=>void refresh(true));
window.addEventListener('offline',()=>{network(false);scheduleReconnect();});
window.addEventListener('focus',()=>{if(state&&(!connected||Date.now()-lastStateAt>30000))void refresh(true);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state&&(!connected||Date.now()-lastStateAt>30000))void refresh(true);});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
refresh();
