import { randomUUID, createHash } from 'node:crypto';
import { OfficeError, requireText, ROLES } from './store.mjs';

export const TEAM = [
  ...ROLES,
  { id:'phone', name:'Riley', role:'Phone apprentice', initials:'RI', color:'#79b6ca', description:'Learns from authorized calls handled by Nicole. Does not answer or record calls.' }
];
export const stamp = () => new Date().toISOString();
export const digest = v => createHash('sha256').update(String(v)).digest('hex');
export const member = id => { const r=TEAM.find(x=>x.id===id); if(!r)throw new OfficeError('Unknown teammate.');return r; };
export function redact(text) {
  return String(text??'').replace(/\b(?:\d[ -]?){13,19}\b/g,'[payment-like number removed]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g,'[sensitive number removed]')
    .replace(/\b(password|passcode|api[_ -]?key|authorization)\s*[:=]\s*\S+/gi,'$1: [removed]');
}
export class ApprenticeData {
  constructor(store,integrations) {
    this.store=store;this.db=store.db;this.integrations=integrations;
    this.db.exec(`CREATE TABLE IF NOT EXISTS ap_cases(id TEXT PRIMARY KEY,source_key TEXT UNIQUE,title TEXT NOT NULL,
      lead TEXT NOT NULL,practice INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'open',
      draft TEXT NOT NULL DEFAULT '',draft_revision INTEGER,reason TEXT NOT NULL DEFAULT '',created TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ap_sources(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES ap_cases(id) ON DELETE CASCADE,
      source_key TEXT UNIQUE,kind TEXT NOT NULL,fingerprint TEXT NOT NULL,payload TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ap_notes(id INTEGER PRIMARY KEY AUTOINCREMENT,case_id TEXT NOT NULL REFERENCES ap_cases(id) ON DELETE CASCADE,
      author TEXT NOT NULL,recipient TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL,evidence TEXT NOT NULL,created TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ap_jobs(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES ap_cases(id) ON DELETE CASCADE,
      target TEXT NOT NULL,status TEXT NOT NULL,source_revision INTEGER NOT NULL,question TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS ap_one_job ON ap_jobs(case_id) WHERE status IN ('queued','running');
      CREATE TABLE IF NOT EXISTS ap_lessons(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES ap_cases(id) ON DELETE CASCADE,
      title TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL,source_revision INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,
      rule_id TEXT,created TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ap_drafts(id INTEGER PRIMARY KEY AUTOINCREMENT,case_id TEXT NOT NULL REFERENCES ap_cases(id) ON DELETE CASCADE,source_revision INTEGER NOT NULL,body TEXT NOT NULL,created TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ap_decisions(id INTEGER PRIMARY KEY AUTOINCREMENT,case_id TEXT NOT NULL REFERENCES ap_cases(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,revision INTEGER NOT NULL,content TEXT NOT NULL,created TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ap_suppression(source_key TEXT PRIMARY KEY,created TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ap_receipts(id TEXT PRIMARY KEY,created TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS ap_case_sources ON ap_sources(case_id);
      CREATE INDEX IF NOT EXISTS ap_case_notes ON ap_notes(case_id,id);`);
    if(!store.get('ap:settings')) store.set('ap:settings',{observing:false,autoReview:false,includeDrafts:false,historyDays:30,retentionDays:30,phoneWebhook:false,consentAt:null});
    for(const r of TEAM)if(!store.get(`ap:agent:${r.id}`))store.set(`ap:agent:${r.id}`,{paused:false});
    this.db.prepare("UPDATE ap_jobs SET status='blocked',updated=? WHERE status='running'").run(stamp());
    this.db.prepare("UPDATE ap_cases SET status='blocked',reason='Server restarted during shared review. Previous contributions are retained; review and retry.',updated=? WHERE status='working'").run(stamp());
  }
  settings(){return this.store.get('ap:settings');}
  pack(value,practice){const text=JSON.stringify(value);return practice?'json:'+text:'enc:'+this.integrations.encrypt(text);}
  unpack(value){if(!value)return '';return JSON.parse(value.startsWith('enc:')?this.integrations.decrypt(value.slice(4)):value.slice(5));}
  needPrivate(){if(!this.integrations.env.OWNER_PASSWORD)throw new OfficeError('Private owner authentication is required for real conversations.',403);this.integrations.encrypt('storage-check');}
  event(action){this.store.event(null,'owner',action,'Private apprenticeship record updated. No customer action performed.');}
  row(id){const c=this.db.prepare('SELECT * FROM ap_cases WHERE id=?').get(id);if(!c||c.status==='deleted')throw new OfficeError('Case not found.',404);return c;}
  checked(id,revision){const c=this.row(id);if(!Number.isInteger(revision)||c.revision!==revision)throw new OfficeError('This case changed. Reload before acting.',409);return c;}
  list(limit=40,offset=0){return this.db.prepare("SELECT * FROM ap_cases WHERE status!='deleted' ORDER BY updated DESC LIMIT ? OFFSET ?").all(limit,offset).map(c=>({...c,title:this.unpack(c.title),draft:undefined,practice:!!c.practice}));}
  detail(id){const c=this.row(id);return {...c,title:this.unpack(c.title),practice:!!c.practice,draft:this.unpack(c.draft),sources:this.sources(id),notes:this.notes(id),
    jobs:this.db.prepare('SELECT id,target,status,source_revision,created,updated FROM ap_jobs WHERE case_id=? ORDER BY created DESC LIMIT 30').all(id),
    lessons:this.lessons(id),draftHistory:this.db.prepare('SELECT * FROM ap_drafts WHERE case_id=? ORDER BY id DESC LIMIT 20').all(id).map(x=>({...x,body:this.unpack(x.body)})),decisions:this.db.prepare('SELECT * FROM ap_decisions WHERE case_id=? ORDER BY id DESC LIMIT 30').all(id).map(x=>({...x,content:this.unpack(x.content)}))};}
  sources(id){return this.db.prepare('SELECT * FROM ap_sources WHERE case_id=? ORDER BY created,id').all(id).map(x=>({...x,payload:this.unpack(x.payload)}));}
  notes(id){return this.db.prepare('SELECT * FROM ap_notes WHERE case_id=? ORDER BY id DESC LIMIT 120').all(id).reverse().map(x=>({...x,body:this.unpack(x.body),evidence:JSON.parse(x.evidence)}));}
  lessons(caseId){const rows=caseId?this.db.prepare('SELECT * FROM ap_lessons WHERE case_id=? ORDER BY created DESC').all(caseId):this.db.prepare('SELECT * FROM ap_lessons ORDER BY updated DESC LIMIT 100').all();return rows.map(x=>({...x,title:this.unpack(x.title),body:this.unpack(x.body)}));}
  create({key,title,lead,practice=false}){
    member(lead);if(!practice)this.needPrivate();
    const sourceKey=digest(key);if(this.db.prepare('SELECT 1 FROM ap_suppression WHERE source_key=?').get(sourceKey))return null;
    const old=this.db.prepare("SELECT id FROM ap_cases WHERE source_key=? AND status!='deleted'").get(sourceKey);if(old)return this.row(old.id);
    if(this.db.prepare("SELECT COUNT(*) AS n FROM ap_cases WHERE status!='deleted'").get().n>=1000)throw new OfficeError('Case storage limit reached. Review retention before importing more.',429);
    const id=randomUUID(),t=stamp();this.db.prepare('INSERT INTO ap_cases(id,source_key,title,lead,practice,created,updated) VALUES(?,?,?,?,?,?,?)').run(id,sourceKey,this.pack(requireText(title,'Case title',160),practice),lead,+practice,t,t);return this.row(id);
  }
  ingest(caseId,{key,kind,payload,fingerprint}){
    const c=this.row(caseId),sourceKey=digest(key);
    if(this.db.prepare('SELECT 1 FROM ap_suppression WHERE source_key=?').get(sourceKey))return false;
    const old=this.db.prepare('SELECT * FROM ap_sources WHERE source_key=?').get(sourceKey);
    if(old&&old.case_id!==caseId)throw new OfficeError('Conversation source is already attached to another case.',409);
    const clean=JSON.parse(JSON.stringify(payload,(k,v)=>typeof v==='string'?redact(v):v));
    const fp=digest(fingerprint??JSON.stringify(clean));
    if(old&&kind==='phone'){const prior=this.unpack(old.payload);if(prior.correctedBy==='owner'){if(prior.providerFingerprint===fp)return false;throw new OfficeError('This transcript was corrected by the owner. Review the new provider version manually instead of overwriting the correction.',409);}}
    if(old && kind==='email' && old.fingerprint===fp){const prior=this.unpack(old.payload);if(prior.humanConfirmed){clean.humanConfirmed=true;clean.humanAuthor=prior.humanAuthor;clean.confirmedAt=prior.confirmedAt;}}
    if(!old&&this.db.prepare('SELECT COUNT(*) AS n FROM ap_sources WHERE case_id=?').get(caseId).n>=250)throw new OfficeError('This conversation reached its source limit. Split it deliberately before continuing.',429);
    const id=old?.id||randomUUID(),t=stamp();
    this.db.prepare('INSERT INTO ap_sources VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(source_key) DO UPDATE SET fingerprint=excluded.fingerprint,payload=excluded.payload,updated=excluded.updated').run(id,caseId,sourceKey,kind,fp,this.pack(clean,c.practice),old?.created||t,t);
    if(!old||old.fingerprint!==fp){this.db.prepare("UPDATE ap_cases SET revision=revision+1,status='open',draft='',draft_revision=NULL,reason='',updated=? WHERE id=?").run(t,caseId);this.store.changed();return true;}
    return false;
  }
  note(id,author,recipient,kind,body,evidence=[]){
    const c=this.row(id);if(author!=='owner'&&author!=='system')member(author);if(recipient!=='team'&&recipient!=='owner')member(recipient);
    const valid=new Set(this.sources(id).map(s=>s.id));if(!Array.isArray(evidence)||evidence.some(x=>!valid.has(x)))throw new OfficeError('Evidence must belong to this case.');
    this.db.prepare('INSERT INTO ap_notes(case_id,author,recipient,kind,body,evidence,created) VALUES(?,?,?,?,?,?,?)').run(id,author,recipient,kind,this.pack(redact(requireText(body,'Internal message',18000)),c.practice),JSON.stringify(evidence),stamp());this.db.prepare('UPDATE ap_cases SET updated=? WHERE id=?').run(stamp(),id);this.store.changed();
  }
  enqueue(id,{revision,target='team',question='Review this conversation together. Identify missing facts and disagreements; prepare one response for owner review.'}={}){
    const c=this.checked(id,revision);if(target!=='team')member(target);
    if(this.db.prepare("SELECT 1 FROM ap_jobs WHERE case_id=? AND status IN ('queued','running')").get(id))throw new OfficeError('This case already has queued or running teamwork.',409);
    if(!this.sources(id).length)throw new OfficeError('Attach source evidence before asking the team to review.');
    if(this.db.prepare("SELECT COUNT(*) AS n FROM ap_jobs WHERE status='queued'").get().n>=100)throw new OfficeError('Review existing queued casework before adding more.',429);
    const job=randomUUID(),t=stamp();this.db.prepare('INSERT INTO ap_jobs VALUES(?,?,?,?,?,?,?,?)').run(job,id,target,'queued',c.revision,this.pack(requireText(question,'Question',2000),c.practice),t,t);
    this.note(id,'owner',target,'request',question);
    this.db.prepare("UPDATE ap_cases SET status='queued',reason='',updated=? WHERE id=?").run(t,id);return job;
  }
  propose(id,{title,body,revision}){
    const c=this.checked(id,revision),lesson=randomUUID(),t=stamp();
    if(this.lessons(id).filter(l=>l.status==='pending').length>=12)throw new OfficeError('Review the pending lessons before adding more.',429);
    this.db.prepare('INSERT INTO ap_lessons(id,case_id,title,body,status,source_revision,created,updated) VALUES(?,?,?,?,?,?,?,?)').run(lesson,id,this.pack(requireText(title,'Lesson title',100),c.practice),this.pack(redact(requireText(body,'Lesson',3000)),c.practice),'pending',revision,t,t);
    this.db.prepare('UPDATE ap_cases SET updated=? WHERE id=?').run(t,id);this.event('Learning suggestion prepared');return lesson;
  }
  decideLesson(id,{revision,decision,title,body}){
    const l=this.db.prepare('SELECT * FROM ap_lessons WHERE id=?').get(id);if(!l)throw new OfficeError('Lesson not found.',404);
    const c=this.row(l.case_id);if(l.revision!==revision)throw new OfficeError('Lesson changed. Reload it.',409);
    if(!['approved','exception','rejected','revoked'].includes(decision))throw new OfficeError('Choose approve, exception, reject or revoke.');
    if(decision==='approved'&&c.revision!==l.source_revision)throw new OfficeError('Source changed. Prepare a fresh lesson from the current conversation.',409);
    const name=title??this.unpack(l.title),text=body??this.unpack(l.body);
    if(decision==='approved' && /Replace this candidate with the exact procedure/.test(text))throw new OfficeError('Write the actual lesson before approving it as a procedure.');
    requireText(name,'Lesson title',100);requireText(text,'Lesson',3000);
    this.db.exec('BEGIN IMMEDIATE');
    try{
      let ruleId=l.rule_id;
      if(ruleId)this.db.prepare("UPDATE rules SET status='revoked' WHERE id=?").run(ruleId);
      if(decision==='approved'&&!c.practice){ruleId=this.store.proposeRule(name,redact(text));this.store.approveRule(ruleId);}
      this.db.prepare('UPDATE ap_lessons SET title=?,body=?,status=?,rule_id=?,revision=revision+1,updated=? WHERE id=?').run(this.pack(name,c.practice),this.pack(redact(text),c.practice),decision,ruleId,stamp(),id);
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
    this.db.prepare('UPDATE ap_cases SET updated=? WHERE id=?').run(stamp(),l.case_id);this.event('Learning decision recorded');return {decision,practice:!!c.practice};
  }
  finish(id,revision,draft){const c=this.checked(id,revision);this.db.prepare('INSERT INTO ap_drafts(case_id,source_revision,body,created) VALUES(?,?,?,?)').run(id,revision,this.pack(redact(requireText(draft,'Team draft',18000)),c.practice),stamp());this.db.prepare("UPDATE ap_cases SET status='review',draft=?,draft_revision=?,updated=? WHERE id=?").run(this.pack(redact(requireText(draft,'Team draft',18000)),c.practice),revision,stamp(),id);this.store.changed();}
  approve(id,{revision,draft}){
    const c=this.checked(id,revision);if(c.status!=='review'||c.draft_revision!==revision)throw new OfficeError('No current shared draft is ready.',409);
    const exact=redact(requireText(draft,'Reviewed draft',18000));this.db.prepare('INSERT INTO ap_decisions(case_id,kind,revision,content,created) VALUES(?,?,?,?,?)').run(id,'approved-not-sent',revision,this.pack(exact,c.practice),stamp());
    this.db.prepare("UPDATE ap_cases SET status='approved',draft=?,updated=? WHERE id=?").run(this.pack(exact,c.practice),stamp(),id);this.event('Shared draft approved · not sent');
  }
  remove(id){
    const c=this.row(id);this.db.exec('BEGIN IMMEDIATE');
    try{for(const l of this.lessons(id))if(l.rule_id)this.db.prepare("UPDATE rules SET title='Source removed',body='Source removed. This lesson is no longer available.',status='revoked' WHERE id=?").run(l.rule_id);
      for(const key of [c.source_key,...this.db.prepare('SELECT source_key FROM ap_sources WHERE case_id=?').all(id).map(s=>s.source_key)])this.db.prepare('INSERT OR IGNORE INTO ap_suppression VALUES(?,?)').run(key,stamp());
      this.db.prepare('DELETE FROM ap_cases WHERE id=?').run(id);this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}this.event('Conversation excluded and erased');
  }
  prune(){const cutoff=new Date(Date.now()-this.settings().retentionDays*86400000).toISOString();for(const c of this.db.prepare("SELECT id FROM ap_cases WHERE updated<? AND status NOT IN ('queued','working')").all(cutoff))this.remove(c.id);this.db.prepare('DELETE FROM ap_receipts WHERE created<?').run(new Date(Date.now()-86400000).toISOString());}
  counts(){return Object.fromEntries(this.db.prepare("SELECT status,COUNT(*) AS n FROM ap_cases GROUP BY status").all().map(x=>[x.status,x.n]));}
}
