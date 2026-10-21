import {todayDate,range,direction,dateLabel,timeLabel,calendarSpan,validDate} from './dates.mjs';
import {SCHEMA,validateEvents,readBackup,mergeEvents,csvText} from './data.mjs';
const $=id=>document.getElementById(id),KEY='milestones.events.v1',UNDO='milestones.previous.v1',BACKUP='milestones.exported.v1';
let events=[],editing=null,selected=null,filter='all',blocked=false,timer;
function newId(){return crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');}
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('toast').hidden=true,6000);}
try{const stored=localStorage.getItem(KEY);if(stored!==null)events=validateEvents(JSON.parse(stored));}catch{blocked=true;notify('Saved data could not be read. No data has been overwritten. Export or recover your existing data before continuing.');}
function save(next){if(blocked)throw new Error('Saving is disabled because existing data could not be read. Export the stored data before repairing storage.');const valid=validateEvents(next),old=localStorage.getItem(KEY);localStorage.setItem(UNDO,old??'[]');localStorage.setItem(KEY,JSON.stringify(valid));events=valid;render();}
function text(tag,value,cls){const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;}
function precisionNote(e){return e.precision==='day'?'Exact date':e.precision==='month'?'Exact day unknown':'Exact month and day unknown';}
function distance(e,now){const r=range(e);return now<r.start?r.start-now:now>r.end?now-r.end:0;}
function render(){const now=todayDate();$('today').textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
 $('count-all').textContent=events.length;$('count-past').textContent=events.filter(e=>direction(e,now)==='past').length;$('count-upcoming').textContent=events.filter(e=>direction(e,now)!=='past').length;
 const query=$('search').value.trim().toLocaleLowerCase(),sort=$('sort').value;
 const shown=events.filter(e=>(filter==='all'||(filter==='past'?direction(e,now)==='past':direction(e,now)!=='past'))&&[e.title,e.category,e.notes,e.source,e.date].some(s=>s.toLocaleLowerCase().includes(query))).sort((a,b)=>{
  if(a.pinned!==b.pinned)return a.pinned?-1:1;
  if(sort==='name')return a.title.localeCompare(b.title);
  if(sort==='oldest')return range(a).start-range(b).start;
  if(sort==='newest')return range(b).start-range(a).start;
  return distance(a,now)-distance(b,now)||a.title.localeCompare(b.title);
 });
 $('empty').hidden=events.length>0;$('no-results').hidden=!events.length||shown.length>0;$('event-list').replaceChildren();
 for(const e of shown){const row=text('button','','event-row');row.type='button';row.append(text('span',e.icon||'◷','event-icon'));const name=text('span','','event-text');name.append(text('span',(e.pinned?'★ ':'')+e.title,'event-title'),text('span',dateLabel(e)+(e.precision!=='day'?' · Approximate':'')+(e.category?' · '+e.category:''),'event-meta'));const time=text('span','','event-time');time.append(text('strong',timeLabel(e,now)),text('small',e.precision==='day'?(direction(e,now)==='current'?'The day is here':direction(e,now)==='past'?'Time since':'Time until'):'Approximate date'));row.append(name,time,text('span','›','chevron'));row.addEventListener('click',()=>showDetails(e.id));$('event-list').append(row);}
 $('categories').replaceChildren(...[...new Set(events.map(e=>e.category).filter(Boolean))].sort().map(v=>{const o=document.createElement('option');o.value=v;return o;}));
 try{const last=localStorage.getItem(BACKUP);$('backup-status').textContent=last?'Backup download requested '+new Date(last).toLocaleDateString():'No backup exported yet';$('undo').disabled=blocked||localStorage.getItem(UNDO)===null;}catch{$('backup-status').textContent='Browser storage unavailable';}
}
function showDetails(id){const e=events.find(x=>x.id===id);if(!e)return;selected=id;const box=$('detail-content');box.replaceChildren(text('span',e.icon||'◷','large-icon'),text('h2',e.title),text('p',dateLabel(e)+' · '+precisionNote(e)),text('p',timeLabel(e),'big-time'));
 const block=(heading,value)=>{const div=text('div','','detail-block');div.append(text('h3',heading),text('p',value));box.append(div);};
 if(e.precision==='day')block('Total days',calendarSpan(range(e).start,todayDate()).totalDays.toLocaleString()+' days '+(direction(e)==='past'?'since this event':direction(e)==='upcoming'?'until this event':'· today'));
 else{const r=range(e),label=x=>x.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});block('Date certainty',`Some time between ${label(r.start)} and ${label(r.end)}. The elapsed or remaining time is approximate.`);}
 if(e.category)block('Category',e.category);if(e.notes)block('Notes',e.notes);if(e.source)block('Date source',e.source);
 block('Last edited',new Date(e.updatedAt).toLocaleString());$('details').showModal();
}
function setPrecision(){const p=$('precision').value;for(const name of ['day','month','year']){$(`${name}-wrap`).hidden=p!==name;$(`date-${name}`).required=p===name;}$('precision-hint').textContent=p==='day'?'The event counts down before its date and counts up afterward.':'We keep the date exactly as you know it and label the time as approximate.';}
function openEditor(id=null){editing=id;$('event-form').reset();$('form-error').textContent='';$('editor-title').textContent=id?'Edit event':'Add an event';if(id){const e=events.find(x=>x.id===id);for(const key of ['title','category','notes','source','precision'])$(key).value=e[key];$('icon').value=e.icon||'◷';if(!$('icon').value)$('icon').value='◷';$(`date-${e.precision}`).value=e.date;$('pinned').checked=e.pinned;}setPrecision();$('editor').showModal();$('title').focus();}
for(const id of ['add','first-add'])$(id).addEventListener('click',()=>openEditor());
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$('precision').addEventListener('change',setPrecision);
$('event-form').addEventListener('submit',evt=>{evt.preventDefault();try{const p=$('precision').value,date=$(`date-${p}`).value;if(!validDate(date,p))throw new Error('Enter a valid date between years 1000 and 9999.');const e={id:editing||newId(),title:$('title').value.trim(),precision:p,date,category:$('category').value.trim(),notes:$('notes').value.trim(),source:$('source').value.trim(),icon:$('icon').value,pinned:$('pinned').checked,updatedAt:new Date().toISOString()};save(editing?events.map(x=>x.id===editing?e:x):[...events,e]);$('editor').close();notify('Event saved on this device.');}catch(error){$('form-error').textContent='Could not save: '+error.message;}});
$('edit').addEventListener('click',()=>{$('details').close();openEditor(selected);});
$('delete').addEventListener('click',()=>{const e=events.find(x=>x.id===selected);if(!confirm(`Delete “${e.title}”? You can restore the previous local state until your next change.`))return;try{save(events.filter(x=>x.id!==selected));$('details').close();notify('Event deleted. Previous local state is available in Backup & restore.');}catch(error){notify('Could not delete: '+error.message);}});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b));});render();}));
$('search').addEventListener('input',render);$('sort').addEventListener('change',render);
$('backup').addEventListener('click',()=>{$('backup-error').textContent='';render();$('backups').showModal();});
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function stamp(){return new Date().toISOString().replaceAll(':','-').replace(/\.\d+Z$/,'Z');}
$('export-json').addEventListener('click',()=>{try{if(blocked){download(localStorage.getItem(KEY)||'','milestones-unreadable-data.txt','text/plain');notify('Raw stored data download requested.');return;}download(JSON.stringify({app:'Milestones',schemaVersion:SCHEMA,exportedAt:new Date().toISOString(),events},null,2),`milestones-backup-${stamp()}.json`,'application/json');try{localStorage.setItem(BACKUP,new Date().toISOString());}catch{}render();notify('Backup download requested. Check that the file was saved.');}catch(error){$('backup-error').textContent=error.message;}});
$('export-csv').addEventListener('click',()=>download(csvText(events),`milestones-${stamp()}.csv`,'text/csv;charset=utf-8'));
$('import-json').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async evt=>{const file=evt.target.files[0];if(!file)return;try{if(file.size>20*1024*1024)throw new Error('Backup is larger than the 20 MB limit.');const incoming=readBackup(JSON.parse(await file.text()));if(!confirm(`Import ${incoming.length} events? Missing events will be added. Matching IDs use the newer edited copy.`))return;const merged=mergeEvents(events,incoming);save(merged);$('backup-error').textContent='';notify('Backup imported. '+events.length+' events saved on this device.');}catch(error){$('backup-error').textContent='Import failed: '+error.message;}finally{evt.target.value='';}});
$('undo').addEventListener('click',()=>{try{const raw=localStorage.getItem(UNDO);if(raw===null)return;const previous=validateEvents(JSON.parse(raw));if(!confirm(`Restore the previous local state (${previous.length} events)? Export your current events first if needed.`))return;save(previous);notify('Previous local state restored.');}catch(error){$('backup-error').textContent='Restore failed: '+error.message;}});
window.addEventListener('storage',evt=>{if(evt.key===KEY){try{events=evt.newValue===null?[]:validateEvents(JSON.parse(evt.newValue));blocked=false;document.querySelectorAll('dialog[open]').forEach(d=>d.close());render();notify('Updated from another tab.');}catch{blocked=true;notify('Another tab wrote unreadable data. Saving has been paused.');}}});
render();setInterval(()=>{render();if($('details').open){$('details').close();showDetails(selected);}},60000);
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
