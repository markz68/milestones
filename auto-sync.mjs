import {validateState,signature} from './sync-state.mjs';
function records(state){const s=validateState(state);return new Map([...s.events.map(e=>[e.id,{event:e}]),...s.deleted.map(e=>[e.id,{deleted:e}])]);}
export function syncReviewReason(local,remote,baseline){
 local=validateState(local);remote=validateState(remote);
 if(signature(local)===signature(remote))return '';
 if(!baseline)return local.events.length+local.deleted.length&&remote.events.length+remote.deleted.length?'Review the first merge on this device.':'';
 const a=records(local),b=records(remote),base=records(baseline);
 for(const id of new Set([...a.keys(),...b.keys(),...base.keys()])){
  const l=signature(a.get(id)),r=signature(b.get(id)),old=signature(base.get(id));
  // An absent record in a stale snapshot is not a deletion; deletions have records.
  if(a.has(id)&&b.has(id)&&l!==r&&l!==old&&r!==old)return 'The same event changed on both devices. Review the merge.';
 }
 return '';
}
// Single-flight scheduler. Times and timer functions are injectable for deterministic tests.
export function createAutoSync({run,canRun,setTimer=setTimeout,clearTimer=clearTimeout,now=Date.now}){
 let timer=null,busy=false,pending=false,paused=false,enabled=true,due=0,lastStart=-Infinity,failures=0;
 function cancel(){if(timer!==null)clearTimer(timer);timer=null;}
 function arm(){
  cancel();if(!enabled||paused||busy||!pending||!canRun())return;
  const wait=Math.max(0,due-now(),lastStart+15000-now());timer=setTimer(tick,wait);
 }
 async function tick(){
  timer=null;if(!enabled||paused||busy||!pending||!canRun())return;
  pending=false;busy=true;lastStart=now();let result;
  try{result=await run();}catch{result={retry:true};}
  busy=false;
  if(result?.pause){paused=true;pending=true;}
  else if(result?.retry){pending=true;due=now()+Math.min(300000,30000*2**Math.min(failures++,4));}
  else{failures=0;if(result?.pending){pending=true;due=now()+4000;}}
  arm();
 }
 return {
  request(reason='change'){pending=true;const requested=now()+(reason==='change'?4000:500);due=failures?Math.max(due,requested):requested;arm();},
  setEnabled(value){enabled=!!value;if(!enabled)cancel();else{paused=false;pending=true;due=now()+500;arm();}},
  pause(){paused=true;cancel();},
  resume(){paused=false;failures=0;arm();},
  cancel,
  get state(){return {enabled,paused,busy,pending};}
 };
}
