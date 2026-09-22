/* Friendly Party Rental — living office simulation. The room is the product. */
{
  const sim={caseId:null,detail:null,busy:false,loading:false,loadAgain:false,requestId:crypto.randomUUID(),receivedAt:0,selected:'team',autoEntered:false,recognition:null,generation:0};
  const root=document.createElement('section');root.id='command-view';root.className='view living-office';root.hidden=true;$('#main').append(root);
  headings.command=['FRIENDLY PARTY RENTAL','Virtual Office',''];

  const talk=document.createElement('button');talk.id='talk-to-team';talk.className='button compact primary';talk.textContent='Open virtual office';$('.heading-actions').prepend(talk);
  const preview=document.createElement('section');preview.id='command-preview';preview.hidden=true;$('.owner-dock').before(preview);

  const names={owner:'Bryan',team:'Everyone',office:'Morgan',email:'Avery',phone:'Riley',tech:'Alex',system:'Office'};
  const jobs={office:'Operations',email:'Customer Service',phone:'Phone',tech:'Website & Tech'};
  const colors={office:'#8aa58e',email:'#caa272',phone:'#78a9bc',tech:'#a59abc'};
  const snapshot=()=>state?.apprenticeship?.command;
  const short=(v,n=180)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n);
  const when=t=>t?new Date(t).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}):'';
  const avatar=role=>`<svg class="sim-avatar" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="92" rx="34" ry="5" fill="#000" opacity=".18"/><path d="M18 90v-9c0-19 14-28 32-28s32 9 32 28v9" fill="currentColor"/><path d="m41 56 9 12 10-12" fill="#e1b18d"/><rect x="43" y="47" width="15" height="15" rx="5" fill="#b98968"/><ellipse cx="50" cy="32" rx="19" ry="24" fill="${role==='tech'?'#c39a81':'#deb08d'}"/><path d="M30 29C25 6 67-7 71 29L59 14c-10 9-19 7-29 15" fill="${role==='email'?'#76503b':role==='phone'?'#423b3b':'#343238'}"/><circle cx="43" cy="33" r="1.4" fill="#332e2d"/><circle cx="58" cy="33" r="1.4" fill="#332e2d"/><path d="M45 43q5 3 10 0" fill="none" stroke="#875b4b" stroke-width="1.5"/></svg>`;

  root.innerHTML=`
    <div class="sim-top">
      <button id="cmd-business" class="sim-business">☰ <span>Business</span></button>
      <div class="sim-company"><strong>Friendly Party Rental</strong><small>Syracuse HQ</small></div>
      <div class="sim-presence"><span id="cmd-live" class="sim-live">● CONNECTING</span><button id="cmd-needs" class="sim-needs">Needs me <b id="cmd-needs-count">0</b></button><button id="cmd-settings" class="sim-more" aria-label="Office settings">•••</button></div>
      <button id="cmd-shift" class="sim-power" aria-pressed="true"><i></i><span>24/7 ON</span></button>
    </div>

    <section class="sim-room" aria-label="Friendly Party Rental virtual office">
      <div class="sim-room-shade"></div>
      <div class="sim-sign">FRIENDLY <span>PARTY RENTAL</span></div>

      <div id="cmd-people" class="sim-people"></div>

      <section id="sim-huddle" class="sim-huddle" hidden>
        <div class="sim-table"></div>
        <div class="sim-huddle-copy">
          <div class="sim-huddle-head"><span>TEAM TALKING</span><button id="cmd-board-all">History</button></div>
          <h2 id="cmd-board-title">Working something out together</h2>
          <div id="cmd-huddle" class="sim-huddle-faces"></div>
          <div id="cmd-board-stream" class="sim-talk-stream"></div>
        </div>
      </section>

      <div id="sim-quiet" class="sim-quiet"><span>Office is caught up</span><small>Everyone is watching for the next real thing to do.</small></div>

      <section id="cmd-conversation" class="sim-conversation" aria-label="Your conversation" hidden>
        <header><div><small>YOU + <span id="cmd-chat-person">TEAM</span></small><strong id="cmd-conversation-title">Conversation</strong></div><div><button id="cmd-new" title="New conversation">＋</button><button id="cmd-chat-close" aria-label="Close conversation">×</button></div></header>
        <div id="cmd-chat-log" class="sim-chat-log"></div>
        <footer><button id="cmd-open-case">Details</button><button id="cmd-read">Read reply</button></footer>
      </section>

      <form id="cmd-message-form" class="sim-owner-desk">
        <div class="sim-owner-top"><span class="sim-owner-avatar">BP</span><strong>Your desk</strong><span id="cmd-submit-state" role="status"></span></div>
        <div class="sim-recipient-row" aria-label="Who to talk to">
          <button type="button" data-sim-to="team" class="selected">Everyone</button>
          <button type="button" data-sim-to="office">Morgan</button>
          <button type="button" data-sim-to="email">Avery</button>
          <button type="button" data-sim-to="phone">Riley</button>
          <button type="button" data-sim-to="tech">Alex</button>
        </div>
        <select id="cmd-to" hidden><option value="team">Everyone</option><option value="office">Morgan</option><option value="email">Avery</option><option value="phone">Riley</option><option value="tech">Alex</option></select>
        <select id="cmd-evidence" hidden><option value="brief">Auto</option><option value="orders">Orders</option><option value="website">Website</option></select>
        <div class="sim-compose"><textarea id="cmd-message" rows="1" maxlength="2000" placeholder="Say something to the office…" required></textarea><button type="button" id="cmd-mic" aria-label="Dictate">🎙</button><button type="submit" id="cmd-send">Send</button></div>
        <p id="cmd-voice-state" role="status"></p>
      </form>
    </section>

    <dialog id="cmd-attention-dialog" class="app-dialog sim-dialog"><div class="sim-dialog-card"><header><div><small>NEEDS YOU</small><h2>Only decisions the team needs from you</h2></div><button data-cmd-close-needs>×</button></header><div id="cmd-attention"></div></div></dialog>
    <dialog id="cmd-activity-dialog" class="app-dialog sim-dialog"><div class="sim-dialog-card"><header><div><small>OFFICE HISTORY</small><h2>What the team has actually worked through</h2></div><button data-cmd-close-activity>×</button></header><div id="cmd-activity-full"></div></div></dialog>
    <dialog id="cmd-business-dialog" class="app-dialog sim-dialog"><div class="sim-dialog-card"><header><div><small>BACK OFFICE</small><h2>Business screens</h2></div><button data-cmd-close-business>×</button></header><div class="sim-business-grid">
      <button data-hq-route="orders"><b>Orders</b><span>Upcoming rentals</span></button><button data-hq-route="inventory"><b>Inventory</b><span>Equipment</span></button><button data-hq-route="schedule"><b>Schedule</b><span>Deliveries & events</span></button><button data-hq-route="customers"><b>Customers</b><span>Customer records</span></button><button data-hq-route="finances"><b>Finances</b><span>Financial records</span></button><button data-hq-route="reports"><b>Reports</b><span>Office history</span></button><button data-hq-route="team"><b>Team details</b><span>Advanced employee view</span></button><button data-hq-route="settings"><b>Settings</b><span>Connections & permissions</span></button>
    </div></div></dialog>
    <dialog id="cmd-settings-dialog" class="app-dialog sim-dialog"><div class="sim-dialog-card"><header><div><small>OFFICE SETTINGS</small><h2>Background controls</h2></div><button data-cmd-close-settings>×</button></header><div class="sim-settings-row"><button id="cmd-focus">Full screen</button><button id="cmd-signout">Sign out</button></div><details class="cmd-duty-drawer"><summary>24/7 work details</summary><div id="cmd-duty-list"></div></details></div></dialog>
  `;

  function activeCase(){
    const x=snapshot();if(!x)return null;
    return x.team.find(r=>r.status==='working'&&r.caseId)?.caseId||
      x.feed?.find(n=>n.caseStatus==='working'||n.caseStatus==='queued')?.caseId||
      x.feed?.find(n=>n.caseId)?.caseId||null;
  }
  function caseFeed(caseId){
    return (snapshot()?.feed||[]).filter(n=>!caseId||n.caseId===caseId);
  }
  function latestRoleNote(role,caseId){
    return caseFeed(caseId).find(n=>n.author===role)||null;
  }
  function humanStatus(r){
    if(r.status==='working')return r.activity||'Working';
    if(r.status==='review')return 'Waiting for Bryan';
    if(r.status==='blocked')return 'Blocked';
    if(r.status==='paused')return 'Paused';
    if(r.status==='waiting')return r.id==='phone'?'Watching phone':'Waiting';
    return 'Caught up';
  }
  function personCard(r,caseId){
    const note=latestRoleNote(r.id,caseId),working=r.status==='working',talking=note&&caseId;
    return `<button class="cmd-person sim-person sim-${r.id} ${working?'working':''} ${sim.selected===r.id?'selected':''}" data-cmd-person="${r.id}" style="--person:${colors[r.id]}">
      <span class="sim-speech ${talking?'show':''}"><b>${talking?esc(short(note.body,92)):esc(short(r.activity,92))}</b></span>
      <span class="sim-desk"><span class="sim-monitor ${working?'on':''}"><i></i><i></i><i></i></span><span class="sim-chair"></span></span>
      <span class="sim-person-avatar">${avatar(r.id)}<i class="cmd-status-light ${r.status}"></i></span>
      <span class="sim-person-name"><strong>${r.name}</strong><small>${jobs[r.id]}</small><em>${esc(humanStatus(r))}</em></span>
    </button>`;
  }
  function renderPeople(){
    const x=snapshot(),caseId=activeCase();if(!x)return;
    $('#cmd-people').innerHTML=x.team.map(r=>personCard(r,caseId)).join('');
  }
  function renderHuddle(){
    const x=snapshot();if(!x)return;
    let h=x.huddle;
    if(!h){
      const collab=(x.feed||[]).filter(n=>['plan','question','contribution','finding'].includes(n.kind));
      const caseId=collab[0]?.caseId,messages=caseId?collab.filter(n=>n.caseId===caseId):[];
      if(messages.length>=2){
        const participants=[...new Set(messages.flatMap(n=>[n.author,n.recipient]).filter(id=>colors[id]))];
        h={caseId,title:messages[0]?.title||'Team huddle',participants,messages};
      }
    }
    const messages=h?.messages||[],explicit=messages.length>=2;
    $('#sim-huddle').hidden=!explicit;$('#sim-quiet').hidden=explicit||x.team.some(r=>r.status==='working');
    if(!explicit)return;
    const participants=new Set(h.participants||[]);
    $('#cmd-huddle').innerHTML=x.team.filter(r=>participants.has(r.id)).map(r=>`<button data-cmd-person="${r.id}" style="--person:${colors[r.id]}">${avatar(r.id)}<span>${r.name}</span></button>`).join('');
    $('#cmd-board-title').textContent=short(h.title||x.team.find(r=>r.status==='working')?.activity||'Working something out together',90);
    $('#cmd-board-stream').innerHTML=messages.slice(0,6).reverse().map(n=>`<button data-ap-case="${n.caseId}"><b>${esc(names[n.author]||n.author)}</b><span>→ ${esc(names[n.recipient]||n.recipient)}</span><p>${esc(short(n.body,190))}</p></button>`).join('');
  }
  function renderAttention(){
    const items=snapshot()?.attention||[];$('#cmd-needs-count').textContent=String(items.length);$('#cmd-needs').classList.toggle('active',items.length>0);
    $('#cmd-attention').innerHTML=items.length?items.map(a=>`<button class="sim-attention" ${a.type==='case'?`data-ap-case="${a.id}"`:`data-task="${a.id}"`}><span><b>${esc(a.title)}</b><small>${esc(names[a.role]||a.role)}</small><p>${esc(short(a.detail,220))}</p></span><strong>Open →</strong></button>`).join(''):'<div class="sim-empty"><b>Nothing needs you.</b><span>The team is handling what it can.</span></div>';
  }
  function renderDuties(){
    const x=snapshot();if(!x)return;
    const title={queue:'Morgan · work queue',orders:'Morgan · orders',website:'Alex · website',phone:'Riley · phone',improvement:'Team · improvements'};
    $('#cmd-duty-list').innerHTML=x.duties.map(d=>`<article><b>${title[d.id]||d.id}</b><span>${esc(d.detail||'Watching.')}</span></article>`).join('');
  }
  function renderScreen(){
    const x=snapshot();if(!x)return;sim.receivedAt=Date.now();if(view!=='command')return;
    renderPeople();renderHuddle();renderAttention();renderDuties();
    const on=!state.settings.paused&&x.settings.enabled;$('#cmd-shift').classList.toggle('off',!on);$('#cmd-shift').setAttribute('aria-pressed',String(on));$('#cmd-shift span').textContent=on?'24/7 ON':'OFF';
    freshness();
  }
  function selectPerson(role,open=true){
    sim.selected=role;$('#cmd-to').value=role;$$('[data-sim-to]').forEach(b=>b.classList.toggle('selected',b.dataset.simTo===role));renderPeople();
    if(role!=='team'&&open){$('#cmd-chat-person').textContent=(names[role]||role).toUpperCase();showConversation(true);}
  }
  function showConversation(open=true){$('#cmd-conversation').hidden=!open;}
  async function get(path){const r=await fetch(path,{cache:'no-store'});if(r.status===401){signedOut();throw new Error('Sign in again.');}const b=await r.json();if(!r.ok)throw new Error(b.error||'Could not load the office.');return b;}
  function renderChat(){
    const log=$('#cmd-chat-log');if(!sim.detail){log.innerHTML='<div class="sim-chat-empty">Start talking. The office will answer here.</div>';$('#cmd-open-case').disabled=true;return;}
    const notes=sim.detail.notes.filter(n=>n.author==='owner'||n.recipient==='owner'||n.kind==='summary'||n.kind==='sent').slice(-8);
    const active=snapshot()?.team?.find(r=>r.status==='working'&&r.caseId===sim.detail.id);
    log.innerHTML=notes.map(n=>`<article class="${n.author==='owner'?'mine':'theirs'}"><b>${n.author==='owner'?'You':esc(names[n.author]||n.author)}</b><p>${esc(n.body)}</p><time>${when(n.created)}</time></article>`).join('')+
      (['queued','working'].includes(sim.detail.status)?`<div class="sim-thinking"><i></i><i></i><i></i><span>${esc(active?`${active.name} · ${active.activity||'thinking'}`:'Picking this up…')}</span></div>`:sim.detail.reason?`<div class="sim-chat-note">${esc(sim.detail.reason)}</div>`:'');
    log.scrollTop=log.scrollHeight;$('#cmd-open-case').disabled=false;
  }
  async function loadChat(){
    if(view!=='command'||!state)return;if(sim.loading){sim.loadAgain=true;return;}sim.loading=true;const g=sim.generation;
    try{
      if(sim.caseId){const detail=await get('/api/apprentice/cases/'+sim.caseId);if(sim.caseId!==detail.id||sim.generation!==g||view!=='command')return;sim.detail=detail;renderChat();}
      else{sim.detail=null;renderChat();}
    }finally{sim.loading=false;if(sim.loadAgain){sim.loadAgain=false;setTimeout(()=>void loadChat().catch(()=>{}),80);}}
  }
  function openOffice(role){
    setView('command');if(view!=='command')return;root.hidden=false;$('#records-view').hidden=true;document.body.classList.remove('menu-open');$('#mobile-menu').setAttribute('aria-expanded','false');
    if(role)selectPerson(role,true);renderScreen();void loadChat().catch(e=>toast(e.message));$('#cmd-message').focus({preventScroll:true});
  }

  talk.addEventListener('click',()=>openOffice());
  const priorRender=render;render=function(){priorRender();if(state&&!sim.autoEntered&&view==='office'&&state.settings.mode==='shadow'){sim.autoEntered=true;requestAnimationFrame(()=>openOffice());return;}renderScreen();if(view==='command')void loadChat().catch(()=>{});};
  const priorView=setView;setView=function(next){if(next!=='command'){stopVoice();document.body.classList.remove('command-focus');}priorView(next);if(next==='command'&&view==='command'){root.hidden=false;$('#records-view').hidden=true;}};
  const priorLogout=signedOut;signedOut=function(){stopVoice();window.speechSynthesis?.cancel();sim.generation++;sim.caseId=null;sim.detail=null;sim.selected='team';$('#cmd-message').value='';$('#cmd-chat-log').replaceChildren();root.hidden=true;priorLogout();};

  document.addEventListener('click',safe(async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.hqRoute&&$('#cmd-business-dialog')?.open)$('#cmd-business-dialog').close();
    if(b.dataset.hqRoute==='overview'&&state?.settings?.mode==='shadow'){openOffice();return;}
    if(b.dataset.cmdPerson){selectPerson(b.dataset.cmdPerson,true);return;}
    if(b.dataset.simTo){selectPerson(b.dataset.simTo,b.dataset.simTo!=='team');return;}
  }));

  $('#cmd-business').addEventListener('click',()=>$('#cmd-business-dialog').showModal());$('[data-cmd-close-business]').addEventListener('click',()=>$('#cmd-business-dialog').close());
  $('#cmd-needs').addEventListener('click',()=>$('#cmd-attention-dialog').showModal());$('[data-cmd-close-needs]').addEventListener('click',()=>$('#cmd-attention-dialog').close());
  $('#cmd-board-all').addEventListener('click',()=>{const rows=(snapshot()?.feed||[]).slice(0,40).map(n=>`<button class="sim-history-row" data-ap-case="${n.caseId}"><b>${esc(names[n.author]||n.author)} → ${esc(names[n.recipient]||n.recipient)}</b><p>${esc(short(n.body,260))}</p><small>${when(n.at)}</small></button>`).join('');$('#cmd-activity-full').innerHTML=rows||'<div class="sim-empty">No recorded team conversation yet.</div>';$('#cmd-activity-dialog').showModal();});$('[data-cmd-close-activity]').addEventListener('click',()=>$('#cmd-activity-dialog').close());
  $('#cmd-settings').addEventListener('click',()=>$('#cmd-settings-dialog').showModal());$('[data-cmd-close-settings]').addEventListener('click',()=>$('#cmd-settings-dialog').close());
  $('#cmd-chat-close').addEventListener('click',()=>showConversation(false));
  $('#cmd-new').addEventListener('click',()=>{sim.caseId=null;sim.detail=null;sim.requestId=crypto.randomUUID();renderChat();$('#cmd-message').focus();});
  $('#cmd-shift').addEventListener('click',safe(async()=>{const x=snapshot(),enable=state.settings.paused||!x.settings.enabled;await post('/api/apprentice/command/settings',{enabled:enable,...(enable?{resume:true}:{})});toast(enable?'Office is running 24/7.':'Office paused.');}));
  $('#cmd-focus').addEventListener('click',()=>{document.body.classList.toggle('command-focus');$('#cmd-settings-dialog').close();});
  $('#cmd-signout').addEventListener('click',safe(async()=>{await post('/api/logout');$('#cmd-settings-dialog').close();signedOut();}));
  $('#cmd-open-case').addEventListener('click',()=>{if(sim.caseId){const b=document.createElement('button');b.dataset.apCase=sim.caseId;b.hidden=true;root.append(b);b.click();b.remove();}});
  $('#cmd-read').addEventListener('click',()=>{if(!('speechSynthesis'in window)||!sim.detail)return;const n=[...sim.detail.notes].reverse().find(n=>n.recipient==='owner'||n.kind==='summary');if(!n)return;window.speechSynthesis.cancel();window.speechSynthesis.speak(new SpeechSynthesisUtterance(n.body));});

  $('#cmd-message-form').addEventListener('submit',safe(async e=>{
    e.preventDefault();if(sim.busy)return;const message=$('#cmd-message').value.trim();if(!message)return;stopVoice();sim.busy=true;freshness();
    const role=$('#cmd-to').value,who=names[role]||'The team';$('#cmd-submit-state').textContent=`${who} is listening…`;
    try{
      const r=await post('/api/apprentice/command/message',{message,recipient:role,action:'brief',requestId:sim.requestId,...(sim.caseId?{caseId:sim.caseId,revision:sim.detail?.revision}:{})});
      sim.caseId=r.caseId;sim.detail=null;sim.requestId=crypto.randomUUID();$('#cmd-message').value='';if(r.lead)selectPerson(r.lead,false);
      const person=names[r.lead]||'The team',verb=r.action==='email'?'checking the inbox':r.action==='phone'?'checking phone activity':r.action==='website'?'checking the website':r.action==='orders'?'checking live orders':'thinking';
      $('#cmd-submit-state').textContent=r.paused?'Saved while the office is paused.':`${person} is ${verb}…`;showConversation(true);$('#cmd-chat-person').textContent=(names[r.lead]||'TEAM').toUpperCase();await loadChat();
    }catch(err){$('#cmd-submit-state').textContent=err.message;throw err;}finally{sim.busy=false;freshness();}
  }));

  function freshness(){
    const el=$('#cmd-live');if(!el)return;const fresh=connected&&Date.now()-sim.receivedAt<45000;el.textContent=fresh?'● LIVE':'● RECONNECTING';el.classList.toggle('stale',!fresh);$('#cmd-send').disabled=sim.busy||!state;
  }
  window.addEventListener('office-network',freshness);

  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;let voiceTimer;
  function stopVoice(){clearTimeout(voiceTimer);if(sim.recognition){try{sim.recognition.stop();}catch{}sim.recognition=null;}if($('#cmd-mic'))$('#cmd-mic').textContent='🎙';}
  if(!Recognition)$('#cmd-mic').disabled=true;
  $('#cmd-mic').addEventListener('click',()=>{if(sim.recognition){stopVoice();return;}if(!Recognition)return;if(!confirm('Dictate your message? Review it before sending.'))return;const r=new Recognition();sim.recognition=r;r.lang='en-US';r.continuous=false;r.interimResults=true;r.onresult=e=>{let s='';for(let i=e.resultIndex;i<e.results.length;i++)s+=e.results[i][0].transcript;$('#cmd-message').value=s;};r.onend=stopVoice;r.onerror=()=>{$('#cmd-voice-state').textContent='Dictation stopped.';stopVoice();};r.start();$('#cmd-mic').textContent='■';voiceTimer=setTimeout(stopVoice,45000);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){document.body.classList.remove('command-focus');stopVoice();}});
}
