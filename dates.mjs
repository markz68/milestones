export function utcDate(y,m=1,d=1){const x=new Date(0);x.setUTCHours(0,0,0,0);x.setUTCFullYear(y,m-1,d);return x;}
export function todayDate(){const x=new Date();return utcDate(x.getFullYear(),x.getMonth()+1,x.getDate());}
export function validDate(value,precision){
 if(precision==='annual')return /^\d{2}-\d{2}$/.test(value)&&validDate('2000-'+value,'day');
 const re={day:/^\d{4}-\d{2}-\d{2}$/,month:/^\d{4}-\d{2}$/,year:/^\d{4}$/}[precision];
 if(!re||!re.test(value))return false;const [y,m=1,d=1]=value.split('-').map(Number),x=utcDate(y,m,d);
 return y>=1000&&y<=9999&&x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d;
}
export function range(e){if(e.precision==='annual')return range(nextOccurrence(e));const [y,m=1,d=1]=e.date.split('-').map(Number);return {start:utcDate(y,m,d),end:e.precision==='year'?utcDate(y,12,31):e.precision==='month'?utcDate(y,m+1,0):utcDate(y,m,d)};}
export function direction(e,now=todayDate()){const r=range(e);return r.start>now?'upcoming':r.end<now?'past':'current';}
export function dateLabel(e){if(e.precision==='annual')return utcDate(2000,...e.date.split('-').map(Number)).toLocaleDateString('en-US',{month:'long',day:'numeric',timeZone:'UTC'});const [y,m=1,d=1]=e.date.split('-').map(Number);if(e.precision==='year')return String(y);return utcDate(y,m,d).toLocaleDateString('en-US',{year:'numeric',month:'long',...(e.precision==='day'?{day:'numeric'}:{}),timeZone:'UTC'});}
function shifted(date,months){const y=date.getUTCFullYear(),m=date.getUTCMonth();const base=utcDate(y,m+1+months,1);return utcDate(base.getUTCFullYear(),base.getUTCMonth()+1,Math.min(date.getUTCDate(),utcDate(base.getUTCFullYear(),base.getUTCMonth()+2,0).getUTCDate()));}
export function calendarSpan(a,b){if(a>b)[a,b]=[b,a];let months=(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth();if(shifted(a,months)>b)months--;const cursor=shifted(a,months);return {years:Math.floor(months/12),months:months%12,days:Math.round((b-cursor)/86400000),totalDays:Math.round((b-a)/86400000)};}
const plural=(n,s)=>`${n} ${s}${n===1?'':'s'}`;
export function timeLabel(e,now=todayDate()){
 const dir=direction(e,now);if(dir==='current')return e.precision==='day'?'Today':e.precision==='month'?'This month · day unknown':'This year · date unknown';
 const [y,m=1]=e.date.split('-').map(Number);let parts;
 if(e.precision==='year'){const n=Math.abs(now.getUTCFullYear()-y);parts=plural(n,'year');}
 else if(e.precision==='month'){const n=Math.abs((now.getUTCFullYear()-y)*12+now.getUTCMonth()-(m-1));parts=[Math.floor(n/12)?plural(Math.floor(n/12),'year'):'',n%12?plural(n%12,'month'):''].filter(Boolean).join(', ');}
 else{const s=calendarSpan(range(e).start,now);parts=[s.years?plural(s.years,'year'):'',s.months?plural(s.months,'month'):'',s.days?plural(s.days,'day'):''].filter(Boolean).join(', ');}
 const approx=e.precision!=='day';return dir==='past'?`${approx?'About ':''}${parts} ago`:`${approx?'About ':''}${parts} to go`;
}

// Annual observances use February 28 for February 29 in non-leap years.
export function nextOccurrence(e,now=todayDate()){
 if(!['origin','annual'].includes(e.repeat))return e;
 const parts=e.date.split('-').map(Number),annual=e.precision==='annual';
 const month=parts[annual?0:1],day=e.precision==='month'?1:parts[annual?1:2];
 let year=now.getUTCFullYear();
 if(!annual)year=Math.max(year,parts[0]);
 const make=y=>{const d=Math.min(day,utcDate(y,month+1,0).getUTCDate());return {...e,repeat:'none',precision:e.precision==='month'?'month':'day',date:`${y}-${String(month).padStart(2,'0')}`+(e.precision==='month'?'':`-${String(d).padStart(2,'0')}`)};};
 let occurrence=make(year);if(range(occurrence).end<now)occurrence=make(year+1);return occurrence;
}
export function ordinal(n){const remainder=n%100;return `${n}${remainder>=11&&remainder<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th')}`;}
export function nextLabel(e,now=todayDate()){
 const n=nextOccurrence(e,now),timing=timeLabel(n,now),type=e.eventType||'general';
 const number=e.repeat==='origin'?Number(n.date.slice(0,4))-Number(e.date.slice(0,4)):null;
 let label='Next occurrence';
 if(type==='birthday')label=number===null?'Next birthday':number===0?'Birth date':direction(n,now)==='current'&&n.precision==='day'?`Turns ${number} today`:`Turning ${number}`;
 else if(type==='wedding')label=number!==null&&number>0?`${ordinal(number)} wedding anniversary`:number===0?'Wedding day':'Next wedding anniversary';
 else if(type==='anniversary')label=number!==null&&number>0?`${ordinal(number)} anniversary`:'Next anniversary';
 else if(type==='holiday')label='Next holiday';
 else if(number!==null&&number>0)label=number+'-year anniversary';
 return `${label} · ${dateLabel(n)} · ${timing}`;
}
export function primaryLabel(e,now=todayDate()){
 if(e.repeat==='annual')return timeLabel(nextOccurrence(e,now),now);
 const label=timeLabel(e,now);
 if(e.eventType==='birthday'&&direction(e,now)==='past')return 'Age: '+label.replace(/ ago$/,'');
 return label;
}
export function isUpcoming(e,now=todayDate()){return e.repeat==='origin'||e.repeat==='annual'||direction(e,now)!=='past';}
