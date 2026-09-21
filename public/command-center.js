/* Clean owner command room: the wall shows saved collaboration, not hidden reasoning. */
{
  const cmd={caseId:null,detail:null,threads:[],busy:false,requestId:crypto.randomUUID(),recipient:'team',loading:false,recognition:null,receivedAt:0,generation:0,feedKey:null,loadAgain:false,boardFilter:'all'};
  const root=document.createElement('section');root.id='command-view';root.className='view command-center';root.hidden=true;$('#main').append(root);
  headings.command=['OWNER CONTROL ROOM','Watch the team work together.','One live board for work, conversation and the few decisions that need you.'];
  const talk=document.createElement('button');talk.id='talk-to-team';talk.className='button compact primary';talk.textContent='◉ Open live office';$('.heading-actions').prepend(talk);
  const preview=document.createElement('section');preview.id='command-preview';preview.className='command-preview';preview.setAttribute('aria-label','Live team status');$('.owner-dock').before(preview);

  const names={owner:'Bryan',system:'Office',team:'Everyone',office:'Morgan',email:'Avery',tech:'Alex',phone:'Riley'};
  const roleLabel={office:'Office coordinator',email:'Customer care',tech:'Technical support',phone:'Phone receptionist'};
  const color={office:'#789985',email:'#c39a6d',tech:'#9489ad',phone:'#6f9ead'};
  const snapshot=()=>state?.apprenticeship?.command;
  const when=t=>t?new Date(t).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET':'—';
  const short=(v,n=260)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n);
  const avatar=role=>`<svg class="cmd-avatar" viewBox="0 0 100 96" aria-hidden="true"><ellipse cx="50" cy="89" rx="39" ry="5" fill="#000" opacity=".16"/><path d="M18 87v-8c0-20 14-28 32-28s32 8 32 28v8" fill="currentColor"/><path d="m41 54 9 13 10-13" fill="#e0b28d"/><rect x="43" y="45" width="15" height="16" rx="5" fill="#b98968"/><ellipse cx="50" cy="31" rx="19" ry="24" fill="${role==='tech'?'#bd9279':'#dfb28f'}"/><path d="M30 29C24 4 68-8 71 29L59 14c-10 9-19 6-29 15" fill="${role==='email'?'#76513a':'#3a3435'}"/><circle cx="43" cy="32" r="1.3" fill="#3c3431"/><circle cx="58" cy="32" r="1.3" fill="#3c3431"/><path d="M45 42q5 3 10 0" fill="none" stroke="#8f5d4b" stroke-width="1.5"/></svg>`;

  root.innerHTML=`
  <div class="cmd-toolbar">
    <div class="cmd-toolbar-state"><span id="cmd-live" class="cmd-live">CONNECTING</span><span id="cmd-mode"></span></div>
    <div class="cmd-toolbar-actions"><button class="button secondary" id="cmd-focus">Focus board</button><button class="button primary" id="cmd-shift">24/7 Office ON</button><button class="button secondary" data-view="office">Showroom</button></div>
  </div>

  <div class="cmd-layout">
    <main class="cmd-stage-column">
      <section class="cmd-room">
        <div class="cmd-room-label"><span>FRIENDLY PARTY RENTAL · SYRACUSE HQ</span><b>LIVE TEAM ROOM</b></div>

        <div class="cmd-wall">
          <header>
            <div><p class="eyebrow">SHARED BOARD</p><h2>The team is working it out here.</h2></div>
            <div class="cmd-wall-meta"><span id="cmd-wall-time"></span><span id="cmd-wall-state"></span></div>
          </header>
          <div id="cmd-board-stream" class="cmd-board-stream"></div>
          <footer>
            <span id="cmd-totals"></span>
            <button class="text-button" id="cmd-board-all">Show all team activity</button>
          </footer>
        </div>

        <div id="cmd-people" class="cmd-people"></div>
      </section>

      <section class="cmd-attention-panel">
        <header><div><p class="eyebrow">NEEDS BRYAN</p><h2>Only decisions that need you.</h2></div><span id="cmd-attention-count"></span></header>
        <div id="cmd-attention" class="cmd-attention"></div>
      </section>

      <details class="cmd-duty-drawer">
        <summary><span><b>24/7 standing work</b><small>Orders, email, website, phone and continuous improvement</small></span><span>View duties</span></summary>
        <div id="cmd-duty-list"></div>
        <p>No fake busy-work. A caught-up employee keeps watching for the next real task instead of manufacturing activity.</p>
      </details>
    </main>

    <aside class="cmd-chat">
      <header><span class="cmd-owner-icon">BP</span><div><p class="eyebrow">BRYAN’S DIRECT LINE</p><h2>Talk to the office</h2></div><button id="cmd-new" class="icon-button" aria-label="Start a new conversation">＋</button></header>
      <label class="cmd-thread-label">Conversation<select id="cmd-threads"><option value="">New conversation</option></select></label>
      <div id="cmd-chat-log" class="cmd-chat-log"><div class="cmd-chat-empty"><h3>Your team is here.</h3><p>Ask everyone or one employee. Peer discussion stays on the shared board; this panel keeps your instructions and final answers clean.</p></div></div>
      <form id="cmd-message-form">
        <div class="cmd-form-top">
          <label>To<select id="cmd-to"><option value="team">Everyone</option><option value="office">Morgan</option><option value="email">Avery</option><option value="tech">Alex</option><option value="phone">Riley</option></select></label>
          <label>Use<select id="cmd-evidence"><option value="brief">Office status</option><option value="orders">Live orders</option><option value="website">Website check</option></select></label>
        </div>
        <label class="sr-only" for="cmd-message">Message to your team</label>
        <textarea id="cmd-message" rows="4" maxlength="2000" placeholder="Team, check what needs attention and figure out the best next step…" required></textarea>
        <div class="cmd-quick"><button type="button" data-cmd-quick="brief">What needs me?</button><button type="button" data-cmd-quick="orders">Check orders</button><button type="button" data-cmd-quick="website">Check site</button></div>
        <div class="cmd-send-row"><button type="button" id="cmd-mic" class="button secondary">🎙 Dictate</button><button type="submit" id="cmd-send" class="button primary">Send →</button></div>
        <p id="cmd-voice-state" role="status">Dictation is optional and never auto-sends.</p><p id="cmd-submit-state" role="status"></p>
      </form>
      <footer><button id="cmd-open-case" class="button secondary" disabled>Open full case & evidence ↗</button><button id="cmd-read" class="text-button">Read latest answer aloud</button></footer>
    </aside>
  </div>

  <dialog id="cmd-activity-dialog" class="app-dialog"><div class="cmd-activity-dialog"><header><div><p class="eyebrow">RECORDED COLLABORATION</p><h2>Team activity</h2></div><button class="icon-button" data-cmd-close-activity aria-label="Close">×</button></header><div id="cmd-activity-full"></div></div></dialog>
  `;

  function teamCard(r){
    return `<button class="cmd-person ${r.status==='working'?'is-working':''}" data-cmd-person="${r.id}" style="--person:${color[r.id]}" aria-label="Talk to ${r.name}">
      <span class="cmd-person-avatar">${avatar(r.id)}<i class="cmd-status-light ${r.status}"></i></span>
      <span class="cmd-person-copy"><strong>${r.name}</strong><small>${roleLabel[r.id]||r.role}</small><em>${esc(r.status)}</em><p>${esc(r.activity)}</p></span>
    </button>`;
  }

  function boardRows(all=false){
    const x=snapshot(),feed=(x?.feed||[]).filter(n=>cmd.boardFilter==='all'||n.author===cmd.boardFilter||n.recipient===cmd.boardFilter);
    const rows=(all?feed:feed.slice(0,10)).slice().reverse();
    if(!rows.length)return '<div class="cmd-board-empty"><strong>Everyone is caught up.</strong><span>The board will update when an employee asks a teammate, reports a finding, hands work off, disagrees, or completes a decision.</span></div>';
    return rows.map(n=>{
      const kind=({question:'asks',contribution:'finds',summary:'concludes',finding:'flags',handoff:'hands off',owner-note:'notes','owner-request':'assigns','check-result':'reports',sent:'sends'})[n.kind]||n.kind;
      return `<button class="cmd-board-line" data-ap-case="${n.caseId}">
        <span class="cmd-board-avatar" style="--person:${color[n.author]||'#b9a47b'}">${esc((names[n.author]||n.author).slice(0,2).toUpperCase())}</span>
        <span class="cmd-board-copy"><span><b>${esc(names[n.author]||n.author)}</b><i>→</i><b>${esc(names[n.recipient]||n.recipient)}</b><em>${esc(kind)}</em><time>${when(n.at)}</time></span><p>${esc(short(n.body,320))}${n.truncated?'…':''}</p><small>${esc(n.title)}</small></span>
      </button>`;
    }).join('');
  }

  function renderAttention(){
    const items=snapshot()?.attention||[];
    $('#cmd-attention-count').textContent=items.length?`${items.length} item${items.length===1?'':'s'}`:'Caught up';
    $('#cmd-attention').innerHTML=items.length?items.slice(0,6).map(a=>`<button class="cmd-attention-item" ${a.type==='case'?`data-ap-case="${a.id}"`:`data-task="${a.id}"`}><span class="cmd-dot ${a.status}"></span><span><b>${esc(a.title)}</b><small>${esc(names[a.role]||a.role)} · ${esc(a.status)}</small><p>${esc(short(a.detail,190))}</p></span><strong>Open ↗</strong></button>`).join(''):'<div class="cmd-attention-empty"><b>Nothing needs your decision right now.</b><span>The team keeps working and this queue fills only when approval or a real blocker needs you.</span></div>';
  }

  function renderDuties(){
    const x=snapshot();if(!x)return;
    const title={queue:'Morgan · queue watch',orders:'Morgan · order readiness',website:'Alex · website health',phone:'Riley · phone follow-up',improvement:'Team · improvement pulse'};
    $('#cmd-duty-list').innerHTML=x.duties.map(d=>`<article><span class="cmd-dot ${d.status==='blocked'?'blocked':d.status==='waiting'?'waiting':'available'}"></span><div><b>${title[d.id]||d.id}</b><p>${esc(d.detail||'Waiting for first check.')}</p><small>Last ${when(d.lastAt)} · Next ${when(d.nextAt)}</small></div></article>`).join('')+
      `<article><span class="cmd-dot ${state.apprenticeship.mail.enabled?'available':'waiting'}"></span><div><b>Avery · inbox watch</b><p>${state.apprenticeship.mail.enabled?'Watching the built-in customer-service mailbox for new unread customer work.':'Mailbox observation is off.'}</p><button data-ap-route="observations">Open Avery ↗</button></div></article>`;
  }

  function renderScreen(){
    const x=snapshot();if(!x)return;cmd.receivedAt=Date.now();
    preview.innerHTML=`<header><div><span class="eyebrow">LIVE OFFICE</span><h2>${state.settings.paused?'Office paused':'24/7 office working'}</h2></div><button class="button primary" data-cmd-open="true">Open team room ↗</button></header><div class="cmd-mini-team">${x.team.map(r=>`<button data-cmd-person="${r.id}" style="--person:${color[r.id]}"><span class="cmd-mini-avatar">${avatar(r.id)}</span><span><b>${r.name}</b><small>${esc(r.status)} · ${esc(short(r.activity,80))}</small></span><i class="cmd-dot ${r.status}"></i></button>`).join('')}</div>`;
    if(view!=='command')return;
    $('#cmd-people').innerHTML=x.team.map(teamCard).join('');
    $('#cmd-board-stream').innerHTML=boardRows(false);
    $('#cmd-wall-time').textContent=when(x.serverTime);
    $('#cmd-wall-state').textContent=x.feed?.length?'Recorded team conversation':'No active discussion';
    const c=x.counts.cases,t=x.counts.tasks;
    $('#cmd-totals').textContent=`${(c.queued||0)+(t.queued||0)} queued · ${(c.review||0)+(t.waiting_approval||0)} need review · ${(c.blocked||0)+(t.blocked||0)} blocked`;
    $('#cmd-mode').textContent=state.settings.mode==='practice'?'Practice workspace':state.settings.useAI?'Live shadow · Friendly private AI':'Live shadow · checklist';
    $('#cmd-shift').textContent=!state.settings.paused&&x.settings.enabled?'24/7 Office ON · turn off':'24/7 Office OFF · turn on';
    $('#cmd-shift').setAttribute('aria-pressed',String(!state.settings.paused&&x.settings.enabled));
    renderAttention();renderDuties();freshness();
  }

  async function get(path){const r=await fetch(path,{cache:'no-store'});if(r.status===401){signedOut();throw new Error('Sign in again.');}const b=await r.json();if(!r.ok)throw new Error(b.error||'Could not load the team conversation.');return b;}

  function renderChat(){
    const log=$('#cmd-chat-log'),wasNear=log.scrollHeight-log.scrollTop-log.clientHeight<100;
    if(!cmd.detail){log.innerHTML='<div class="cmd-chat-empty"><h3>Your direct line is clear.</h3><p>Peer discussion stays on the large shared board. Your panel only keeps your instructions and the team’s final answers.</p></div>';$('#cmd-open-case').disabled=true;return;}
    const notes=cmd.detail.notes.filter(n=>n.author==='owner'||n.recipient==='owner'||n.kind==='summary'||n.kind==='sent');
    log.innerHTML=notes.map(n=>`<article class="cmd-bubble ${n.author==='owner'?'owner':'employee'}"><header><b>${esc(names[n.author]||n.author)}${n.author!=='owner'?' → Bryan':''}</b><time>${when(n.created)}</time></header><p>${esc(n.body)}</p></article>`).join('')+
      (['queued','working'].includes(cmd.detail.status)?`<div class="cmd-pending">${state.settings.paused?'24/7 Office is off. Turn it on to start this assignment.':cmd.detail.status==='working'?'The team is actively working this case. Watch the shared board for their collaboration.':'Queued for the next available employee.'}</div>`:cmd.detail.reason?`<div class="cmd-pending">${esc(cmd.detail.reason)}</div>`:'');
    if(wasNear)log.scrollTop=log.scrollHeight;$('#cmd-open-case').disabled=false;
  }

  async function loadChat(){
    if(view!=='command'||!state)return;if(cmd.loading){cmd.loadAgain=true;return;}cmd.loading=true;const generation=cmd.generation;
    try{
      const id=cmd.caseId,data=await get('/api/apprentice/command/threads');if(!state||cmd.generation!==generation||view!=='command')return;
      cmd.threads=data.threads;$('#cmd-threads').innerHTML='<option value="">New conversation</option>'+cmd.threads.map(t=>`<option value="${t.id}">${esc(t.title.slice(0,75))}</option>`).join('');$('#cmd-threads').value=cmd.caseId||'';
      if(id){const detail=await get('/api/apprentice/cases/'+id);if(cmd.caseId!==id||!state||cmd.generation!==generation||view!=='command')return;const changed=!cmd.detail||cmd.detail.updated!==detail.updated||cmd.detail.notes.length!==detail.notes.length||cmd.detail.status!==detail.status;cmd.detail=detail;if(changed)renderChat();}
      else renderChat();
    }finally{cmd.loading=false;if(cmd.loadAgain){cmd.loadAgain=false;setTimeout(()=>void loadChat().catch(()=>{}),80);}}
  }

  function openTeam(role){
    setView('command');if(view!=='command')return;document.body.classList.remove('command-open','menu-open');$('#mobile-menu').setAttribute('aria-expanded','false');$('#records-view').hidden=true;root.hidden=false;
    if(role){$('#cmd-to').value=role;cmd.recipient=role;}renderScreen();void loadChat().catch(e=>toast(e.message));$('#cmd-message').focus({preventScroll:true});
  }

  talk.addEventListener('click',()=>openTeam());
  const priorRender=render;render=function(){priorRender();renderScreen();if(view==='command')void loadChat().catch(e=>toast(e.message));};
  const priorView=setView;setView=function(next){if(next!=='command'){stopVoice();document.body.classList.remove('command-focus');}priorView(next);if(next==='command'&&view==='command'){root.hidden=false;$('#records-view').hidden=true;}};
  const priorLogout=signedOut;signedOut=function(){stopVoice();window.speechSynthesis?.cancel();cmd.generation++;cmd.caseId=null;cmd.detail=null;cmd.threads=[];$('#cmd-message').value='';$('#cmd-chat-log').replaceChildren();$('#cmd-board-stream').replaceChildren();preview.replaceChildren();root.hidden=true;priorLogout();};

  document.addEventListener('click',safe(async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.cmdOpen){openTeam();return;}
    if(b.dataset.cmdPerson){openTeam(b.dataset.cmdPerson);return;}
    if(b.dataset.cmdQuick){
      const k=b.dataset.cmdQuick;$('#cmd-evidence').value=k;$('#cmd-message').value=({brief:'Team, what needs my attention right now? Work it out together and give me only the decisions or blockers that actually need me.',orders:'Morgan, review live orders for payment, contract, schedule, delivery, pickup and inventory risks. Ask Avery or Riley for follow-up help when the evidence supports it.',website:'Alex, check the live Friendly Party Rental site. Work with the team on customer or operational impact, but do not publish changes.'})[k];
      $('#cmd-to').value=k==='website'?'tech':k==='orders'?'office':'team';$('#cmd-message').focus();
    }
  }));

  $('#cmd-board-all').addEventListener('click',()=>{const d=$('#cmd-activity-dialog');$('#cmd-activity-full').innerHTML=`<div class="cmd-board-stream full">${boardRows(true)}</div>`;d.showModal();});
  $('[data-cmd-close-activity]').addEventListener('click',()=>$('#cmd-activity-dialog').close());
  $('#cmd-threads').addEventListener('change',safe(async e=>{cmd.caseId=e.target.value||null;cmd.detail=null;cmd.requestId=crypto.randomUUID();await loadChat();}));
  $('#cmd-new').addEventListener('click',()=>{cmd.caseId=null;cmd.detail=null;cmd.requestId=crypto.randomUUID();$('#cmd-threads').value='';$('#cmd-message').focus();renderChat();});
  $('#cmd-shift').addEventListener('click',safe(async()=>{const x=snapshot(),enable=state.settings.paused||!x.settings.enabled;await post('/api/apprentice/command/settings',{enabled:enable,...(enable?{resume:true}:{})});toast(enable?'24/7 Office is ON. Employees keep pulling useful authorized work and show caught up when there is nothing real to do.':'24/7 Office is OFF. The entire virtual office is paused.');}));
  $('#cmd-focus').addEventListener('click',()=>{const on=document.body.classList.toggle('command-focus');$('#cmd-focus').textContent=on?'Exit focus':'Focus board';});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){document.body.classList.remove('command-focus');$('#cmd-focus').textContent='Focus board';stopVoice();}});
  $('#cmd-open-case').addEventListener('click',()=>{if(cmd.caseId){const b=document.createElement('button');b.dataset.apCase=cmd.caseId;b.hidden=true;root.append(b);b.click();b.remove();}});

  $('#cmd-message-form').addEventListener('submit',safe(async e=>{
    e.preventDefault();if(cmd.busy)return;const text=$('#cmd-message').value.trim();if(!text)return;stopVoice();cmd.busy=true;freshness();$('#cmd-submit-state').textContent='Adding this to the team board…';
    try{
      const r=await post('/api/apprentice/command/message',{message:text,recipient:$('#cmd-to').value,action:$('#cmd-evidence').value,requestId:cmd.requestId,...(cmd.caseId?{caseId:cmd.caseId,revision:cmd.detail?.revision}:{})});
      cmd.caseId=r.caseId;cmd.detail=null;cmd.requestId=crypto.randomUUID();$('#cmd-message').value='';$('#cmd-submit-state').textContent=r.paused?'Saved. Turn 24/7 Office on to start.':'Saved. Watch the shared board as the team works it out.';await loadChat();
    }catch(err){$('#cmd-submit-state').textContent=err.message;throw err;}finally{cmd.busy=false;freshness();}
  }));

  function freshness(){const el=$('#cmd-live');if(!el)return;const fresh=connected&&Date.now()-cmd.receivedAt<45000;el.textContent=fresh?'● LIVE':'● STALE';el.classList.toggle('stale',!fresh);$('#cmd-send').disabled=!fresh||cmd.busy;}

  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){$('#cmd-mic').disabled=true;$('#cmd-voice-state').textContent='Browser dictation is unavailable here. Type or use your device keyboard microphone.';}
  let voiceTimer;
  function stopVoice(){clearTimeout(voiceTimer);if(cmd.recognition){try{cmd.recognition.stop();}catch{}cmd.recognition=null;}if($('#cmd-mic'))$('#cmd-mic').textContent='🎙 Dictate';}
  $('#cmd-mic').addEventListener('click',()=>{if(cmd.recognition){stopVoice();return;}if(!Recognition)return;
    if(!confirm('Dictate your own instruction? Your browser may use its speech service. Do not dictate card data or customer call audio. Review the text before pressing Send.'))return;
    const recognition=new Recognition(),base=$('#cmd-message').value;cmd.recognition=recognition;recognition.lang='en-US';recognition.interimResults=true;recognition.continuous=false;
    recognition.onresult=e=>{const words=Array.from(e.results).map(r=>r[0].transcript).join(' ');$('#cmd-message').value=(base+(base?' ':'')+words).slice(0,2000);};
    recognition.onstart=()=>{$('#cmd-mic').textContent='■ Stop';$('#cmd-voice-state').textContent='Listening to your instruction. Nothing auto-sends.';};
    recognition.onerror=e=>{$('#cmd-voice-state').textContent='Dictation unavailable ('+e.error+').';stopVoice();};
    recognition.onend=()=>{stopVoice();$('#cmd-voice-state').textContent='Review the text, then press Send.';};
    try{recognition.start();voiceTimer=setTimeout(stopVoice,60000);}catch{stopVoice();}
  });

  $('#cmd-read').addEventListener('click',()=>{if(!('speechSynthesis' in window)){toast('Speech playback is not supported in this browser.');return;}if(speechSynthesis.speaking){speechSynthesis.cancel();return;}const text=cmd.detail?.notes.filter(n=>n.kind==='summary'||n.recipient==='owner').at(-1)?.body;if(!text){toast('No completed team answer yet.');return;}if(confirm('Read this private reply aloud on your device?'))speechSynthesis.speak(new SpeechSynthesisUtterance(text.slice(0,6000)));});
  document.addEventListener('click',e=>{if(e.target.closest('[data-ap-case],[data-ap-route],[data-hq-route],[data-agent],[data-task]')){stopVoice();document.body.classList.remove('command-focus');}},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopVoice();if('speechSynthesis' in window)speechSynthesis.cancel();}});
  setInterval(()=>{freshness();if(state&&view==='command'&&!document.hidden){void refresh();void loadChat().catch(()=>{});}},7000);
  renderScreen();
}
