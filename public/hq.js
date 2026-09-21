/* Joined to the existing app module at build time; uses its real state and actions.
   The illustrated showroom is scenery, not a live camera or measured 3D scan. */
{
  const hq = { route: 'overview', record: null, room: 'overview' };
  const root = document.body;
  Object.assign(paths, {
    box:'m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10v9M3 8l9 5 9-5M7 5.8l9 5',
    calendar:'M5 5h14v16H5V5Zm3-3v6m8-6v6M5 10h14M8 13h2m4 0h2m-8 4h2m4 0h2',
    chart:'M4 3v18h17M8 16v-4m5 4V8m5 8V5',
    report:'M6 3h9l4 4v14H6V3Zm8 0v5h5M9 12h7m-7 4h7',
    settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Zm6 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0'
  });
  hydrateIcons();
  const mobileTeam = document.createElement('div');
  mobileTeam.id='mobile-team';mobileTeam.className='mobile-team';mobileTeam.setAttribute('aria-label','Employee desks');
  $('.owner-dock').before(mobileTeam);
  const priorRender=render, priorSetView=setView;
  function nav() {
    $$('#navigation .nav-item').forEach(b=>{const selected=b.dataset.hqRoute===hq.route;b.classList.toggle('active',selected);if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  }
  function closeAuxiliary(){['team-dialog','activity-dialog'].forEach(id=>{const d=$('#'+id);if(d.open)d.close();});}
  setView=function(next){
    if(!headings[next])return;
    hq.record=null;$('#records-view').hidden=true;
    hq.route=({office:'overview',tasks:'orders',approvals:'owner',handbook:'settings',connections:'settings'})[next];
    root.dataset.hqView=next;root.classList.remove('command-open');closeAuxiliary();
    priorSetView(next);nav();requestAnimationFrame(fitRoom);
  };
  function decorate() {
    if(!state)return;
    $('#start-practice').hidden=state.settings.mode!=='practice'||!state.tasks.some(t=>t.source==='practice');
    $('#start-practice').disabled=!connected;
    // Every status and task count comes from the existing authenticated state.
    const paused=state.settings.paused;
    $('.status-light').style.background=paused?'#d4ad70':'#91bea8';
    $$('#team-cards [data-agent]').forEach(b=>{
      const a=state.agents.find(a=>a.id===b.dataset.agent);if(!a)return;
      const label=agentStatus(a);b.setAttribute('aria-label',`Open ${a.name}'s desk — ${a.role}: ${label}`);
      const dot=b.querySelector('.team-status');if(dot)dot.style.background=label==='Working'?'#93cbb0':label==='Needs your help'?'#e4a295':'#d4b37c';
    });
    mobileTeam.innerHTML=$('#team-cards').innerHTML;
    $('#team-directory').innerHTML=state.agents.map(a=>`<button class="team-directory-card" data-agent="${a.id}"><span class="avatar" style="--agent-color:${a.color}">${a.initials}</span><span><strong>${a.name} <small>· ${a.role}</small></strong><p>${esc(a.description)}</p><small>${esc(agentStatus(a))}</small></span><b>→</b></button>`).join('')+`<button class="team-directory-card" data-agent="owner"><span class="avatar owner-avatar">BP</span><span><strong>Bryan · Owner</strong><p>${state.stats.review} drafts awaiting your review</p></span><b>→</b></button>`;
    if(hq.record)renderRecord(hq.record);
    nav();requestAnimationFrame(fitRoom);
  }
  render=function(){priorRender();decorate();};
  const records={
    orders:{eyebrow:'ORDERS & OPERATIONS',title:'Know what needs your attention.',label:'Rental records',description:'Your rental website has not been connected to this office as a verified order source. Readiness tasks below are office tasks, not a complete list of customer bookings.',icon:'board'},
    inventory:{eyebrow:'EQUIPMENT & INVENTORY',title:'Your stock needs a verified source.',label:'Inventory not connected',description:'The tables, chairs, linens and equipment in the showroom are part of the illustrated environment. They are not an inventory count. This release cannot establish current stock quantities or rental availability.',icon:'box'},
    schedule:{eyebrow:'DELIVERY & EVENT SCHEDULE',title:'A clear schedule starts with real records.',label:'Calendar not connected',description:'No live delivery calendar is connected to this office. The team can review supplied order snapshots, but it cannot invent event times, dispatch commitments or availability.',icon:'calendar'},
    customers:{eyebrow:'CUSTOMER CARE',title:'Thoughtful replies. Your final say.',label:'Customer messages',description:'Avery prepares replies from supplied tasks and explicitly imported messages. This is not a full customer directory, and messages cannot be sent from this release.',icon:'mail'},
    finances:{eyebrow:'BUSINESS FINANCES',title:'Financial actions stay with you.',label:'Financial records not connected',description:'This office has no bank feed, payment ledger or verified revenue source. It cannot charge cards, refund payments or cancel bookings. No financial totals are being estimated.',icon:'chart'},
    reports:{eyebrow:'RECORDED OFFICE WORK',title:'See exactly what happened.',label:'Office work report',description:'These results reflect saved office tasks and decisions. They are not a claim of emails sent, sales earned or human jobs replaced.',icon:'report'}
  };
  function showRecord(key){
    hq.record=key;hq.route=key;root.dataset.hqView='records';root.classList.remove('command-open');closeAuxiliary();
    $$('.view').forEach(e=>e.hidden=true);$('#records-view').hidden=false;
    renderRecord(key);nav();window.scrollTo({top:0,behavior:'instant'});
  }
  function renderRecord(key){
    const def=records[key];if(!def||!state)return;
    $('#page-eyebrow').textContent=def.eyebrow;$('#page-title').textContent=def.title;
    $('#page-subtitle').textContent=key==='reports'?'A record of observable work, with no invented performance claims.':'Connected records are kept separate from the showroom illustration.';
    let description=def.description,label=def.label;
    if(key==='orders'&&state.integrations.orders.configured){label=state.integrations.orders.verified?'Order source read previously':'Order source configured · not verified';description='An order snapshot source is configured. Review its connection status and timestamps before relying on it. The office work board is not a replacement for the rental booking system.';}
    if(key==='customers')label=state.integrations.gmail.connected?'Gmail authorized · manual imports only':'Inbox not connected';
    const work=state.tasks.filter(t=>key==='customers'?t.role==='email':key==='orders'||key==='schedule'?t.role==='office':true);
    const active=work.filter(t=>['queued','running'].includes(t.status)).length;
    const review=work.filter(t=>t.status==='waiting_approval').length;
    const completed=work.filter(t=>t.status==='approved').length;
    const includeWork=['orders','customers','schedule','reports'].includes(key);
    $('#records-content').innerHTML=`<div class="records-hero"><span class="badge warm">${esc(label)}</span><h2>${icon(def.icon)} ${key==='reports'?'A transparent view of your office':'No records are assumed'}</h2><p>${esc(description)}</p><div class="records-actions"><button class="button primary" data-view="${key==='reports'?'tasks':'connections'}">${key==='reports'?'Open full work board':'Connections & permissions'} ${icon('arrow')}</button>${includeWork?'<button class="button secondary" data-hq-board="'+(key==='customers'?'email':key==='reports'?'all':'office')+'">Review office tasks</button>':''}</div></div>${includeWork?`<div class="record-summary"><article><span class="eyebrow">OFFICE TASKS</span><strong>${active}</strong><p>Queued or running tasks</p></article><article><span class="eyebrow">OWNER REVIEW</span><strong>${review}</strong><p>Prepared drafts awaiting review</p></article><article><span class="eyebrow">REVIEWED</span><strong>${completed}</strong><p>Drafts approved · not sent</p></article></div>`:''}${key==='reports'?`<div class="record-events"><h2>Recent recorded activity</h2>${state.events.slice(0,30).map(e=>`<article class="event"><span class="event-symbol">${icon(e.role==='email'?'mail':e.role==='tech'?'code':'board')}</span><div><strong>${esc(e.action)}</strong><p>${esc(e.detail)}</p><time>${fmtDate(e.time)} ET</time></div></article>`).join('')}</div>`:includeWork?`<div class="record-events"><h2>Tasks at this desk</h2><p class="draft-note">Includes labeled practice work. This is not a customer booking total.</p>${work.slice(0,10).map(taskCard).join('')||'<p class="muted">No supplied tasks at this desk.</p>'}</div>`:''}`;
  }
  function clock(){const d=new Date();$('#office-date').textContent=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'America/New_York'}).format(d);$('#office-time').textContent=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}).format(d)+' ET';}
  clock();setInterval(clock,30000);
  function fitRoom(){
    const viewport=$('.stage-viewport'),stage=$('#room-stage');if(!viewport||!stage||root.dataset.sceneMode!=='showroom')return;
    const r=viewport.getBoundingClientRect();if(!r.width||!r.height)return;
    const s=Math.max(r.width/1354,r.height/741),w=1354*s,h=741*s;
    stage.style.width=w+'px';stage.style.height=h+'px';
    const targets={overview:[.5,.5,1],door:[.9,.33,1.85],concessions:[.71,.30,2.15],storage:[.34,.16,1.95]};
    const [x,y,z]=targets[hq.room]||targets.overview;
    stage.style.transform=`translate(-50%,-50%) translate(${-(x-.5)*w*z}px,${-(y-.5)*h*z}px) scale(${z})`;
    stage.dataset.view=hq.room;
    // A zoomed scenic crop does not need huge interactive staff labels over it.
    $('#team-cards').style.visibility=hq.room==='overview'?'visible':'hidden';
  }
  new ResizeObserver(fitRoom).observe($('.stage-viewport'));
  $('#room-art').addEventListener('error',()=>{const msg=$('.scene-hint');msg.textContent='Showroom artwork could not load. Team and work controls remain available.';msg.style.color='#f0c5b8';});
  function sceneMode(mode){
    if(!['showroom','spatial'].includes(mode))return;
    root.dataset.sceneMode=mode;$$('[data-scene-mode]').filter(b=>b.tagName==='BUTTON').forEach(b=>{b.classList.toggle('selected',b.dataset.sceneMode===mode);b.setAttribute('aria-pressed',String(b.dataset.sceneMode===mode));});
    if(mode==='spatial'){
      if(!scene&&state){scene=new OfficeScene($('#office-canvas'),$('#desk-labels'),openAgent,()=>{$('#scene-fallback').hidden=false;$('#desk-labels').hidden=true;});scene.update(state);}
      scene?.setCamera('overview');
    }else{fitRoom();}
  }
  $('#open-command').addEventListener('click',()=>{root.classList.toggle('command-open');if(root.classList.contains('command-open'))$('#command').focus();});
  $('#close-command').addEventListener('click',()=>{root.classList.remove('command-open');$('#open-command').focus();});
  $('#show-activity').addEventListener('click',()=>$('#activity-dialog').showModal());
  $('#mobile-menu').addEventListener('click',()=>$('#navigation button').focus());
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.close){$('#'+b.dataset.close)?.close();return;}
    if(b.dataset.agent){closeAuxiliary();root.classList.remove('command-open');return;}
    if(b.dataset.sceneMode){sceneMode(b.dataset.sceneMode);return;}
    if(b.dataset.room){hq.room=b.dataset.room;root.dataset.room=hq.room;sceneMode('showroom');$$('.room-view').forEach(x=>{const on=x===b;x.classList.toggle('selected',on);x.setAttribute('aria-pressed',String(on));});fitRoom();return;}
    if(b.dataset.hqBoard){setView('tasks');$('#task-filter').value=b.dataset.hqBoard;renderBoard();return;}
    if(!b.dataset.hqRoute||!state)return;
    const route=b.dataset.hqRoute;
    if(route==='overview')setView('office');
    else if(route==='team'){$('#team-dialog').showModal();}
    else if(route==='settings')setView('connections');
    else if(records[route])showRecord(route);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')root.classList.remove('command-open');});
  // No independent state store, autonomous work, credentials or additional business permissions.
  requestAnimationFrame(fitRoom);
  if(state)decorate();
}
