import { ROLES, OfficeError, requireText } from './store.mjs';

export function seedPractice(store) {
  const sample = [
    { title: 'Draft a tent-rental inquiry reply', role: 'email', kind: 'email', payload: { from:'Sample customer · fictional', message:'Hi! I am planning a backyard party and would like a 20 × 40 tent, tables and chairs. Could you send a quote?', limitation:'Fictional exercise. No real customer, price or reservation.' } },
    { title: 'Review a sample delivery for missing details', role: 'office', kind: 'orders', payload: { snapshot: { asOf:new Date().toISOString(), orders:[{id:'PRACTICE-001',eventDate:'Example event date — not a booking',deliveryAddress:'',pickupWindow:'',balanceDue:75,items:[{name:'Sample folding chairs',quantity:30,availability:'unconfirmed'},{name:'Sample folding tables',quantity:4,availability:'confirmed'}]}] } } },
    { title: 'Inspect a sample mobile webpage', role: 'tech', kind: 'website', payload: { html:'<!doctype html><html><head><title>Practice rental page</title></head><body><button id="book">Check my date</button><img src="sample.jpg"><button id="book">Book now</button></body></html>', limitation:'Fictional HTML fixture. Not a scan of the real website.' } }
  ];
  return sample.map((t,i) => store.addTask({ ...t,source:'practice',dedupe:`practice:v1:${i}` }));
}
export function classify(instruction) {
  if (/website|bug|checkout|technical|github|page|mobile|deploy/i.test(instruction)) return 'tech';
  if (/email|inbox|reply|message|quote|customer/i.test(instruction)) return 'email';
  return 'office';
}
export function inspectHTML(html,status=200) {
  const findings=[];
  if(status!==200) findings.push(`HTTP ${status}: this response is not a confirmed successful page load. Redirects are not followed.`);
  const title=html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  if(!title) findings.push('No nonempty page title found in the retrieved HTML.');
  if(!/<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(html)) findings.push('Viewport meta tag not found in the retrieved HTML.');
  const images=[...html.matchAll(/<img\b[^>]*>/gi)];
  const missingAlt=images.filter(m=>!/(?:\s)alt\s*=/i.test(m[0])).length;
  if(missingAlt) findings.push(`${missingAlt} image element(s) without an explicit alt attribute.`);
  const ids=[...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]);
  const duplicate=[...new Set(ids.filter((v,i)=>ids.indexOf(v)!==i))];
  if(duplicate.length) findings.push(`Duplicate element IDs: ${duplicate.slice(0,10).join(', ')}.`);
  return { title:title||'Not found', findings, limitation:'Static HTML/HTTP inspection only. JavaScript rendering, checkout behavior, images loading, accessibility conformance and visual layout were not browser-tested by this employee.' };
}
export function reviewOrders(snapshot) {
  const lines=[`ORDER READINESS REVIEW\nSource timestamp: ${snapshot.asOf}\nThis report describes the supplied live snapshot. It does not alter an order or guarantee physical availability.`];
  if(Date.now()-Date.parse(snapshot.asOf)>86400000) lines.push('\nSTALE SOURCE: snapshot is over 24 hours old. Recheck against the live order system before making commitments.');\n  else if(Date.now()-Date.parse(snapshot.asOf)>3600000) lines.push('\nSOURCE AGE: snapshot is over one hour old; recheck before making a customer commitment.');
  if(!snapshot.orders.length){lines.push('\nNo upcoming active orders were returned in this bounded feed.');return lines.join('\n');}

  const dayUse=new Map();
  for(const o of snapshot.orders){
    const day=String(o.eventDate||'').slice(0,10);
    for(const i of o.items){
      if(!i.id||i.inventoryQuantity===null)continue;
      const key=day+'|'+i.id,current=dayUse.get(key)||{name:i.name,total:0,inventory:i.inventoryQuantity,orders:[]};
      current.total+=i.quantity;current.orders.push(o.id);current.inventory=Math.min(current.inventory,i.inventoryQuantity);dayUse.set(key,current);
    }
  }

  let attention=0;
  for(const o of snapshot.orders) {
    const gaps=[],eventMs=Date.parse(o.eventDate),days=Number.isFinite(eventMs)?Math.ceil((eventMs-Date.now())/86400000):null;
    if(!o.eventDate) gaps.push('event date missing');
    if(!o.deliveryAddress) gaps.push('delivery address missing');
    if(!o.deliveryWindow) gaps.push('delivery window missing');
    if(!o.pickupWindow) gaps.push('pickup window missing');
    if(o.balanceDue===null || o.balanceDue===undefined) gaps.push('balance not provided');
    else if(o.balanceDue>0){
      gaps.push(`$${Number(o.balanceDue).toFixed(2)} balance due${days!==null&&days<=3?' — event is within 3 days':''}`);
    }
    if(o.amountPaid===0&&!o.scheduleApprovedUnpaid)gaps.push('no recorded payment and unpaid schedule approval is not set');
    if(o.contractSigned===false)gaps.push('contract not recorded as signed');
    if(o.exactDeliveryRequested&&!o.exactDeliveryTime)gaps.push('exact delivery requested but exact time missing');
    if(o.latePickupApprovalRequired)gaps.push('late pickup requires approval');
    if(o.isPublicPark&&!o.setupSurface)gaps.push('public-park order without setup surface recorded');
    if(o.hasRestrictionMatch)gaps.push('rental restriction match exists — owner review required');
    if(!o.driverAssigned)gaps.push('delivery driver not assigned');
    if(!o.pickupDriverAssigned)gaps.push('pickup driver not assigned');
    if(!o.notesPresent&&!o.internalNotesPresent)gaps.push('no customer/internal notes recorded');
    for(const i of o.items){
      if(i.availability!=='confirmed')gaps.push(`${i.name}: item status/return date is not confirmed available`);
      if(i.attention)gaps.push(`${i.name}: inventory attention note exists`);
      if(i.bookableAfter&&Number.isFinite(eventMs)&&Date.parse(i.bookableAfter)>eventMs)gaps.push(`${i.name}: bookable-after date is later than this event`);
      if(i.inventoryQuantity!==null&&i.quantity>i.inventoryQuantity)gaps.push(`${i.name}: this order alone requests ${i.quantity}, inventory record lists ${i.inventoryQuantity}`);
      if(i.id&&i.inventoryQuantity!==null){
        const use=dayUse.get(String(o.eventDate||'').slice(0,10)+'|'+i.id);
        if(use&&use.total>use.inventory)gaps.push(`${i.name}: same-day orders total ${use.total} vs inventory ${use.inventory} across ${[...new Set(use.orders)].join(', ')} — potential conflict, verify rental overlap/returns`);
      }
    }
    if(!o.items.length) gaps.push('item list empty');
    attention+=gaps.length?1:0;
    lines.push(`\n${o.id}${o.status?' · '+o.status:''}${days!==null?' · '+days+' day(s) away':''}\n${gaps.length ? gaps.map(g=>`• ${g}`).join('\n') : 'No risk flags from the fields supplied to this review.'}\nItems: ${o.items.map(i=>`${i.quantity} × ${i.name}`).join('; ')||'None provided'}`);
  }
  lines.splice(1,0,`Orders checked: ${snapshot.orders.length} · Orders with at least one readiness flag: ${attention}`);
  lines.push('\nOWNER CHECKS\nResolve flagged payment, inventory, contract, routing, access and restriction issues in the authoritative system. A potential stock conflict is a warning from this snapshot, not a confirmed double-booking. No booking or customer message was changed.');
  return lines.join('\n');
}
export function emailTemplate(task) {
  return `REPLY DRAFT — NOT SENT\n\nHi! Thank you for contacting Friendly Party Rental. To make sure we give you the correct information, please confirm your event date, delivery address, the items and quantities you need, and your preferred setup and pickup timing. We will need to check the current order system before confirming availability or preparing a final quote.\n\nThank you,\nFriendly Party Rental\n\nOWNER CHECKS\nThis is a conservative template, not a personalized AI answer. Review the original message above and remove questions the customer already answered. No price, availability or delivery time has been verified. No email was sent.`;
}
export class Engine {
  constructor(store,integrations) { this.store=store; this.integrations=integrations; this.active=new Map(); this.timer=null; }
  start() { if(!this.timer) this.timer=setInterval(()=>this.tick(),1000); }
  async stop() { clearInterval(this.timer); this.timer=null; for(const entry of this.active.values()) entry.controller.abort(); await Promise.allSettled([...this.active.values()].map(e=>e.promise)); }
  pauseAgent(role) { this.active.get(role)?.controller.abort(); }
  pauseAll() {
    this.store.set('settings',{...this.store.get('settings'),paused:true});
    for(const entry of this.active.values()) entry.controller.abort();
    this.store.event(null,'owner','Office paused','No new work may start. In-flight requests are being cancelled; already incurred provider usage cannot be undone.');
  }
  tick() {
    if(this.store.get('settings').paused) return;
    for(const role of ROLES) {
      if(this.active.has(role.id)) continue;
      const t=this.store.claim(role.id); if(!t) continue;
      const controller=new AbortController();
      const promise=this.run(t,controller.signal).finally(()=>this.active.delete(role.id));
      this.active.set(role.id,{controller,promise});
    }
  }
  async run(task,signal) {
    const started=performance.now(),s=this.store;
    const checkpoint=()=>{signal.throwIfAborted(); if(s.get('settings').paused || s.get(`agent:${task.role}`).paused) throw new DOMException('Paused','AbortError');};
    const evidence=[];
    try {
      checkpoint();
      s.event(task.id,task.role,'Source inspected',task.source==='practice'?'Using explicitly fictional practice data. No live services will be called.':`Source: ${task.source}. External content is treated as untrusted data.`);
      let result='';
      if(task.role==='office') {
        let snapshot=task.payload.snapshot;
        if(!snapshot && task.source!=='practice') {
          s.event(task.id,task.role,'Read requested','Reading the configured order snapshot; no order writes are available.');
          snapshot=await this.integrations.orderSnapshot(signal);
        }
        if(!snapshot) throw new OfficeError('No order snapshot supplied. Practice does not read live business records.');
        evidence.push({label:task.source==='practice'?'Fictional sample orders':task.source==='manual'?'Owner-imported snapshot · not live verified':'Configured order source',detail:JSON.stringify(snapshot,null,2).slice(0,16000),observedAt:snapshot.asOf});
        result=reviewOrders(snapshot);
      } else if(task.role==='email') {
        const message=task.payload.message || task.payload.instruction;
        if(!message) throw new OfficeError('No customer message or instruction is attached to this task.');
        evidence.push({label:task.source==='practice'?'Fictional customer inquiry':'Message / owner instruction',detail:String(message).slice(0,14000),observedAt:task.payload.observedAt||task.created});
        result=emailTemplate(task);
      } else if(task.role==='tech') {
        if(task.kind==='github') {
          if(task.source==='practice') throw new OfficeError('Practice mode does not read GitHub.');
          const data=await this.integrations.github(signal);
          evidence.push({label:'GitHub read-only check evidence',detail:JSON.stringify(data,null,2),observedAt:data.observedAt});
          result=`REPOSITORY CHECK REPORT\n${data.repository}\nCommit: ${data.sha}\n\n${data.checks.length?data.checks.map(c=>`${c.name}: ${c.status} / ${c.conclusion||'no conclusion'}`).join('\n'):'No check runs returned. This is not a passing test result.'}\n\nOWNER CHECKS\nThis employee read commit/check metadata only. No source code was patched, tests run locally, PR created or deployment performed.`;
        } else {
          let page;
          if(task.source==='practice') {
            if(!task.payload.html) throw new OfficeError('No practice HTML attached. Live website checks are disabled in practice.');
            page={html:task.payload.html,status:200,url:'Fictional HTML fixture',observedAt:task.created};
          } else page=await this.integrations.website(task.payload.path||'/',signal);
          const inspection=inspectHTML(page.html,page.status);
          evidence.push({label:page.url,detail:JSON.stringify({status:page.status,...inspection},null,2),observedAt:page.observedAt});
          result=`WEBSITE CHECK REPORT\nSource: ${page.url}\nHTTP: ${page.status}\nPage title: ${inspection.title}\n\n${inspection.findings.length?inspection.findings.map(f=>`• ${f}`).join('\n'):'No issues found by this limited HTML checklist. This is not a complete website QA pass.'}\n\nLIMITATIONS\n${inspection.limitation}\n\nOWNER CHECKS\nReview the evidence before commissioning a change. No website files were modified and nothing was deployed.`;
        }
      }
      checkpoint();
      s.event(task.id,task.role,'Evidence recorded',`${evidence.length} source record(s) attached. Checking the approved operating procedures.`);
      // Practice never spends model credits. Shadow AI requires explicit owner opt-in as well as server credentials.
      if(task.source!=='practice' && s.get('settings').useAI) {
        s.event(task.id,task.role,'AI draft requested','Sending the selected task data, evidence and approved procedures to the configured model. No tools granted.');
        result=`MODEL-ASSISTED DRAFT — OWNER FACT REVIEW REQUIRED\n\n${await this.integrations.draft(task,evidence,signal)}\n\nNo email sent, order modified or website deployed.`;
      }
      checkpoint();
      s.patch(task.id,{status:'waiting_approval',result,evidence,reason:'',run_ms:Math.round(performance.now()-started)});
      s.event(task.id,task.role,'Ready for owner review',task.source==='practice'?'Practice report prepared by deterministic checks/templates, not an AGI employee.':'Draft/report prepared. Approval does not execute an external business action.');
    } catch(error) {
      const interrupted=signal.aborted || error.name==='AbortError';
      const reason=interrupted?'Paused during work. Inspect the activity history before retrying.':error instanceof OfficeError?error.message:'The configured service could not be reached or returned an unexpected result. Check credentials/network; no business action was executed.';
      s.patch(task.id,{status:'blocked',reason,evidence,run_ms:Math.round(performance.now()-started)});
      s.event(task.id,task.role,interrupted?'Work interrupted':'Task blocked',reason);
    }
  }
}
