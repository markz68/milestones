import test from 'node:test';
import assert from 'node:assert/strict';
import {backupDevice,restoreDevice} from './drive-recovery.mjs';
import {fromEvents,editedState,mergeStates,signature,headerSyncStatus} from './sync-state.mjs';
import {DriveStore,PREFIX,BACKUP_PREFIX} from './drive-api.mjs';
const event=(id,title=id,at='2026-01-01T00:00:00.000Z')=>({id,title,date:'1997-11',precision:'month',updatedAt:at});
const copy=x=>structuredClone(x);
function setup({local=fromEvents([event('one')]),source=fromEvents([event('old')]),cloud=local,manual=true}={}){
 let current=copy(local),applies=0;const backups=[];
 const store={async appendBackup(state){backups.push(copy(state));},async latestBackup(){return manual?{state:copy(source),createdAt:'2026-01-02T00:00:00.000Z'}:null;},async collect(){return {files:[{id:'sync'}],state:copy(cloud)};}};
 return {store,backups,getLocal:()=>copy(current),applyLocal:s=>{current=copy(s);applies++;},setLocal:s=>{current=copy(s);},get applies(){return applies;}};
}
test('Drive backup is separate, cancelable, and detects edits during review or upload',async()=>{
 const x=setup();assert.equal((await backupDevice({...x,confirm:async()=>false})).canceled,true);assert.equal(x.backups.length,0);
 await assert.rejects(backupDevice({...x,confirm:async()=>{x.setLocal(fromEvents([event('new')]));return true;}}),/changed during review/);assert.equal(x.backups.length,0);
 const before=x.getLocal();x.store.appendBackup=async s=>{x.backups.push(copy(s));x.setLocal(editedState(s,[...s.events,event('arrived')]));};
 const r=await backupDevice({...x,confirm:async()=>true});assert.equal(r.pending,true);assert.equal(signature(x.backups[0]),signature(before));assert.equal(x.applies,0);
});
test('Failed backup never changes local records or claims success',async()=>{
 const x=setup(),before=signature(x.getLocal());x.store.appendBackup=async()=>{throw Error('Verification failed');};
 await assert.rejects(backupDevice({...x,confirm:async()=>true}),/Verification/);assert.equal(signature(x.getLocal()),before);assert.equal(x.applies,0);
});
test('Restore replaces the active list with newer edits and tombstones without deleting cloud history',async()=>{
 const source=fromEvents([event('resurrect','Birthday')]),cloud=editedState(source,[event('remote','Other event')]),x=setup({local:fromEvents([event('local')]),source,cloud});
 const r=await restoreDevice({...x,confirm:async p=>{assert.equal(p.manual,true);assert.equal(p.source.events[0].title,'Birthday');return true;}});
 assert.deepEqual(x.getLocal().events.map(e=>e.id),['resurrect']);assert.deepEqual(mergeStates(cloud,r.state).events.map(e=>e.id),['resurrect']);
 assert.ok(x.getLocal().deleted.some(e=>e.id==='remote'));assert.ok(x.getLocal().deleted.some(e=>e.id==='local'));assert.equal(x.applies,1);assert.equal(x.backups.length,0);
});
test('Cancel, changed local state and active editor prevent applying restore',async()=>{
 const x=setup(),before=signature(x.getLocal());assert.equal((await restoreDevice({...x,confirm:async()=>false})).canceled,true);assert.equal(signature(x.getLocal()),before);
 await assert.rejects(restoreDevice({...x,confirm:async()=>{x.setLocal(fromEvents([event('changed')]));return true;}}),/changed during review/);
 await assert.rejects(restoreDevice({...x,canApply:()=>false,confirm:async()=>true}),/Finish editing/);assert.equal(x.applies,0);
});
test('Existing sync history can be restored before any manual backup has been created',async()=>{
 const x=setup({manual:false,cloud:fromEvents([event('cloud')])});await restoreDevice({...x,confirm:async p=>{assert.equal(p.manual,false);assert.equal(p.createdAt,null);return true;}});assert.equal(x.getLocal().events[0].id,'cloud');
 const y=setup({manual:false});y.store.collect=async()=>({files:[],state:fromEvents([])});await assert.rejects(restoreDevice({...y,confirm:async()=>true}),/No Milestones backup/);assert.equal(y.applies,0);
});
test('An intentionally empty manual backup restores an empty list rather than falling back to sync history',async()=>{
 const x=setup({source:fromEvents([])});await restoreDevice({...x,confirm:async p=>{assert.equal(p.source.events.length,0);return true;}});assert.equal(x.getLocal().events.length,0);assert.equal(x.getLocal().deleted.length,1);
});
test('Corrupt manual backup is rejected instead of silently restoring another copy',async()=>{
 const x=setup();x.store.latestBackup=async()=>({state:{app:'Other'},createdAt:'2026-01-02'});await assert.rejects(restoreDevice({...x,confirm:async()=>true}),/Unsupported/);assert.equal(x.applies,0);
});
test('Manual Drive files are isolated from sync files, paginated, chosen by creation time and verified after upload',async()=>{
 const state=fromEvents([event('backup')]),calls=[];
 const store=new DriveStore('fake',async(url,options={})=>{
  calls.push({url,options});
  if(url.includes('uploadType=')){assert.equal(options.method,'POST');assert.ok(options.body.includes(BACKUP_PREFIX));assert.ok(options.body.includes('manual-backup'));assert.ok(!options.body.includes('"name":"'+PREFIX));return new Response(JSON.stringify({id:'uploaded'}));}
  if(url.includes('alt=media'))return new Response(JSON.stringify(state));
  const u=new URL(url);assert.ok(u.searchParams.get('q').includes(BACKUP_PREFIX));assert.ok(u.searchParams.get('q').includes("value='manual-backup'"));assert.ok(u.searchParams.get('q').includes("value='Milestones'"));
  return new Response(JSON.stringify(u.searchParams.has('pageToken')?{files:[{id:'new',createdTime:'2026-02-01T00:00:00Z'}]}:{files:[{id:'old',createdTime:'2026-01-01T00:00:00Z'}],nextPageToken:'page2'}));
 });
 assert.equal((await store.latestBackup()).createdAt,'2026-02-01T00:00:00Z');assert.ok(calls.some(c=>c.url.includes('/new?alt=media')));
 await store.appendBackup(state);assert.ok(calls.some(c=>c.url.includes('/uploaded?alt=media')));assert.ok(!calls.some(c=>['PATCH','DELETE'].includes(c.options.method)));
 const bad=new DriveStore('fake',async()=>new Response(JSON.stringify({files:[{id:'x'}]})));await assert.rejects(bad.latestBackup(),/invalid creation/);
});
test('Header never calls pending, offline, disconnected or conflicted records synced',()=>{
 const state=fromEvents([event('one')]),last={at:'2026-01-02T12:00:00Z',signature:signature(state)},base={state,last,connected:true};
 assert.match(headerSyncStatus(base),/^Synced /);assert.match(headerSyncStatus({...base,connected:false}),/^Not connected/);assert.match(headerSyncStatus({...base,connected:false,reconnectNeeded:true}),/Reconnect/);
 assert.match(headerSyncStatus({...base,online:false}),/^Offline/);assert.match(headerSyncStatus({...base,busy:true,activity:'Backing up…'}),/^Backing up/);assert.match(headerSyncStatus({...base,review:true}),/Needs review/);
 assert.match(headerSyncStatus({...base,state:fromEvents([])}),/^Changes waiting/);assert.match(headerSyncStatus({...base,enabled:false}),/automatic sync off/);
});
