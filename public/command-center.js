/* Friendly virtual office: the room is the interface; detailed machinery stays behind drawers. */
{
  const cmd={caseId:null,detail:null,threads:[],busy:false,requestId:crypto.randomUUID(),loading:false,recognition:null,receivedAt:0,generation:0,loadAgain:false};
  const root=document.createElement('section');root.id='command-view';root.className='view command-center';root.hidden=true;$('#main').append(root);
  headings.command=['FRIENDLY PARTY RENTAL','Your virtual office','Watch the team work, talk to anyone, step in only when they need you.'];

  const talk=document.createElement('button');talk.id='talk-to-team';talk.className='button compact primary';talk.textContent='Open virtual office';$('.heading-actions').prepend(talk);
  const preview=document.createElement('section');preview.id='command-preview';preview.className='command-preview';preview.setAttribute('aria-label','Virtual office status');$('.owner-dock').before(preview);

  const names={owner:'Bryan',system:'Office',team:'Everyone',office:'Morgan',email:'Avery',tech:'Alex',phone:'Riley'};
  const roleLabel={office:'Operations',email:'Customer email',tech:'Website & systems',phone:'Phone'};
  const color={office:'#789985',email:'#c39a6d',tech:'#9489ad',phone:'#6f9ead'};
  const snapshot=()=>state?.apprenticeship?.command;
  const when=t=>t?new Date(t).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET':'—';
  const short=(v,n=220)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n);
  const avatar=role=>`<svg class="cmd-avatar" viewBox="0 0 100 96" aria-hidden="true"><ellipse cx="50" cy="89" rx="39" ry="5" fill="#000" opacity=".16"/><path d="M18 87v-8c0-20 14-28 32-28s32 8 32 28v8" fill="currentColor"/><path d="m41 54 9 13 10-13" fill="#e0b28d"/><rect x="43" y="45" width="15" height="16" rx="5" fill="#b98968"/><ellipse cx="50" cy="31" rx="19" ry="24" fill="${role==='tech'?'#bd9279':'#dfb28f'}"/><path d="M30 29C24 4 68-8 71 29L59 14c-10 9-19 6-29 15" fill="${role==='email'?'#76513a':'#3a3435'}"/><circle cx="43" cy="32" r="1.3" fill="#3c3431"/><circle cx="58" cy="32" r="1.3" fill="#3c3431"/><path d="M45 42q5 3 10 0" fill="none" stroke="#8f5d4b" stroke-width="1.5"/></svg>`;

  root.innerHTML=`
    <div class="vo-topbar">
      <button class="vo-back" data-view="office">← Showroom</button>
      <div class="vo-brand"><span id="cmd-live" class="cmd-live">CONNECTING</span><strong>Friendly Office</strong><small id="cmd-mode"></small></div>
      <div class="vo-top-actions">
        <button id="cmd-shift" class="vo-power" aria-pressed="true"><i></i><span>Office ON</span></button>
        <button id="cmd-needs" class="vo-needs">Needs me <b id="cmd-needs-count">0</b></button>
        <button id="cmd-settings" class="vo-icon" aria-label="Office settings">•••</button>
      </div>
    </div>

    <section class="vo-room">
      <div class="vo-vignette"></div>

      <section class="vo-wall">
        <header>
          <div><span class="eyebrow">TEAM BOARD</span><h2 id="cmd-board-title">Everyone is caught up.</h2></div>
          <div><span id="cmd-wall-time"></span><button id="cmd-board-all" class="vo-small-link">History</button></div>
        </header>
        <div id="cmd-huddle" class="vo-huddle"></div>
        <div id="cmd-board-stream" class="cmd-board-stream"></div>
        <footer><span id="cmd-totals"></span><span id="cmd-wall-state">Waiting for the next real task</span></footer>
      </section>

      <div id="cmd-people" class="vo-people"></div>

      <form id="cmd-message-form" class="vo-owner-dock">
        <div class="vo-owner-row">
          <span class="vo-owner-badge">BP</span>
          <label class="vo-recipient"><span>Talk to</span><select id="cmd-to"><option value="team">Everyone</option><option value="office">Morgan</option><option value="email">Avery</option><option value="tech">Alex</option><option value="phone">Riley</option></select></label>
          <label class="vo-context"><span>Context</span><select id="cmd-evidence"><option value="brief">What they know</option><option value="orders">Live orders</option><option value="website">Website</option></select></label>
          <button type="button" id="cmd-new" class="vo-icon" title="New conversation" aria-label="New conversation">＋</button>
        </div>
        <div class="vo-compose">
          <textarea id="cmd-message" rows="1" maxlength="2000" placeholder="Tell the team what you need…" required></textarea>
          <button type="button" id="cmd-mic" class="vo-mic" aria-label="Dictate">🎙</button>
          <button type="submit" id="cmd-send" class="vo-send">Send</button>
        </div>
        <div class="vo-quick"><button type="button" data-cmd-quick="brief">What needs me?</button><button type="button" data-cmd-quick="orders">Check tomorrow’s orders</button><button type="button" data-cmd-quick="website">Check the website</button></div>
        <p id="cmd-submit-state" role="status"></p><p id="cmd-voice-state" role="status"></p>
      </form>

      <aside id="cmd-conversation" class="vo-conversation" aria-label="Owner conversation">
        <header><div><span class="eyebrow">YOUR CONVERSATION</span><h2 id="cmd-conversation-title">Talk to the office</h2></div><button id="cmd-chat-close" class="vo-icon" aria-label="Close conversation">×</button></header>
        <label class="cmd-thread-label">Previous conversations<select id="cmd-threads"><option value="">New conversation</option></select></label>
        <div id="cmd-chat-log" class="cmd-chat-log"></div>
        <footer><button id="cmd-open-case" class="button secondary" disabled>Open details & evidence</button><button id="cmd-read" class="text-button">Read latest answer aloud</button></footer>
      </aside>
    </section>

    <dialog id="cmd-attention-dialog" class="app-dialog vo-dialog"><div class="vo-dialog-card">
      <header><div><span class="eyebrow">NEEDS BRYAN</span><h2>Only things that need your decision</h2></div><button class="vo-icon" data-cmd-close-needs aria-label="Close">×</button></header>
      <section class="cmd-attention-panel" id="cmd-attention-panel"><div id="cmd-attention" class="cmd-attention"></div></section>
    </div></dialog>

    <dialog id="cmd-activity-dialog" class="app-dialog vo-dialog"><div class="vo-dialog-card">
      <header><div><span class="eyebrow">TEAM HISTORY</span><h2>What the office has been working through</h2></div><button class="vo-icon" data-cmd-close-activity aria-label="Close">×</button></header>
      <div id="cmd-activity-full"></div>
    </div></dialog>

    <dialog id="cmd-settings-dialog" class="app-dialog vo-dialog"><div class="vo-dialog-card">
      <header><div><span class="eyebrow">OFFICE SETTINGS</span><h2>Things you normally never need</h2></div><button class="vo-icon" data-cmd-close-settings aria-label="Close">×</button></header>
      <div class="vo-settings-actions"><button class="button secondary" id="cmd-focus">Full-screen office</button></div>
      <details class="cmd-duty-drawer">
        <summary><span><b>24/7 standing work</b><small>What each employee checks in the background</small></span><span>Show</span></summary>
        <div id="cmd-duty-list"></div>
        <p>If there is nothing real to do, the employee stays caught up and keeps watching. The system does not invent busy-work.</p>
      </details>
    </div></dialog>
  `;

  function latestMessageFor(role,caseId){
    const feed=snapshot()?.feed||[];
    return feed.find(n=>(!caseId||n.caseId===caseId)&&n.author===role)||feed.find(n=>(!caseId||n.caseId===caseId)&&n.recipient===role)||null;
  }

  function personCard(r,currentCase){
    const note=latestMessageFor(r.id,currentCase);
    let bubble='';
    if(note){
      const who=note.author===r.id?`${r.name} → ${names[note.recipient]||note.recipient}`:`${names[note.author]||note.author} → ${r.name}`;
      bubble=`<span class="vo-speech"><b>${esc(who)}</b><span>${esc(short(note.body,105))}</span></span>`;
    }
    return `<button class="cmd-person vo-person vo-${r.id} ${r.status==='working'?'is-working':''}" data-cmd-person="${r.id}" style="--person:${color[r.id]}" aria-label="Talk to ${r.name}">
      ${bubble}<span class="vo-desk-screen"><i></i><i></i><i></i></span>
      <span class="cmd-person-avatar">${avatar(r.id)}<i class="cmd-status-light ${r.status}"></i></span>
      <span class="cmd-person-copy"><strong>${r.name}</strong><small>${roleLabel[r.id]}</small><p>${esc(short(r.activity,105))}</p></span>
    </button>`;
  }

  function activeCase(){
    const x=snapshot();if(!x)return null;
    return x.team.find(r=>r.status==='working'&&r.caseId)?.caseId || x.feed?.find(n=>n.caseStatus==='working'||n.caseStatus==='queued')?.caseId || x.feed?.[0]?.caseId || null;
  }

  function boardRows(all=false){
    const x=snapshot(),caseId=activeCase(),feed=x?.feed||[];
    let rows=all?feed:(caseId?feed.filter(n=>n.caseId===caseId):feed);
    rows=rows.slice(0,all?36:6).slice().reverse();
    if(!rows.length)return '<div class="cmd-board-empty"><strong>No active discussion.</strong><span>Everyone is caught up and watching for the next real task.</span></div>';
    return rows.map(n=>`<button class="cmd-board-line" data-ap-case="${n.caseId}">
      <span class="cmd-board-avatar" style="--person:${color[n.author]||'#b9a47b'}">${esc((names[n.author]||n.author).slice(0,2).toUpperCase())}</span>
      <span class="cmd-board-copy"><span><b>${esc(names[n.author]||n.author)}</b><i>→</i><b>${esc(names[n.recipient]||n.recipient)}</b><time>${when(n.at)}</time></span><p>${esc(short(n.body,250))}${n.truncated?'…':''}</p></span>
    </button>`).join('');
  }

  function renderHuddle(){
    const x=snapshot();if(!x)return;
    const caseId=activeCase(),related=caseId?(x.feed||[]).filter(n=>n.caseId===caseId):[],participants=new Set();
    for(const n of related){if(color[n.author])participants.add(n.author);if(color[n.recipient])participants.add(n.recipient);}
    for(const r of x.team)if(r.status==='working')participants.add(r.id);
    $('#cmd-huddle').innerHTML=x.team.map(r=>`<button data-cmd-person="${r.id}" class="${participants.has(r.id)||r.status==='working'?'active':''} ${r.status==='working'?'speaking':''}" style="--person:${color[r.id]}"><span>${avatar(r.id)}</span><b>${r.name}</b></button>`).join('');
  }

  function renderAttention(){
    const items=snapshot()?.attention||[];
    $('#cmd-needs-count').textContent=String(items.length);
    $('#cmd-needs').classList.toggle('has-items',items.length>0);
    $('#cmd-attention').innerHTML=items.length?items.map(a=>`<button class="cmd-attention-item" ${a.type==='case'?`data-ap-case="${a.id}"`:`data-task="${a.id}"`}><span class="cmd-dot ${a.status}"></span><span><b>${esc(a.title)}</b><small>${esc(names[a.role]||a.role)}</small><p>${esc(short(a.detail,220))}</p></span><strong>Open →</strong></button>`).join(''):'<div class="cmd-attention-empty"><b>Nothing needs you right now.</b><span>The team is working or caught up.</span></div>';
  }

  function renderDuties(){
    const x=snapshot();if(!x)return;
    const title={queue:'Morgan · work queue',orders:'Morgan · orders',website:'Alex · website',phone:'Riley · phone',improvement:'Team · improvements'};
    $('#cmd-duty-list').innerHTML=x.duties.map(d=>`<article><span class="cmd-dot ${d.status==='blocked'?'blocked':d.status==='waiting'?'waiting':'available'}"></span><div><b>${title[d.id]||d.id}</b><p>${esc(d.detail||'Waiting for first check.')}</p><small>Last ${when(d.lastAt)} · Next ${when(d.nextAt)}</small></div></article>`).join('')+
      `<article><span class="cmd-dot ${state.apprenticeship.mail.enabled?'available':'waiting'}"></span><div><b>Avery · inbox</b><p>${state.apprenticeship.mail.enabled?'Watching customer-service email for new work.':'Mailbox observation is off.'}</p><button data-ap-route="observations">Open email settings</button></div></article>`;
  }

  function renderPreview(){
    const x=snapshot();if(!x)return;
    const needs=(x.attention||[]).length;
    preview.innerHTML=`<button class="vo-preview-open" data-cmd-open="true"><span><b>${state.settings.paused?'Office paused':'Office is working'}</b><small>${x.team.map(r=>`${r.name}: ${r.status==='working'?'working':r.status==='review'?'needs review':'caught up'}`).join(' · ')}</small></span><strong>Open office →</strong></button>${needs?`<button class="vo-preview-needs" data-cmd-needs="true">${needs} need${needs===1?'s':''} you</button>`:''}`;
  }

  function renderScreen(){
    const x=snapshot();if(!x)return;cmd.receivedAt=Date.now();renderPreview();if(view!=='command')return;
    const caseId=activeCase(),feed=x.feed||[],topic=(caseId?feed.find(n=>n.caseId===caseId)?.title:null)||x.team.find(r=>r.status==='working')?.activity||'Everyone is caught up.';
    $('#cmd-board-title').textContent=short(topic,100);
    $('#cmd-people').innerHTML=x.team.map(r=>personCard(r,caseId)).join('');
    renderHuddle();$('#cmd-board-stream').innerHTML=boardRows(false);
    $('#cmd-wall-time').textContent=when(x.serverTime);
    $('#cmd-wall-state').textContent=caseId?'Team conversation · click any line for details':'Watching for new work';
    const c=x.counts.cases,t=x.counts.tasks;
    $('#cmd-totals').textContent=`${(c.queued||0)+(t.queued||0)} queued · ${(c.review||0)+(t.waiting_approval||0)} need review`;
    $('#cmd-mode').textContent=state.settings.mode==='practice'?'Training mode':'Live business data';
    const on=!state.settings.paused&&x.settings.enabled;$('#cmd-shift').classList.toggle('off',!on);$('#cmd-shift').setAttribute('aria-pressed',String(on));$('#cmd-shift span').textContent=on?'Office ON':'Office OFF';
    renderAttention();renderDuties();freshness();
  }

  async function get(path){const r=await fetch(path,{cache:'no-store'});if(r.status===401){signedOut();throw new Error('Sign in again.');}const b=await r.json();if(!r.ok)throw new Error(b.error||'Could not load the office.');return b;}

  function showConversation(open=true){$('#cmd-conversation').classList.toggle('open',open);}
  function renderChat(){
    const log=$('#cmd-chat-log');
    if(!cmd.detail){log.innerHTML='<div class="cmd-chat-empty"><h3>No conversation selected.</h3><p>Click an employee or send an instruction.</p></div>';$('#cmd-open-case').disabled=true;return;}
    const notes=cmd.detail.notes.filter(n=>n.author==='owner'||n.recipient==='owner'||n.kind==='summary'||n.kind==='sent');
    $('#cmd-conversation-title').textContent=cmd.detail.title||'Talk to the office';
    log.innerHTML=notes.map(n=>`<article class="cmd-bubble ${n.author==='owner'?'owner':'employee'}"><header><b>${esc(names[n.author]||n.author)}${n.author!=='owner'?' → Bryan':''}</b><time>${when(n.created)}</time></header><p>${esc(n.body)}</p></article>`).join('')+
      (['queued','working'].includes(cmd.detail.status)?`<div class="cmd-pending">${state.settings.paused?'Office is off. Turn it on to start this assignment.':cmd.detail.status==='working'?'They are working on it now. Watch the wall board.':'Waiting for an employee to pick it up.'}</div>`:cmd.detail.reason?`<div class="cmd-pending">${esc(cmd.detail.reason)}</div>`:'');
    log.scrollTop=log.scrollHeight;$('#cmd-open-case').disabled=false;
  }

  async function loadChat(){
    if(view!=='command'||!state)return;if(cmd.loading){cmd.loadAgain=true;return;}cmd.loading=true;const generation=cmd.generation;
    try{
      const id=cmd.caseId,data=await get('/api/apprentice/command/threads');if(!state||cmd.generation!==generation||view!=='command')return;
      cmd.threads=data.threads;$('#cmd-threads').innerHTML='<option value="">New conversation</option>'+cmd.threads.map(t=>`<option value="${t.id}">${esc(t.title.slice(0,70))}</option>`).join('');$('#cmd-threads').value=cmd.caseId||'';
      if(id){const detail=await get('/api/apprentice/cases/'+id);if(cmd.caseId!==id||!state||cmd.generation!==generation||view!=='command')return;cmd.detail=detail;renderChat();}
      else{cmd.detail=null;renderChat();}
    }finally{cmd.loading=false;if(cmd.loadAgain){cmd.loadAgain=false;setTimeout(()=>void loadChat().catch(()=>{}),80);}}
  }

  function openTeam(role){
    setView('command');if(view!=='command')return;root.hidden=false;$('#records-view').hidden=true;document.body.classList.remove('menu-open');$('#mobile-menu').setAttribute('aria-expanded','false');
    if(role){$('#cmd-to').value=role;showConversation(true);}renderScreen();void loadChat().catch(e=>toast(e.message));$('#cmd-message').focus({preventScroll:true});
  }

  talk.addEventListener('click',()=>openTeam());
  const priorRender=render;render=function(){priorRender();renderScreen();if(view==='command')void loadChat().catch(()=>{});};
  const priorView=setView;setView=function(next){if(next!=='command'){stopVoice();document.body.classList.remove('command-focus');}priorView(next);if(next==='command'&&view==='command'){root.hidden=false;$('#records-view').hidden=true;}};
  const priorLogout=signedOut;signedOut=function(){stopVoice();window.speechSynthesis?.cancel();cmd.generation++;cmd.caseId=null;cmd.detail=null;cmd.threads=[];$('#cmd-message').value='';$('#cmd-chat-log').replaceChildren();preview.replaceChildren();root.hidden=true;priorLogout();};

  document.addEventListener('click',safe(async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.cmdOpen){openTeam();return;}
    if(b.dataset.cmdNeeds){openTeam();$('#cmd-attention-dialog').showModal();return;}
    if(b.dataset.cmdPerson){openTeam(b.dataset.cmdPerson);return;}
    if(b.dataset.cmdQuick){
      const k=b.dataset.cmdQuick;$('#cmd-evidence').value=k;$('#cmd-message').value=({brief:'Team, what needs my attention right now? Work it out together and give me only what actually needs me.',orders:'Morgan, check tomorrow’s live orders. Pull in Avery, Riley or Alex only where it helps. Tell me only about real risks, missing details or decisions.',website:'Alex, check the live Friendly Party Rental site and work with the team on any real customer or operations impact. Do not publish changes.'})[k];$('#cmd-to').value=k==='website'?'tech':k==='orders'?'office':'team';$('#cmd-message').focus();
    }
  }));

  $('#cmd-needs').addEventListener('click',()=>$('#cmd-attention-dialog').showModal());
  $('[data-cmd-close-needs]').addEventListener('click',()=>$('#cmd-attention-dialog').close());
  $('#cmd-board-all').addEventListener('click',()=>{$('#cmd-activity-full').innerHTML=`<div class="cmd-board-stream full">${boardRows(true)}</div>`;$('#cmd-activity-dialog').showModal();});
  $('[data-cmd-close-activity]').addEventListener('click',()=>$('#cmd-activity-dialog').close());
  $('#cmd-settings').addEventListener('click',()=>$('#cmd-settings-dialog').showModal());
  $('[data-cmd-close-settings]').addEventListener('click',()=>$('#cmd-settings-dialog').close());
  $('#cmd-chat-close').addEventListener('click',()=>showConversation(false));
  $('#cmd-threads').addEventListener('change',safe(async e=>{cmd.caseId=e.target.value||null;cmd.detail=null;cmd.requestId=crypto.randomUUID();await loadChat();showConversation(!!cmd.caseId);}));
  $('#cmd-new').addEventListener('click',()=>{cmd.caseId=null;cmd.detail=null;cmd.requestId=crypto.randomUUID();$('#cmd-threads').value='';renderChat();});
  $('#cmd-shift').addEventListener('click',safe(async()=>{const x=snapshot(),enable=state.settings.paused||!x.settings.enabled;await post('/api/apprentice/command/settings',{enabled:enable,...(enable?{resume:true}:{})});toast(enable?'Office is ON. The team will keep watching for useful work.':'Office is OFF. Everyone is paused.');}));
  $('#cmd-focus').addEventListener('click',()=>{const on=document.body.classList.toggle('command-focus');$('#cmd-settings-dialog').close();toast(on?'Full-screen office on. Press Escape to exit.':'Full-screen office off.');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){document.body.classList.remove('command-focus');stopVoice();}});
  $('#cmd-open-case').addEventListener('click',()=>{if(cmd.caseId){const b=document.createElement('button');b.dataset.apCase=cmd.caseId;b.hidden=true;root.append(b);b.click();b.remove();}});

  $('#cmd-message-form').addEventListener('submit',safe(async e=>{
    e.preventDefault();if(cmd.busy)return;const text=$('#cmd-message').value.trim();if(!text)return;stopVoice();cmd.busy=true;freshness();$('#cmd-submit-state').textContent='Giving this to the team…';
    try{
      const r=await post('/api/apprentice/command/message',{message:text,recipient:$('#cmd-to').value,action:$('#cmd-evidence').value,requestId:cmd.requestId,...(cmd.caseId?{caseId:cmd.caseId,revision:cmd.detail?.revision}:{})});
      cmd.caseId=r.caseId;cmd.detail=null;cmd.requestId=crypto.randomUUID();$('#cmd-message').value='';$('#cmd-submit-state').textContent=r.paused?'Saved. Turn the office on to start.':'They have it. Watch the wall board.';showConversation(true);await loadChat();
    }catch(err){$('#cmd-submit-state').textContent=err.message;throw err;}finally{cmd.busy=false;freshness();}
  }));

  function freshness(){
    const el=$('#cmd-live');if(!el)return;
    const fresh=connected&&Date.now()-cmd.receivedAt<45000;
    el.textContent=fresh?'● LIVE':'● RECONNECTING';
    el.classList.toggle('stale',!fresh);
    const send=$('#cmd-send');send.disabled=cmd.busy||!state;
    const status=$('#cmd-submit-state');
    if(!fresh&&!cmd.busy&&!status.textContent)status.textContent='Reconnecting automatically — you can still type and press Send.';
    if(fresh&&status.textContent.startsWith('Reconnecting automatically'))status.textContent='';
  }

  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let voiceTimer;
  function stopVoice(){clearTimeout(voiceTimer);if(cmd.recognition){try{cmd.recognition.stop();}catch{}cmd.recognition=null;}if($('#cmd-mic'))$('#cmd-mic').textContent='🎙';}
  if(!Recognition){$('#cmd-mic').disabled=true;$('#cmd-voice-state').textContent='';}
  $('#cmd-mic').addEventListener('click',()=>{if(cmd.recognition){stopVoice();return;}if(!Recognition)return;
    if(!confirm('Dictate your instruction? Review the text before pressing Send.'))return;
    const r=new Recognition();cmd.recognition=r;r.lang='en-US';r.continuous=false;r.interimResults=true;
    r.onresult=e=>{let text='';for(let i=e.resultIndex;i<e.results.length;i++)text+=e.results[i][0].transcript;$('#cmd-message').value=text;};
    r.onend=()=>stopVoice();r.onerror=()=>{$('#cmd-voice-state').textContent='Dictation stopped. You can type instead.';stopVoice();};r.start();$('#cmd-mic').textContent='■';voiceTimer=setTimeout(stopVoice,45000);
  });

  $('#cmd-read').addEventListener('click',()=>{if(!('speechSynthesis'in window)||!cmd.detail)return;const n=[...cmd.detail.notes].reverse().find(n=>n.recipient==='owner'||n.kind==='summary');if(!n)return;window.speechSynthesis.cancel();window.speechSynthesis.speak(new SpeechSynthesisUtterance(n.body));});
}
