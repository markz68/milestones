import test from 'node:test';
import assert from 'node:assert/strict';
import {fromEvents,validateState,editedState,mergeStates,signature} from './sync-state.mjs';
import {syncDrive,DriveStore,PREFIX} from './drive-api.mjs';
const e=(id='one',title='Wedding',at='2026-01-01T00:00:00.000Z')=>({id,title,date:'1997-11-14',precision:'day',repeat:'origin',updatedAt:at});
const copy=x=>structuredClone(x);
function fakeStore(initial=[]){const snapshots=initial.map(copy);return {snapshots,async collect(){return {files:snapshots.map((_,i)=>({id:String(i)})),state:mergeStates(fromEvents([]),...snapshots)};},async append(s){snapshots.push(copy(s));}};}
test('Legacy schemas migrate preserving IDs, dates, notes and recurrence',()=>{
 for(const schemaVersion of [1,2]){const s=validateState({app:'Milestones',schemaVersion,events:[{...e(),notes:'original email'}]});assert.equal(s.schemaVersion,3);assert.equal(s.events[0].id,'one');assert.equal(s.events[0].notes,'original email');assert.deepEqual(s.deleted,[]);assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))),s);}
 assert.throws(()=>validateState({app:'Other app',schemaVersion:3,events:[],deleted:[]}));
 assert.throws(()=>validateState({app:'Milestones',schemaVersion:3,events:[],deleted:[{id:'one',updatedAt:'invalid'}]}));
});
test('Deletion reaches another device and old backups cannot resurrect it',()=>{
 const original=fromEvents([e()]),deleted=editedState(original,[]);
 assert.equal(mergeStates(original,deleted).events.length,0);
 assert.equal(mergeStates(deleted,original).deleted[0].id,'one');
 const restored=editedState(deleted,original.events);
 assert.equal(mergeStates(deleted,restored).events[0].id,'one');
 assert.equal(restored.deleted.length,0);
});
test('Offline edits merge per ID and equal-time conflicts converge regardless of order',()=>{
 const a=fromEvents([e('one','A'),e('two','Second')]),b=fromEvents([e('one','B')]);
 assert.deepEqual(mergeStates(a,b),mergeStates(b,a));
 const dead={app:'Milestones',schemaVersion:3,events:[],deleted:[{id:'one',updatedAt:e().updatedAt}]};
 assert.equal(mergeStates(a,dead).events.length,1);
 assert.deepEqual(mergeStates(mergeStates(a,b),dead),mergeStates(a,mergeStates(b,dead)));
});
test('Editing and undo create timestamps newer than known cloud changes',()=>{
 const original=fromEvents([e('one','Future','2090-01-01T00:00:00.000Z')]);
 const updated=editedState(original,[e('one','Changed')]);
 assert.ok(Date.parse(updated.events[0].updatedAt)>Date.parse(original.events[0].updatedAt));
 const restored=editedState(updated,original.events);
 assert.ok(Date.parse(restored.events[0].updatedAt)>Date.parse(updated.events[0].updatedAt));
});
test('Sync combines two devices and does not upload again when nothing changed',async()=>{
 const store=fakeStore();let pc=fromEvents([e('pc')]),phone=fromEvents([e('phone')]);
 await syncDrive({store,getLocal:()=>pc,applyLocal:s=>pc=s});
 await syncDrive({store,getLocal:()=>phone,applyLocal:s=>phone=s});
 await syncDrive({store,getLocal:()=>pc,applyLocal:s=>pc=s});
 assert.equal(pc.events.length,2);assert.deepEqual(pc,phone);assert.equal(store.snapshots.length,2);
});
test('Simultaneous first syncs append safely and converge on subsequent sync',async()=>{
 const store=fakeStore();let pc=fromEvents([e('pc')]),phone=fromEvents([e('phone')]);let count=0,release;const gate=new Promise(r=>release=r);
 store.collect=async()=>{const result={files:store.snapshots.map((_,i)=>({id:String(i)})),state:mergeStates(fromEvents([]),...store.snapshots.map(copy))};if(++count===2)release();await gate;return result;};
 await Promise.all([syncDrive({store,getLocal:()=>pc,applyLocal:s=>pc=s}),syncDrive({store,getLocal:()=>phone,applyLocal:s=>phone=s})]);
 assert.equal(store.snapshots.length,2);
 await syncDrive({store,getLocal:()=>pc,applyLocal:s=>pc=s});await syncDrive({store,getLocal:()=>phone,applyLocal:s=>phone=s});assert.equal(pc.events.length,2);assert.deepEqual(pc,phone);
});
test('Upload failure or canceled merge leaves local data untouched',async()=>{
 let local=fromEvents([e('local')]),applied=false;const store=fakeStore([fromEvents([e('remote')])]);
 const canceled=await syncDrive({store,getLocal:()=>local,applyLocal:()=>applied=true,confirmMerge:async()=>false});assert.equal(canceled.canceled,true);assert.equal(applied,false);assert.equal(store.snapshots.length,1);
 store.append=async()=>{throw Error('offline');};await assert.rejects(syncDrive({store,getLocal:()=>local,applyLocal:()=>applied=true}),/offline/);assert.equal(applied,false);assert.equal(local.events.length,1);
});
test('Local edit arriving during upload survives and is marked pending',async()=>{
 let local=fromEvents([e()]);const store=fakeStore();const append=store.append.bind(store);store.append=async s=>{await append(s);local=editedState(local,[{...e(),title:'Edited while uploading'}]);};
 const r=await syncDrive({store,getLocal:()=>local,applyLocal:s=>local=s});assert.equal(local.events[0].title,'Edited while uploading');assert.equal(r.pending,true);assert.equal(store.snapshots[0].events[0].title,'Wedding');
});
test('Drive requests isolate Milestones files, paginate and verify uploaded data',async()=>{
 const state=fromEvents([e()]);const paths=[];
 const fetcher=async(url,options)=>{paths.push({url,options});const u=new URL(url);
  if(options.method==='POST'){assert.match(options.body,/Milestones/);assert.match(options.body,/appDataFolder/);assert.ok(options.body.includes(PREFIX));return Response.json({id:'created'});}
  if(u.searchParams.get('alt')==='media')return Response.json(state);
  if(u.searchParams.get('pageToken')==='second')return Response.json({files:[{id:'old2'}]});
  assert.equal(u.searchParams.get('spaces'),'appDataFolder');assert.match(u.searchParams.get('q'),/appProperties/);assert.match(u.searchParams.get('q'),/milestones-sync-v1-/);return Response.json({files:[{id:'old1'}],nextPageToken:'second'});
 };
 const store=new DriveStore('test-token',fetcher);assert.equal((await store.list()).length,2);await store.append(state);
 assert.ok(paths.every(x=>x.options.headers.Authorization==='Bearer test-token'));assert.ok(paths.every(x=>!['PATCH','DELETE'].includes(x.options.method)));
});
test('Cloud corruption, incomplete listings, token expiry and verification failures fail closed',async()=>{
 const bad=new DriveStore('test',async()=>Response.json({files:[],incompleteSearch:true}));await assert.rejects(bad.list(),/incomplete/);
 const expired=new DriveStore('test',async()=>new Response('',{status:401}));await assert.rejects(expired.account(),/expired/);
 const corrupt=new DriveStore('test',async()=>Response.json({app:'Infinity Bourbon',schemaVersion:1,events:[]}));await assert.rejects(corrupt.read({id:'bad'}),/Unsupported/);
 const wrong=new DriveStore('test',async(_u,o)=>Response.json(o.method==='POST'?{id:'new'}:fromEvents([])));await assert.rejects(wrong.append(fromEvents([e()])),/verification failed/);
});
test('Default browser fetch keeps its global receiver during account connection',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async function(url){assert.equal(this,globalThis,'Native Window.fetch requires its global receiver');assert.match(url,/about\?/);return Response.json({user:{permissionId:'account-one',emailAddress:'test@example.com'}});};
  const account=await new DriveStore('test-token').account();assert.equal(account.permissionId,'account-one');
 }finally{globalThis.fetch=original;}
});
test('Recovering a retained legacy copy restores missing IDs without overriding newer edits or deletions',()=>{
 const legacy=fromEvents([e('missing'),e('edited','Old'),e('deleted')]);
 const current=validateState({app:'Milestones',schemaVersion:3,events:[e('edited','New','2026-02-01T00:00:00.000Z')],deleted:[{id:'deleted',updatedAt:'2026-02-01T00:00:00.000Z'}]});
 const recovered=mergeStates(current,legacy);
 assert.equal(recovered.events.length,2);assert.equal(recovered.events.find(x=>x.id==='edited').title,'New');assert.ok(recovered.events.find(x=>x.id==='missing'));assert.ok(recovered.deleted.find(x=>x.id==='deleted'));
 assert.equal(mergeStates(fromEvents([]),legacy).events.length,3);
});
