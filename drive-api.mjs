import {validateState,signature,mergeStates,fromEvents} from './sync-state.mjs';
export const PREFIX='milestones-sync-v1-';
const API='https://www.googleapis.com/drive/v3/';
export class DriveStore{
 constructor(token,fetcher=(...args)=>globalThis.fetch(...args)){this.token=token;this.fetcher=fetcher;this.cache=new Map();}
 async request(path,options={},upload=false){
  const r=await this.fetcher((upload?'https://www.googleapis.com/upload/drive/v3/':API)+path,{...options,headers:{Authorization:'Bearer '+this.token,...options.headers},signal:AbortSignal.timeout(30000)});
  if(!r.ok){const e=Error(r.status===401?'Google session expired. Connect again.':r.status===403?'Google denied access. Check the Drive API and account permissions.':`Google Drive request failed (${r.status}). Retry Sync now.`);e.status=r.status;throw e;}return r;
 }
 async account(){const r=await this.request('about?fields=user(permissionId,emailAddress,displayName)');const j=await r.json();if(!j.user?.permissionId)throw Error('Could not identify this Google Drive account.');return j.user;}
 async list(){
  const files=[];let page;
  do{
   const q="trashed = false and 'appDataFolder' in parents and name contains '"+PREFIX+"' and appProperties has { key='app' and value='Milestones' }";
   const params=new URLSearchParams({spaces:'appDataFolder',q,pageSize:'100',fields:'nextPageToken,incompleteSearch,files(id,name,size,md5Checksum)'});if(page)params.set('pageToken',page);
   const j=await(await this.request('files?'+params)).json();if(j.incompleteSearch||!Array.isArray(j.files))throw Error('Drive returned an incomplete file list. No local data changed.');
   files.push(...j.files);if(files.length>2000)throw Error('Cloud history needs maintenance. Export a backup and contact the app maintainer. No files were removed.');page=j.nextPageToken;
  }while(page);return files;
 }
 async read(file){if(Number(file.size)>20*1024*1024)throw Error('Cloud snapshot exceeds 20 MB.');const r=await this.request('files/'+encodeURIComponent(file.id)+'?alt=media');const raw=await r.text();if(raw.length>20*1024*1024)throw Error('Cloud snapshot exceeds 20 MB.');return validateState(JSON.parse(raw));}
 async collect(){const files=await this.list();let state=fromEvents([]);for(const file of files){const cached=this.cache.get(file.id);let data;if(file.md5Checksum&&cached?.checksum===file.md5Checksum)data=cached.state;else{data=await this.read(file);if(file.md5Checksum)this.cache.set(file.id,{checksum:file.md5Checksum,state:data});}state=mergeStates(state,data);}return {files,state};}
 async append(state){
  state=validateState(state);const boundary='milestones_'+crypto.randomUUID();
  const meta={name:PREFIX+crypto.randomUUID()+'.json',parents:['appDataFolder'],mimeType:'application/json',appProperties:{app:'Milestones'}};
  const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(state)}\r\n--${boundary}--`;
  if(body.length>20*1024*1024)throw Error('Snapshot exceeds 20 MB.');
  const j=await(await this.request('files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body},true)).json();
  if(!j.id)throw Error('Upload returned no file ID. Retry sync.');
  const check=await this.read(j);if(signature(check)!==signature(state))throw Error('Cloud verification failed. Local data was preserved.');return j;
 }
}
// No cloud file is overwritten or deleted. Every snapshot participates in later merges.
export async function syncDrive({store,getLocal,applyLocal,confirmMerge=async()=>true,canApply=()=>true,reviewMerge=async()=>{}}){
 const original=validateState(getLocal()),cloud=await store.collect();let merged=mergeStates(original,cloud.state);
 const ready=()=>{if(!canApply()){const error=Error('Sync deferred while an event editor or backup panel is open.');error.deferred=true;throw error;}};ready();
 await reviewMerge(original,cloud.state);
 if(signature(original)!==signature(merged)&&!await confirmMerge(original,merged))return {canceled:true};
 // Include edits made in this tab or another tab while network requests were in flight.
 merged=mergeStates(merged,getLocal());
 let uploaded=false;
 ready();
 if(!cloud.files.length||signature(merged)!==signature(cloud.state)){await store.append(merged);uploaded=true;}
 await reviewMerge(validateState(getLocal()),cloud.state);
 const final=mergeStates(merged,getLocal());
 ready();
 if(signature(final)!==signature(validateState(getLocal())))applyLocal(final);
 return {state:final,pending:signature(final)!==signature(merged),uploaded};
}
