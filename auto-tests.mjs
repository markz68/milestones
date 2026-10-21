import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutoSync,syncReviewReason} from './auto-sync.mjs';
import {fromEvents,editedState,signature,mergeStates} from './sync-state.mjs';
import {syncDrive,DriveStore} from './drive-api.mjs';
const event=(id='one',title='Original',at='2026-01-01T00:00:00Z')=>({id,title,date:'2000-01-01',precision:'day',updatedAt:at});
function clock(){let time=0,id=0;const timers=new Map();return {now:()=>time,setTimer(fn,ms){const key=++id;timers.set(key,{fn,at:time+ms});return key;},clearTimer(key){timers.delete(key);},async advance(ms){const target=time+ms;for(;;){const entry=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;timers.delete(entry[0]);time=entry[1].at;await entry[1].fn();}time=target;},launchNext(){const entry=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];timers.delete(entry[0]);time=entry[1].at;return entry[1].fn();},get size(){return timers.size;}};}
function scheduler(c,run,canRun=()=>true){return createAutoSync({run,canRun,now:c.now,setTimer:c.setTimer,clearTimer:c.clearTimer});}
test('Edits debounce, returning checks throttle, and disabled auto leaves manual control alone',async()=>{
 const c=clock();let calls=0;const a=scheduler(c,async()=>{calls++;});a.request();await c.advance(2000);a.request();await c.advance(3999);assert.equal(calls,0);await c.advance(1);assert.equal(calls,1);
 a.request('focus');await c.advance(14999);assert.equal(calls,1);await c.advance(1);assert.equal(calls,2);
 a.request();a.setEnabled(false);await c.advance(60000);assert.equal(calls,2);a.setEnabled(true);await c.advance(500);assert.equal(calls,3);
});
test('Offline, expired authorization and active editors defer work until conditions allow it',async()=>{
 const c=clock();let allowed=false,calls=0;const a=scheduler(c,async()=>{calls++;},()=>allowed);a.request('connect');await c.advance(60000);assert.equal(calls,0);assert.equal(a.state.pending,true);
 allowed=true;a.request('online');await c.advance(500);assert.equal(calls,1);allowed=false;a.request();await c.advance(60000);assert.equal(calls,1);
});
test('Only one sync runs at a time; edits arriving during it schedule a subsequent pass',async()=>{
 const c=clock();let release,calls=0;const gate=new Promise(r=>release=r);const a=scheduler(c,async()=>{calls++;if(calls===1)await gate;});a.request('connect');const running=c.launchNext();assert.equal(calls,1);assert.equal(a.state.busy,true);a.request();a.request('focus');assert.equal(c.size,0);release();await running;await c.advance(15000);assert.equal(calls,2);
});
test('Temporary errors back off and returning-to-app signals cannot bypass the retry delay',async()=>{
 const c=clock();let calls=0;const a=scheduler(c,async()=>{calls++;return calls<3?{retry:true}:{};});a.request('connect');await c.advance(500);assert.equal(calls,1);a.request('focus');await c.advance(29999);assert.equal(calls,1);await c.advance(1);assert.equal(calls,2);a.request('periodic');await c.advance(59999);assert.equal(calls,2);await c.advance(1);assert.equal(calls,3);
});
test('Review pauses prevent repeated background prompts until an explicit resolution',async()=>{
 const c=clock();let calls=0;const a=scheduler(c,async()=>{calls++;return calls===1?{pause:true}:{};});a.request('connect');await c.advance(500);assert.equal(a.state.paused,true);a.request('focus');await c.advance(60000);assert.equal(calls,1);a.resume();await c.advance(500);assert.equal(calls,2);
});
test('Conflict policy allows routine independent changes and pauses simultaneous edits or edit/delete',()=>{
 const base=fromEvents([event()]);const local=editedState(base,[{...event(),title:'Local edit'}]);const remote=editedState(base,[{...event(),title:'Remote edit'}]);
 assert.match(syncReviewReason(local,remote,base),/same event/);assert.match(syncReviewReason(local,editedState(base,[]),base),/same event/);
 assert.equal(syncReviewReason(local,base,base),'');assert.equal(syncReviewReason(base,remote,base),'');
 const extra=fromEvents([event(),event('second')]);assert.equal(syncReviewReason(local,extra,base),'');
 assert.match(syncReviewReason(local,remote,null),/first merge/);assert.equal(syncReviewReason(base,base,null),'');assert.equal(syncReviewReason(fromEvents([]),base,null),'');
});
test('No-change checks do not rewrite local data or replace its undo point',async()=>{
 const state=fromEvents([event()]);let writes=0,uploads=0;const result=await syncDrive({store:{collect:async()=>({files:[{id:'one'}],state}),append:async()=>uploads++},getLocal:()=>state,applyLocal:()=>writes++});assert.equal(writes,0);assert.equal(uploads,0);assert.equal(result.pending,false);
});
test('An editor opening in flight defers local application even if upload already finished',async()=>{
 let local=fromEvents([event()]),editing=false,writes=0;
 await assert.rejects(syncDrive({store:{collect:async()=>({files:[],state:fromEvents([])}),append:async()=>{editing=true;}},getLocal:()=>local,applyLocal:()=>writes++,canApply:()=>!editing}),e=>e.deferred===true);assert.equal(writes,0);assert.equal(local.events.length,1);
});
test('Review catches a conflicting edit arriving during upload without replacing local events',async()=>{
 const base=fromEvents([event()]);let local=base,applied=false;
 const remote=editedState(base,[{...event(),title:'Remote'}]);const newer=editedState(remote,[{...event(),title:'Newest local'}]);
 await assert.rejects(syncDrive({store:{collect:async()=>({files:[{id:'remote'}],state:remote}),append:async()=>{}},getLocal:()=>local,applyLocal:()=>applied=true,reviewMerge:async(l,r)=>{const reason=syncReviewReason(l,r,base);if(reason)throw Error(reason);local=newer;}}),/same event/);assert.equal(applied,false);assert.equal(local.events[0].title,'Newest local');
});
test('Immutable snapshots cache downloads and changed checksums trigger fresh reads',async()=>{
 let reads=0,checksum='first';const state=fromEvents([event()]);const store=new DriveStore('test',async(url)=>{const u=new URL(url);if(u.searchParams.get('alt')==='media'){reads++;return Response.json(state);}return Response.json({files:[{id:'snapshot',md5Checksum:checksum}]});});await store.collect();await store.collect();assert.equal(reads,1);checksum='changed';await store.collect();assert.equal(reads,2);
});
