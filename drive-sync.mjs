import {GOOGLE_CLIENT_ID} from './drive-config.mjs';
import {DriveStore,syncDrive} from './drive-api.mjs';
import {signature,validateState,syncOverview,mergeStates} from './sync-state.mjs';
import {createAutoSync,syncReviewReason} from './auto-sync.mjs';
export function initDriveSync({getLocal,applyLocal}){
 const $=id=>document.getElementById(id),ACCOUNT='milestones.drive.account.v1',LAST='milestones.drive.last.v1',AUTO='milestones.drive.auto.v1';
 let token=null,expires=0,busy=false,account=null,client=null,store=null,loading=null,reviewMessage='';
 let enabled=true;try{enabled=localStorage.getItem(AUTO)!=='false';}catch{}
 $('drive-auto').checked=enabled;
 const editing=()=>!!document.querySelector('#editor[open],#backups[open]');
 function lastSync(){try{return JSON.parse(localStorage.getItem(LAST)||'null');}catch{return null;}}
 function baseline(){try{return validateState(JSON.parse(lastSync()?.signature));}catch{return null;}}
 function refreshOverview(message=null){
  try{
   const summary=syncOverview(getLocal(),lastSync(),navigator.onLine);
   const mode=reviewMessage?'Automatic sync paused: review needed':enabled?(token&&Date.now()<expires?'Auto sync on':'Auto sync on · Connect Google Drive to sync'):'Auto sync off';
   $('sync-overview').textContent=(message||mode)+' · '+summary;
  }catch{$('sync-overview').textContent='Sync status unavailable · Open Google Drive sync for details';}
 }
 const status=(s,summary=null)=>{$('drive-status').textContent=s;refreshOverview(summary);};
 const buttons=()=>{$('drive-connect').disabled=busy;$('drive-now').disabled=busy||!token;$('drive-disconnect').disabled=busy||!token;};
 function forgetSession(){token=null;account=null;store=null;client=null;expires=0;$('drive-account').textContent='Not connected';buttons();}
 function expireSession(){if(token&&Date.now()>=expires){forgetSession();status('Google session expired. Connect again to resume syncing. Local edits are preserved.','Reconnect to sync');return true;}return false;}
 const auto=createAutoSync({run:()=>performSync(true),canRun:()=>!!(token&&Date.now()<expires&&!busy&&navigator.onLine&&!document.hidden&&!editing())});
 auto.setEnabled(enabled);
 function localChanged(){
  if(busy)return;
  if(reviewMessage){status(reviewMessage+' Choose Sync now to review.');return;}
  refreshOverview();if(enabled)auto.request('change');
 }
 function loadGoogle(){
  if(window.google?.accounts?.oauth2)return Promise.resolve();if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
   const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;
   const fail=message=>{loading=null;s.remove();reject(Error(message));};
   const t=setTimeout(()=>fail('Google sign-in did not load. Check your connection and reopen this panel.'),20000);
   s.onload=()=>{clearTimeout(t);if(window.google?.accounts?.oauth2)resolve();else fail('Google sign-in is unavailable.');};
   s.onerror=()=>{clearTimeout(t);fail('Google sign-in could not load. Local events remain available.');};document.head.append(s);
  });return loading;
 }
 $('drive-open').addEventListener('click',()=>{
  $('drive-dialog').showModal();expireSession();refreshOverview();$('drive-connect').disabled=true;
  loadGoogle().then(buttons).catch(e=>{status(e.message);$('drive-connect').disabled=true;});
 });
 $('drive-auto').addEventListener('change',()=>{
  const wanted=$('drive-auto').checked;
  try{localStorage.setItem(AUTO,String(wanted));enabled=wanted;auto.setEnabled(enabled);if(enabled&&reviewMessage)auto.pause();status(enabled?'Automatic sync enabled. It runs while this app is open, online, and connected.':'Automatic sync disabled. Use Sync now whenever you want.');}
  catch{ $('drive-auto').checked=enabled;status('Could not save the automatic-sync preference.');}
 });
 $('drive-connect').addEventListener('click',()=>{
  if(!window.google?.accounts?.oauth2){status('Close and reopen this panel while online to load Google sign-in.');return;}
  if(!GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com')){status('Google client configuration is missing.');return;}
  busy=true;buttons();status('Choose your Google account…','Connecting to Google Drive');
  client=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:'https://www.googleapis.com/auth/drive.appdata',include_granted_scopes:false,
   error_callback:()=>{busy=false;buttons();status('Google sign-in was canceled or blocked. Allow the popup and try again.');},
   callback:async result=>{
    let connected=false;
    try{
     if(result.error||!result.access_token)throw Error('Google authorization was not completed.');
     token=result.access_token;expires=Date.now()+Math.max(0,Number(result.expires_in||3600)-60)*1000;
     store=new DriveStore(token);account=await store.account();const bound=localStorage.getItem(ACCOUNT);
     if(bound&&bound!==account.permissionId)throw Error('This device is linked to a different Google account. Reconnect with the account used for its first sync. No events were transferred.');
     $('drive-account').textContent='Connected: '+(account.emailAddress||account.displayName||'Google Drive');connected=true;
     reviewMessage='';status(enabled?'Connected. Automatic sync will start shortly.':'Connected. Choose Sync now to compare and merge events.');
    }catch(e){forgetSession();status(e.message);}
    finally{busy=false;buttons();if(connected&&enabled){auto.resume();auto.request('connect');}}
   }
  });
  try{client.requestAccessToken({prompt:'select_account'});}catch(e){busy=false;buttons();status('Google sign-in could not start: '+e.message);}
 });
 $('drive-disconnect').addEventListener('click',()=>{
  // Do not revoke the shared OAuth grant: Infinity Bottle uses the same client.
  auto.cancel();forgetSession();status('Disconnected on this device. Local events and cloud snapshots are preserved.');
 });
 async function performSync(automatic=false){
  if(busy)return {retry:true};
  if(!token||expireSession())return {};
  if(!navigator.onLine){status('Offline. Events are saved locally; sync can resume when internet access returns.');return {retry:true};}
  if(editing()){status('Finish editing or close Backup & restore before syncing.');return {retry:true};}
  busy=true;buttons();status('Checking Milestones in Google Drive…',automatic?'Automatic sync in progress':'Sync in progress');
  try{
   validateState(getLocal());const bound=localStorage.getItem(ACCOUNT);
   if(bound&&bound!==account.permissionId)throw Error('Google account changed. Reconnect with the original account.');localStorage.setItem(ACCOUNT,account.permissionId);
   const base=baseline();let reviewed=false;
   const result=await syncDrive({store,getLocal,applyLocal,canApply:()=>!editing(),
    reviewMerge:async(local,remote)=>{
     if(!automatic&&reviewMessage&&!reviewed){
      const after=mergeStates(local,remote);
      if(!confirm(`Review paused sync: ${reviewMessage}\n\nLocal: ${local.events.length} events. Cloud: ${remote.events.length}. After merge: ${after.events.length}.\n\nContinue using the newer change for each event, including deletions? Independent event IDs are kept. Exported backups remain unchanged.`)){const error=Error('Merge review canceled.');error.review=true;throw error;}
      reviewed=true;
     }
     if(automatic){const reason=syncReviewReason(local,remote,base);if(reason){const error=Error(reason);error.review=true;throw error;}}},
    confirmMerge:async(before,after)=>automatic||reviewed||confirm(`Merge Google Drive with this device?\n\nThis device: ${before.events.length} events.\nAfter merging: ${after.events.length} events.\n\nNewer edits win for the same event ID. Saved deletions also sync. Independently created events remain separate. Your exported backups are unchanged.`)
   });
   if(result.canceled){reviewMessage='Merge canceled. Automatic sync is paused until you review with Sync now.';auto.pause();status(reviewMessage);return {pause:true};}
   const at=new Date().toISOString();localStorage.setItem(LAST,JSON.stringify({at,signature:result.pending?'pending':signature(result.state)}));
   reviewMessage='';status(result.pending?'Cloud copy verified. New local edits arrived during sync and will need another pass.':`Sync completed and cloud copy checked: ${result.state.events.length} events. Last successful sync: ${new Date(at).toLocaleString()}.`);
   return {pending:result.pending};
  }catch(e){
   if(e.review){reviewMessage=e.message;status(e.message+' Automatic sync is paused. Choose Sync now to review.');return {pause:true};}
   if(e.deferred){status('Automatic sync is waiting until you finish editing. Local events are saved.');return {retry:true};}
   if(e.status===401){forgetSession();status('Google session expired. Connect again to resume syncing. Local edits are preserved.','Reconnect to sync');return {};}
   const retry=e.status!==403&&(e.status===429||e.status>=500||e.name==='TypeError'||e.name==='TimeoutError'||e.name==='AbortError'||!navigator.onLine);
   if(!retry)reviewMessage='Sync needs attention. Open this panel and choose Sync now after resolving the error.';
   status('Sync stopped: '+e.message+' Local events remain available.',retry?'Sync will retry while connected':'Sync needs attention');
   return retry?{retry:true}:{pause:true};
  }finally{busy=false;buttons();}
 }
 $('drive-now').addEventListener('click',async()=>{
  auto.pause();const result=await performSync(false);
  if(!result.pause){auto.resume();if(enabled&&(result.pending||result.retry))auto.request('change');}
 });
 function wake(reason){expireSession();refreshOverview();if(enabled)auto.request(reason);}
 window.addEventListener('online',()=>wake('online'));window.addEventListener('offline',()=>{auto.cancel();refreshOverview();});
 window.addEventListener('focus',()=>wake('focus'));document.addEventListener('visibilitychange',()=>{if(document.hidden)auto.cancel();else wake('visible');});
 for(const id of ['editor','backups'])$(id).addEventListener('close',()=>{if(enabled)auto.request('close');});
 window.addEventListener('storage',e=>{if(e.key===LAST)refreshOverview();if(e.key===AUTO){enabled=e.newValue!=='false';$('drive-auto').checked=enabled;auto.setEnabled(enabled);if(reviewMessage)auto.pause();refreshOverview();}});
 window.addEventListener('milestones-changed',localChanged);
 // Visible-page checks pick up changes on the other device without requiring a focus change.
 const interval=setInterval(()=>{if(!document.hidden&&enabled)wake('periodic');},60000);
 window.addEventListener('pagehide',()=>{auto.cancel();});
 buttons();refreshOverview();return {localChanged,dispose(){auto.cancel();clearInterval(interval);}};
}
