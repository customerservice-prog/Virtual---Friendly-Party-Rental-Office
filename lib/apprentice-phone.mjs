import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { OfficeError, requireText } from './store.mjs';
import { redact, stamp, digest } from './apprentice-data.mjs';
export function verifyPhoneSignature(raw,headers,secret,now=Date.now()){
  if(typeof secret!=='string'||secret.length<32)throw new OfficeError('Phone transcript intake is not configured.',503);
  const time=String(headers['x-office-timestamp']||''),signature=String(headers['x-office-signature']||'');
  if(!/^\d{10}$/.test(time)||Math.abs(now-Number(time)*1000)>300000||!/^sha256=[a-f0-9]{64}$/.test(signature))throw new OfficeError('Phone transcript signature rejected.',401);
  const expected=createHmac('sha256',secret).update(time+'.').update(raw).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature.slice(7),'hex')))throw new OfficeError('Phone transcript signature rejected.',401);
}
export function validateCall(b){
  if(b.consent?.staff!==true||b.consent?.caller!==true||b.consent?.businessOnly!==true)throw new OfficeError('Confirm staff agreement, caller recording/AI-processing consent, and business-only content.');
  const at=String(b.at||'');if(!Number.isFinite(Date.parse(at))||Date.parse(at)>Date.now()+300000)throw new OfficeError('Enter a valid completed-call date/time.');
  const consentAt=String(b.consent.at||'');if(!Number.isFinite(Date.parse(consentAt))||Date.parse(consentAt)>Date.now()+300000)throw new OfficeError('A dated consent record is required.');
  return {callId:requireText(b.callId,'Call reference',150),trainer:requireText(b.trainer||'Nicole','Staff trainer',100),at,
    message:redact(requireText(b.transcript,'Call transcript',30000)),provider:requireText(b.provider||'Owner import','Source',100),
    consent:{staff:true,caller:true,businessOnly:true,at:consentAt,basis:requireText(b.consent.basis,'Consent basis',500)},
    limitation:'Completed-call transcript. Consent and staff/speaker identity are attested by the importer, not independently verified. This is not live listening.',observedAt:stamp()};
}
export async function transcribeAudio(b,integrations,signal){
  const env=integrations.env;
  validateCall({...b,transcript:'Audio awaiting transcription'});
  if(b.providerConsent!==true||b.sensitiveContentRemoved!==true)throw new OfficeError('Confirm permission to transcribe this recording and remove sensitive content first.');
  if(!env.LOCAL_TRANSCRIBE_URL&&!(env.OPENAI_API_KEY&&env.OPENAI_TRANSCRIBE_MODEL))throw new OfficeError('Configure a private transcription service before uploading audio.');
  const encoded=b.audio;
  if(typeof encoded!=='string'||encoded.length>11200000||encoded.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new OfficeError('Invalid audio payload; maximum file size is 8 MB.');
  const file=Buffer.from(encoded,'base64');if(file.length<16||file.length>8*1024*1024)throw new OfficeError('Audio must contain 16 bytes–8 MB.');
  const head=file.subarray(0,16);let ext;
  if(head.toString('ascii',0,4)==='RIFF'&&head.toString('ascii',8,12)==='WAVE')ext='wav';
  else if(head.toString('ascii',0,3)==='ID3'||(head[0]===255&&(head[1]&224)===224))ext='mp3';
  else if(head.toString('ascii',4,8)==='ftyp')ext='m4a';
  else if(head.toString('hex',0,4)==='1a45dfa3')ext='webm';
  else throw new OfficeError('Upload a WAV, MP3, M4A or WebM recording.');
  signal.throwIfAborted();integrations.store.reserveAI(integrations.aiLimit());
  const boundary='friendly-'+randomUUID(),chunks=[];
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio_file"; filename="business-call.${ext}"\r\nContent-Type: application/octet-stream\r\n\r\n`),file,Buffer.from(`\r\n--${boundary}--\r\n`));
  let text='';
  if(env.LOCAL_TRANSCRIBE_URL){
    const u=new URL(env.LOCAL_TRANSCRIBE_URL);
    if(u.protocol!=='http:'||!u.hostname.endsWith('.railway.internal'))throw new OfficeError('LOCAL_TRANSCRIBE_URL must use Railway private networking.');
    u.pathname='/asr';u.searchParams.set('task','transcribe');u.searchParams.set('language','en');u.searchParams.set('output','json');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
    try{
      const r=await fetch(u,{method:'POST',signal:controller.signal,headers:{'content-type':`multipart/form-data; boundary=${boundary}`},body:Buffer.concat(chunks)});
      const raw=await r.text();let data={};try{data=JSON.parse(raw)}catch{}
      if(!r.ok)throw new OfficeError(`Friendly local transcription returned HTTP ${r.status}.`);
      text=String(data?.text||raw||'').trim();
    }catch(error){if(error.name==='AbortError')throw new OfficeError('Local transcription timed out or was paused.');throw error;}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }else if(env.OPENAI_API_KEY&&env.OPENAI_TRANSCRIBE_MODEL){
    const field=(key,value)=>chunks.unshift(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    field('model',env.OPENAI_TRANSCRIBE_MODEL);
    const diarize=env.OPENAI_TRANSCRIBE_MODEL==='gpt-4o-transcribe-diarize';
    field('response_format',diarize?'diarized_json':'json');if(diarize)field('chunking_strategy','auto');
    const r=await integrations.request('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{authorization:`Bearer ${env.OPENAI_API_KEY}`,'content-type':`multipart/form-data; boundary=${boundary}`},body:Buffer.concat(chunks),signal,maxBytes:1000000,timeoutMs:120000});
    if(r.status!==200)throw new OfficeError('Transcription did not complete.');
    text=diarize?(r.data?.segments||[]).map(s=>`[${Number(s.start)||0}s] Speaker ${String(s.speaker).slice(0,30)}: ${s.text}`).join('\n'):String(r.data?.text||'').trim();
  }
  signal.throwIfAborted();
  if(!text||text.length>30000)throw new OfficeError('Transcript was empty or exceeded the review limit. Split the recording into shorter calls.');
  return {transcript:redact(text),fingerprint:digest(file),limitation:'Machine transcript from the private Friendly transcriber. Verify wording and identify Nicole/customer speaker labels before importing. Raw audio is not saved by the virtual office.'};
}
