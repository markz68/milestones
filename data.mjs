import {validDate} from './dates.mjs';
export const SCHEMA=2;
export function validateEvents(list){
 if(!Array.isArray(list)||list.length>10000)throw new Error('Expected an event list with at most 10,000 events.');
 const ids=new Set();return list.map(e=>{
  if(!e||typeof e!=='object'||typeof e.id!=='string'||!e.id||e.id.length>100||ids.has(e.id))throw new Error('An event has an invalid or duplicate ID.');ids.add(e.id);
  if(typeof e.title!=='string'||!e.title.trim()||e.title.length>120||typeof e.date!=='string'||!validDate(e.date,e.precision))throw new Error('An event has an invalid title or date. No changes were made.');
  const repeat=e.repeat??'none';
  if(!['none','origin','annual'].includes(repeat)||(repeat==='annual')!==(e.precision==='annual')||(repeat==='origin'&&!['day','month'].includes(e.precision)))throw new Error('Annual events need a month and day, or an original month and year. Year-only events cannot repeat until a month is known.');
  const eventType=e.eventType??'general';if(!['general','birthday','wedding','anniversary','holiday'].includes(eventType))throw Error('Invalid event type.');
  const out={eventType,repeat,id:e.id,title:e.title.trim(),date:e.date,precision:e.precision,pinned:!!e.pinned};
  for(const [k,max] of Object.entries({notes:5000,source:1000,category:50,icon:20})){if(e[k]!=null&&(typeof e[k]!=='string'||e[k].length>max))throw new Error(`Invalid ${k} in an event.`);out[k]=e[k]||'';}
  if(typeof e.updatedAt!=='string'||!Number.isFinite(Date.parse(e.updatedAt)))throw new Error('An event has an invalid edit timestamp.');out.updatedAt=e.updatedAt;return out;
 });
}
export function readBackup(obj){if(!obj||obj.app!=='Milestones'||![1,SCHEMA].includes(obj.schemaVersion))throw new Error('This is not a supported Milestones JSON backup.');return validateEvents(obj.events);}
export function mergeEvents(current,incoming){const map=new Map(current.map(e=>[e.id,e]));for(const e of incoming){const old=map.get(e.id);if(!old||Date.parse(e.updatedAt)>Date.parse(old.updatedAt))map.set(e.id,e);}return validateEvents([...map.values()]);}
export function csvText(events){const keys=['title','date','precision','repeat','eventType','category','notes','source','pinned','updatedAt','id'];const cell=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return '\uFEFF'+[keys,...events.map(e=>keys.map(k=>e[k]))].map(row=>row.map(cell).join(',')).join('\r\n');}
