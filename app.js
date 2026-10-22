import {todayDate,range,direction,dateLabel,timeLabel,calendarSpan,validDate,nextOccurrence,nextLabel,isUpcoming,primaryLabel} from './dates.mjs';
import {validateEvents,csvText} from './data.mjs';
import {STATE_SCHEMA,validateState,fromEvents,editedState,mergeStates,signature} from './sync-state.mjs';
import {initDriveSync} from './drive-sync.mjs';
const $=id=>document.getElementById(id),KEY='milestones.state.v3',LEGACY='milestones.events.v1',UNDO='milestones.previous.v3',BACKUP='milestones.exported.v1';
let state=fromEvents([]),events=[],editing=null,selected=null,filter='all',blocked=false,timer;
function newId(){return crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');}
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('toast').hidden=true,6000);}
try{
 const stored=localStorage.getItem(KEY);
 if(stored!==null)state=validateState(JSON.parse(stored));
 else{state=fromEvents(JSON.parse(localStorage.getItem(LEGACY)||'[]'));localStorage.setItem(KEY,JSON.stringify(state));try{const oldUndo=localStorage.getItem('milestones.previous.v1');if(oldUndo!==null)localStorage.setItem(UNDO,JSON.stringify(fromEvents(JSON.parse(oldUndo))));}catch{notify('Events were preserved, but the older undo point could not be migrated.');}}
 events=state.events;
}catch{blocked=true;notify('Saved data could not be read. No data has been overwritten. Export or recover your existing data before continuing.');}
function currentState(){if(blocked)throw Error('Saving and syncing are paused because local data could not be read.');return validateState(JSON.parse(localStorage.getItem(KEY)));}
function persist(next){
 if(blocked)throw Error('Saving is paused because existing data could not be read.');
 const valid=validateState(next),old=localStorage.getItem(KEY);localStorage.setItem(UNDO,old||JSON.stringify(fromEvents([])));localStorage.setItem(KEY,JSON.stringify(valid));
 state=valid;events=state.events;render();window.dispatchEvent(new Event('milestones-changed'));
}
function save(next){const current=currentState();if(signature(current)!==signature(state))throw Error('Another tab changed these events. Close this editor and reload before saving.');persist(editedState(current,next));}
function text(tag,value,cls){const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;}
function eventIcon(value,cls){
 const el=text('span',value==='rings'?'':value||'◷',cls);
 if(value==='rings'){
  el.setAttribute('aria-label','Wedding rings');
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 48 36');svg.setAttribute('width','1.5em');svg.setAttribute('height','1.2em');svg.setAttribute('aria-hidden','true');
  for(const cx of [17,31]){const circle=document.createElementNS(ns,'circle');for(const [k,v] of Object.entries({cx,cy:19,r:12,fill:'none',stroke:'#b48225','stroke-width':3}))circle.setAttribute(k,String(v));svg.append(circle);}
  el.append(svg);
 }
 return el;
}
function precisionNote(e){if(e.precision==='annual')return 'Repeats annually · no start year';return e.precision==='day'?'Exact date':e.precision==='month'?'Exact day unknown':'Exact month and day unknown';}
function distance(e,now){const r=range(nextOccurrence(e,now));return now<r.start?r.start-now:now>r.end?now-r.end:0;}
function render(){const now=todayDate();$('today').textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
 $('count-all').textContent=events.length;$('count-past').textContent=events.filter(e=>direction(e,now)==='past').length;$('count-upcoming').textContent=events.filter(e=>isUpcoming(e,now)).length;
 const categories=[...new Set(events.map(e=>e.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 const categorySelect=$('category-filter'),chosenCategory=categorySelect.value;
 const options=[['','All categories'],['uncategorized','Uncategorized'],...categories.map(c=>['category:'+c,c])];
 // Preserve the selection if its last event was edited or deleted, so it can show an empty result.
 if(chosenCategory.startsWith('category:')&&!options.some(([value])=>value===chosenCategory))options.push([chosenCategory,chosenCategory.slice(9)]);
 categorySelect.replaceChildren(...options.map(([value,label])=>{const o=text('option',label);o.value=value;return o;}));categorySelect.value=chosenCategory;
 const query=$('search').value.trim().toLocaleLowerCase(),sort=$('sort').value;

 const shown=events.filter(e=>(!chosenCategory||(chosenCategory==='uncategorized'?!e.category:'category:'+e.category===chosenCategory))&&(filter==='all'||(filter==='past'?direction(e,now)==='past':isUpcoming(e,now)))&&[e.title,e.category,e.notes,e.source,e.date].some(s=>s.toLocaleLowerCase().includes(query))).sort((a,b)=>{
  if(a.pinned!==b.pinned)return a.pinned?-1:1;
  if(sort==='name')return a.title.localeCompare(b.title);
  if(sort==='oldest')return range(a).start-range(b).start;
  if(sort==='newest')return range(b).start-range(a).start;
  return distance(a,now)-distance(b,now)||a.title.localeCompare(b.title);
 });
 $('empty').hidden=events.length>0;$('no-results').hidden=!events.length||shown.length>0;$('event-list').replaceChildren();
 for(const e of shown){const row=text('button','','event-row');row.type='button';row.append(eventIcon(e.icon,'event-icon'));const name=text('span','','event-text');name.append(text('span',(e.pinned?'★ ':'')+e.title,'event-title'),text('span',dateLabel(e)+(['month','year'].includes(e.precision)?' · Approximate':'')+(e.category?' · '+e.category:''),'event-meta'));const time=text('span','','event-time');time.append(text('strong',primaryLabel(e,now)),text('small',e.precision==='annual'?'Annual countdown':e.precision==='day'?(direction(e,now)==='current'?'The day is here':direction(e,now)==='past'?'Time since':'Time until'):'Approximate date'));if(e.repeat==='origin'||e.repeat==='annual')time.append(text('small',nextLabel(e,now),'next-occurrence'));row.append(name,time,text('span','›','chevron'));row.addEventListener('click',()=>showDetails(e.id));$('event-list').append(row);}
 $('categories').replaceChildren(...[...new Set(events.map(e=>e.category).filter(Boolean))].sort().map(v=>{const o=document.createElement('option');o.value=v;return o;}));
 try{const last=localStorage.getItem(BACKUP);$('backup-status').textContent=last?'Backup download requested '+new Date(last).toLocaleDateString():'No backup exported yet';$('undo').disabled=blocked||localStorage.getItem(UNDO)===null;}catch{$('backup-status').textContent='Browser storage unavailable';}
}
function showDetails(id){const e=events.find(x=>x.id===id);if(!e)return;selected=id;const box=$('detail-content');box.replaceChildren(eventIcon(e.icon,'large-icon'),text('h2',e.title),text('p',dateLabel(e)+' · '+precisionNote(e)),text('p',primaryLabel(e),'big-time'));
 const block=(heading,value)=>{const div=text('div','','detail-block');div.append(text('h3',heading),text('p',value));box.append(div);};
 if(e.repeat==='origin'||e.repeat==='annual'){block('Next annual event',nextLabel(e));if(e.date.endsWith('02-29'))block('Leap-day rule','In non-leap years, this event is observed on February 28.');}
 if(e.precision==='day')block('Total days',calendarSpan(range(e).start,todayDate()).totalDays.toLocaleString()+' days '+(direction(e)==='past'?'since this event':direction(e)==='upcoming'?'until this event':'· today'));
 else if(e.precision!=='annual'){const r=range(e),label=x=>x.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});block('Date certainty',`Some time between ${label(r.start)} and ${label(r.end)}. The elapsed or remaining time is approximate.`);}
 if(e.category)block('Category',e.category);if(e.notes)block('Notes',e.notes);if(e.source)block('Date source',e.source);
 block('Event type',({general:'General milestone',birthday:'Birthday',wedding:'Wedding / marriage',anniversary:'Other anniversary',holiday:'Holiday'})[e.eventType||'general']);
 block('Last edited',new Date(e.updatedAt).toLocaleString());$('details').showModal();
}
function setPrecision(){const annual=$('repeat').value==='annual',p=$('precision').value;
 $('original-date-fields').hidden=annual;$('annual-fields').hidden=!annual;
 for(const name of ['day','month','year']){$(`${name}-wrap`).hidden=p!==name;$(`date-${name}`).required=!annual&&p===name;$(`date-${name}`).disabled=annual||p!==name;}
 for(const id of ['annual-month','annual-day']){$(id).required=annual;$(id).disabled=!annual;}
 $('repeat-hint').textContent=$('repeat').value==='origin'?'One event keeps your original date and time since, plus the countdown to its next anniversary.':'Keep the original date and track time before or since it.';
 if(annual)$('repeat-hint').textContent='Choose a month and day. No invented start year or age.';
 $('precision-hint').textContent=annual?'Repeats every year. February 29 is observed on February 28 in non-leap years.':$('repeat').value==='origin'?(p==='year'?'A month is needed for an annual countdown. Choose month and year, or keep this as a one-time milestone.':p==='month'?'The next anniversary month is approximate because the exact day is unknown.':'Tracks time since the original date and the next annual occurrence. February 29 uses February 28 in non-leap years.'):(p==='day'?'The event counts down before its date and counts up afterward.':'We keep the date exactly as you know it and label the time as approximate.');
}
const monthNames=Array.from({length:12},(_,i)=>new Date(2000,i,1).toLocaleDateString('en-US',{month:'long'}));
$('annual-month').replaceChildren(...monthNames.map((name,i)=>{const o=text('option',name);o.value=String(i+1).padStart(2,'0');return o;}));
function openEditor(id=null){editing=id;$('event-form').reset();$('form-error').textContent='';$('editor-title').textContent=id?'Edit event':'Add an event';if(id){const e=events.find(x=>x.id===id);$('event-type').value=e.eventType||'general';for(const key of ['title','category','notes','source'])$(key).value=e[key];$('icon').value=e.icon||'◷';if(!$('icon').value)$('icon').value='◷';$('precision').value=e.precision==='annual'?'day':e.precision;$('repeat').value=e.repeat||'none';if(e.precision==='annual'){const [m,d]=e.date.split('-');$('annual-month').value=m;$('annual-day').value=Number(d);}else{$(`date-${e.precision}`).value=e.date;}$('pinned').checked=e.pinned;}setPrecision();$('editor').showModal();$('title').focus();}
for(const id of ['add','first-add'])$(id).addEventListener('click',()=>openEditor());
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$('precision').addEventListener('change',setPrecision);$('repeat').addEventListener('change',setPrecision);
$('event-form').addEventListener('submit',evt=>{evt.preventDefault();try{const repeat=$('repeat').value,p=repeat==='annual'?'annual':$('precision').value,date=p==='annual'?$('annual-month').value+'-'+String($('annual-day').value).padStart(2,'0'):$(`date-${p}`).value;if(!validDate(date,p))throw new Error(p==='annual'?'Enter a valid month and day.':'Enter a valid date between years 1000 and 9999.');const e={id:editing||newId(),title:$('title').value.trim(),precision:p,date,repeat,eventType:$('event-type').value,category:$('category').value.trim(),notes:$('notes').value.trim(),source:$('source').value.trim(),icon:$('icon').value,pinned:$('pinned').checked,updatedAt:new Date().toISOString()};save(editing?events.map(x=>x.id===editing?e:x):[...events,e]);$('editor').close();notify('Event saved on this device.');}catch(error){$('form-error').textContent='Could not save: '+error.message;}});
$('edit').addEventListener('click',()=>{$('details').close();openEditor(selected);});
let deleting=null;
$('delete').addEventListener('click',()=>{
 const e=events.find(x=>x.id===selected);if(!e)return;
 deleting={id:e.id,updatedAt:e.updatedAt};$('delete-name').textContent=e.title;$('delete-date').textContent=dateLabel(e)+' · '+precisionNote(e);$('delete-category').textContent=e.category||'Uncategorized';$('delete-confirm').showModal();
});
$('cancel-delete').addEventListener('click',()=>$('delete-confirm').close());
$('delete-confirm').addEventListener('close',()=>{deleting=null;});
$('confirm-delete').addEventListener('click',()=>{
 if(!deleting)return;
 try{
  const target=deleting,e=events.find(x=>x.id===target.id);
  if(!e||e.updatedAt!==target.updatedAt)throw Error('This event changed. Close and reopen its details before deleting.');
  save(events.filter(x=>x.id!==target.id));$('delete-confirm').close();$('details').close();notify('Event deleted. Previous local state is available under Backup & Sync → Advanced recovery.');
 }catch(error){$('delete-confirm').close();notify('Could not delete: '+error.message);}
});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b));});render();}));
$('category-filter').addEventListener('change',render);$('search').addEventListener('input',render);$('sort').addEventListener('change',render);
$('drive-dialog').addEventListener('milestones-panel-open',()=>{$('backup-error').textContent='';render();});
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function stamp(){return new Date().toISOString().replaceAll(':','-').replace(/\.\d+Z$/,'Z');}
$('export-json').addEventListener('click',()=>{try{if(blocked){download(localStorage.getItem(KEY)||localStorage.getItem(LEGACY)||'','milestones-unreadable-data.txt','text/plain');notify('Raw stored data download requested.');return;}download(JSON.stringify({app:'Milestones',schemaVersion:STATE_SCHEMA,exportedAt:new Date().toISOString(),events,deleted:state.deleted},null,2),`milestones-backup-${stamp()}.json`,'application/json');try{localStorage.setItem(BACKUP,new Date().toISOString());}catch{}render();notify('Backup download requested. Check that the file was saved.');}catch(error){$('backup-error').textContent=error.message;}});
$('export-csv').addEventListener('click',()=>download(csvText(events),`milestones-${stamp()}.csv`,'text/csv;charset=utf-8'));
$('import-json').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async evt=>{const file=evt.target.files[0];if(!file)return;try{if(file.size>20*1024*1024)throw new Error('Backup is larger than the 20 MB limit.');const incoming=validateState(JSON.parse(await file.text()));if(!confirm(`Import ${incoming.events.length} events? Missing events will be added. Newer edits and saved deletions win for matching IDs.`))return;persist(mergeStates(currentState(),incoming));$('backup-error').textContent='';notify('Backup imported. '+events.length+' events saved on this device.');}catch(error){$('backup-error').textContent='Import failed: '+error.message;}finally{evt.target.value='';}});
$('recover-legacy').addEventListener('click',()=>{
 try{
  const raw=localStorage.getItem(LEGACY);if(raw===null){$('backup-error').textContent='No older local copy was found in this browser. Import your saved JSON backup instead.';return;}
  const older=fromEvents(JSON.parse(raw)),current=currentState(),merged=mergeStates(current,older);
  if(signature(current)===signature(merged)){$('backup-error').textContent=`Older local copy checked (${older.events.length} events). No additional events to recover. If an event is still missing, import your JSON backup from the device that had it.`;return;}
  if(!confirm(`The older local copy contains ${older.events.length} events. Current: ${current.events.length}. After merging: ${merged.events.length}.\n\nMerge this older copy? Newer edits and recorded deletions are preserved.`))return;
  persist(merged);$('backup-error').textContent='';notify('Older local copy merged. Export a fresh JSON backup after checking your events.');
 }catch(error){$('backup-error').textContent='Recovery stopped: '+error.message+' Your JSON backup can be imported instead.';}
});
$('undo').addEventListener('click',()=>{try{const raw=localStorage.getItem(UNDO);if(raw===null)return;const previous=validateState(JSON.parse(raw));if(!confirm(`Restore the previous local state (${previous.events.length} events)? Export your current events first if needed.`))return;save(previous.events);notify('Previous local state restored.');}catch(error){$('backup-error').textContent='Restore failed: '+error.message;}});
window.addEventListener('storage',evt=>{if(evt.key===KEY){try{if(evt.newValue===null)throw Error('Local storage removed');state=validateState(JSON.parse(evt.newValue));events=state.events;blocked=false;document.querySelectorAll('dialog[open]').forEach(d=>d.close());render();window.dispatchEvent(new Event('milestones-changed'));notify('Updated from another tab.');}catch{blocked=true;notify('Another tab wrote unreadable data. Saving has been paused.');}}});
initDriveSync({getLocal:currentState,applyLocal:next=>{document.querySelectorAll('dialog[open]').forEach(d=>{if(d.id!=='drive-dialog')d.close();});persist(mergeStates(next,currentState()));}});
render();setInterval(()=>{render();if($('details').open&&!$('delete-confirm').open){$('details').close();showDetails(selected);}},60000);
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
