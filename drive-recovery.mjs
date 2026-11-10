import {validateState,signature,mergeStates,editedState} from './sync-state.mjs';
const unchanged=(getLocal,before)=>signature(validateState(getLocal()))===signature(before);
function ready(canApply){if(!canApply())throw Error('Finish editing before using Drive backup or restore.');}
export async function backupDevice({store,getLocal,confirm,canApply=()=>true}){
 ready(canApply);const before=validateState(getLocal());
 if(!await confirm(before))return {canceled:true};
 ready(canApply);if(!unchanged(getLocal,before))throw Error('Local events changed during review. Start the backup again.');
 await store.appendBackup(before);
 return {count:before.events.length,pending:!unchanged(getLocal,before)};
}
export async function restoreDevice({store,getLocal,applyLocal,confirm,canApply=()=>true}){
 const [backup,cloud]=await Promise.all([store.latestBackup(),store.collect()]);
 if(!backup&&!cloud.files.length)throw Error('No Milestones backup or sync history was found in Google Drive.');
 const source=validateState(backup?backup.state:cloud.state);
 ready(canApply);const before=validateState(getLocal());
 if(!await confirm({before,source,createdAt:backup?.createdAt||null,manual:!!backup}))return {canceled:true};
 ready(canApply);if(!unchanged(getLocal,before))throw Error('Local events changed during review. Start the restore again.');
 // Restore the selected active list using stamps newer than all known cloud changes.
 // This records removals and intentional resurrections so old sync history cannot undo it.
 const known=mergeStates(before,cloud.state,source),next=editedState(known,source.events);
 if(signature(next)!==signature(before))applyLocal(next);
 return {count:source.events.length,state:next};
}
