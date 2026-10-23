// One accessible, fail-closed confirmation at a time. Escape and external closes cancel.
export function createConfirmation(dialog){
 const title=dialog.querySelector('[data-confirm-title]'),message=dialog.querySelector('[data-confirm-message]'),cancel=dialog.querySelector('[data-confirm-cancel]'),accept=dialog.querySelector('[data-confirm-accept]');
 let pending=null;
 cancel.addEventListener('click',()=>dialog.close());
 accept.addEventListener('click',()=>{if(pending){pending.accepted=true;dialog.close();}});
 dialog.addEventListener('cancel',()=>{if(pending)pending.accepted=false;});
 dialog.addEventListener('close',()=>{const done=pending;pending=null;if(done)done.resolve(done.accepted);});
 return ({heading='Review changes',body,confirmLabel='Continue',destructive=false})=>{
  if(pending)return Promise.resolve(false);
  title.textContent=heading;message.textContent=body;accept.textContent=confirmLabel;accept.className=destructive?'danger-button':'primary';dialog.returnValue='';
  return new Promise((resolve,reject)=>{
   pending={resolve,accepted:false};
   try{dialog.showModal();cancel.focus();}catch(error){pending=null;reject(error);}
  });
 };
}
