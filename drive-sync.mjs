import {GOOGLE_CLIENT_ID} from './drive-config.mjs';
import {DriveStore,syncDrive} from './drive-api.mjs';
import {signature,validateState,syncOverview} from './sync-state.mjs';
export function initDriveSync({getLocal,applyLocal}){
 const $=id=>document.getElementById(id),ACCOUNT='milestones.drive.account.v1',LAST='milestones.drive.last.v1';
 let token=null,expires=0,busy=false,account=null,client=null,loading=null;
 function refreshOverview(message=null){
  try{const summary=syncOverview(getLocal(),JSON.parse(localStorage.getItem(LAST)||'null'),navigator.onLine);$('sync-overview').textContent=message?message+' · '+summary:summary;}
  catch{$('sync-overview').textContent='Sync status unavailable · Open Google Drive sync for details';}
 }
 const status=(s,summary=null)=>{$('drive-status').textContent=s;refreshOverview(summary);};
 const buttons=()=>{$('drive-connect').disabled=busy;$('drive-now').disabled=busy||!token;$('drive-disconnect').disabled=busy||!token;};
 function localChanged(){if(busy)return;try{const last=JSON.parse(localStorage.getItem(LAST)||'null');status(last?`Last successful sync: ${new Date(last.at).toLocaleString()}. ${signature(getLocal())===last.signature?'No changes on this device since then.':'Local changes need syncing.'}`:'Not synced yet. Events are saved on this device.');}catch{status('Events are local. Sync status is unavailable.');}}
 function loadGoogle(){
  if(window.google?.accounts?.oauth2)return Promise.resolve();
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;const t=setTimeout(()=>{loading=null;s.remove();reject(Error('Google sign-in did not load. Check your connection and reopen this panel.'));},20000);s.onload=()=>{clearTimeout(t);if(window.google?.accounts?.oauth2)resolve();else{loading=null;reject(Error('Google sign-in is unavailable.'));}};s.onerror=()=>{clearTimeout(t);loading=null;s.remove();reject(Error('Google sign-in could not load. Local events remain available.'));};document.head.append(s);});return loading;
 }
 $('drive-open').addEventListener('click',()=>{
  $('drive-dialog').showModal();localChanged();$('drive-connect').disabled=true;
  loadGoogle().then(buttons).catch(e=>{status(e.message);$('drive-connect').disabled=true;});
 });
 $('drive-connect').addEventListener('click',()=>{
  if(!window.google?.accounts?.oauth2){status('Close and reopen this panel while online to load Google sign-in.');return;}
  if(!GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com')){status('Google client configuration is missing.');return;}
  busy=true;buttons();status('Choose your Google account…','Connecting to Google Drive');
  client=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:'https://www.googleapis.com/auth/drive.appdata',include_granted_scopes:false,
   error_callback:()=>{busy=false;buttons();status('Google sign-in was canceled or blocked. Allow the popup and try again.');},
   callback:async result=>{
    try{
     if(result.error||!result.access_token)throw Error('Google authorization was not completed.');
     token=result.access_token;expires=Date.now()+Math.max(0,Number(result.expires_in||3600)-60)*1000;
     account=await new DriveStore(token).account();const bound=localStorage.getItem(ACCOUNT);
     if(bound&&bound!==account.permissionId)throw Error('This device is linked to a different Google account. Reconnect with the account used for its first sync. No events were transferred.');
     $('drive-account').textContent='Connected: '+(account.emailAddress||account.displayName||'Google Drive');
     status('Connected. Choose Sync now to compare and merge events.');
    }catch(e){token=null;account=null;$('drive-account').textContent='Not connected';status(e.message);}
    finally{busy=false;buttons();}
   }
  });
  try{client.requestAccessToken({prompt:'select_account'});}catch(e){busy=false;buttons();status('Google sign-in could not start: '+e.message);}
 });
 $('drive-disconnect').addEventListener('click',()=>{
  // Forget only this app's in-memory token. Revocation could also affect Infinity Bottle.
  token=null;account=null;client=null;expires=0;$('drive-account').textContent='Not connected';buttons();status('Disconnected on this device. Local events and cloud snapshots are preserved.');
 });
 $('drive-now').addEventListener('click',async()=>{
  if(busy||!token)return;
  if(Date.now()>=expires){token=null;buttons();status('Google session expired. Connect again, then choose Sync now.');return;}
  busy=true;buttons();status('Checking Milestones in Google Drive…','Sync in progress');
  try{
   // Fail before uploading if local storage cannot persist the account binding.
   validateState(getLocal());const bound=localStorage.getItem(ACCOUNT);
   if(bound&&bound!==account.permissionId)throw Error('Google account changed. Reconnect with the original account.');
   localStorage.setItem(ACCOUNT,account.permissionId);
   const result=await syncDrive({store:new DriveStore(token),getLocal,applyLocal,confirmMerge:async(before,after)=>confirm(`Merge Google Drive with this device?\n\nThis device: ${before.events.length} events.\nAfter merging: ${after.events.length} events.\n\nNewer edits win for the same event ID. Saved deletions also sync. Independently created events remain separate. Your exported backups are unchanged.`)});
   if(result.canceled){status('Sync canceled. No events were changed.');return;}
   const at=new Date().toISOString();
   localStorage.setItem(LAST,JSON.stringify({at,signature:result.pending?'pending':signature(result.state)}));
   status(result.pending?'Cloud copy verified, but new local edits arrived during sync. Choose Sync now again.':`Sync completed and cloud copy checked: ${result.state.events.length} events. Last successful sync: ${new Date(at).toLocaleString()}. Sync your other device to receive these changes.`);
  }catch(e){if(e.status===401){token=null;account=null;$('drive-account').textContent='Not connected';}status('Sync stopped: '+e.message+' Local events remain available.','Sync needs attention');}
  finally{busy=false;buttons();}
 });
 window.addEventListener('online',()=>refreshOverview());window.addEventListener('offline',()=>refreshOverview());window.addEventListener('storage',e=>{if(e.key===LAST)localChanged();});window.addEventListener('milestones-changed',localChanged);buttons();localChanged();
 return {localChanged};
}
