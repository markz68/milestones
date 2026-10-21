import {validateEvents} from './data.mjs';
export const STATE_SCHEMA=4;
const timestamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
export function validateState(value){
 if(!value||value.app!=='Milestones'||![1,2,3,4].includes(value.schemaVersion))throw Error('Unsupported Milestones backup format.');
 const events=validateEvents(value.events),deleted=value.schemaVersion>=3?value.deleted:[];
 if(!Array.isArray(deleted)||deleted.length>20000)throw Error('Invalid deletion history.');
 const ids=new Set();const clean=deleted.map(x=>{if(!x||typeof x.id!=='string'||!x.id||x.id.length>100||ids.has(x.id)||!timestamp(x.updatedAt))throw Error('Invalid deletion record.');ids.add(x.id);return {id:x.id,updatedAt:x.updatedAt};});
 const state={app:'Milestones',schemaVersion:STATE_SCHEMA,events,deleted:clean};
 return mergeValidated([state]);
}
function stable(x){if(Array.isArray(x))return x.map(stable);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])]));return x;}
export function signature(state){return JSON.stringify(stable(state));}
function mergeValidated(states){
 const map=new Map();
 for(const state of states)for(const [dead,items] of [[false,state.events],[true,state.deleted]])for(const item of items){
  const next={dead,item},old=map.get(item.id),t=Date.parse(item.updatedAt),oldT=old?Date.parse(old.item.updatedAt):-Infinity;
  // Timestamp order; a deletion wins a tie. Equal-time edits have a deterministic tie-break.
  if(!old||t>oldT||(t===oldT&&(dead&&!old.dead||dead===old.dead&&signature(item)>signature(old.item))))map.set(item.id,next);
 }
 const values=[...map.values()].sort((a,b)=>a.item.id<b.item.id?-1:a.item.id>b.item.id?1:0);
 const events=values.filter(x=>!x.dead).map(x=>x.item),deleted=values.filter(x=>x.dead).map(x=>x.item);
 if(events.length>10000||deleted.length>20000)throw Error('Merged data exceeds the event or deletion-history limit.');
 return {app:'Milestones',schemaVersion:STATE_SCHEMA,events,deleted};
}
export function mergeStates(...states){return mergeValidated(states.map(validateState));}
export function fromEvents(events){return validateState({app:'Milestones',schemaVersion:STATE_SCHEMA,events,deleted:[]});}
export function nextTimestamp(state,now=Date.now()){
 const latest=Math.max(0,...state.events.map(e=>Date.parse(e.updatedAt)),...state.deleted.map(e=>Date.parse(e.updatedAt)));
 return new Date(Math.max(now,latest+1)).toISOString();
}
export function editedState(state,next){
 const valid=validateEvents(next),old=new Map(state.events.map(e=>[e.id,e])),stamp=nextTimestamp(state),ids=new Set(valid.map(e=>e.id));
 const withoutTime=e=>({...e,updatedAt:''});
 const events=valid.map(e=>{const previous=old.get(e.id);return previous&&signature(withoutTime(previous))===signature(withoutTime(e))?previous:{...e,updatedAt:stamp};});
 const deleted=[...state.deleted.filter(e=>!ids.has(e.id)),...state.events.filter(e=>!ids.has(e.id)).map(e=>({id:e.id,updatedAt:stamp}))];
 return validateState({app:'Milestones',schemaVersion:STATE_SCHEMA,events,deleted});
}

// This describes only the local snapshot at the last completed sync.
export function syncOverview(state,last,online=true){
 const offline=online?'':'Offline · ';
 if(!last||!Number.isFinite(Date.parse(last.at)))return offline+'Not synced yet · Events saved on this device';
 const when=new Date(last.at).toLocaleString();
 return offline+(signature(validateState(state))===last.signature?'No local changes since last sync':'Local changes need syncing')+' · Last synced '+when;
}
