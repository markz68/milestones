export function initSettings(){
 const dialog=document.getElementById('drive-dialog'),heading=document.getElementById('backup-title'),back=document.getElementById('settings-back'),home=document.getElementById('settings-home');
 const titles={about:'About'};
 const backup=document.getElementById('backup-tools');
 const openBackup=document.getElementById('open-backup');
 openBackup.onclick=()=>{
  backup.showModal();
  backup.dispatchEvent(new Event('milestones-backup-open'));
 };
 document.getElementById('backup-close').onclick=document.getElementById('backup-done').onclick=()=>backup.close();
 backup.addEventListener('click',event=>{if(event.target===backup)backup.close();});
 let current='home';
 function show(section='home',focus=true){
  current=section;home.hidden=section!=='home';back.hidden=section==='home';heading.textContent=titles[section]||'Settings';
  for(const el of dialog.querySelectorAll('[data-settings-page]'))el.hidden=el.dataset.settingsPage!==section;
  dialog.scrollTop=0;
  if(focus)(section==='home'?home.querySelector('button'):back).focus();
 }
 document.getElementById('settings-open').addEventListener('click',()=>{
  dialog.dispatchEvent(new Event('milestones-panel-open'));show('home',false);dialog.showModal();home.querySelector('button').focus();
 });
 dialog.querySelectorAll('[data-settings-section]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.settingsSection)));
 back.addEventListener('click',()=>{const previous=current;show('home',false);dialog.querySelector(`[data-settings-section="${previous}"]`).focus();});
 dialog.addEventListener('close',()=>show('home',false));
 return {show};
}
