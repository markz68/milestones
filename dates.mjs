export function utcDate(y,m=1,d=1){const x=new Date(0);x.setUTCHours(0,0,0,0);x.setUTCFullYear(y,m-1,d);return x;}
export function todayDate(){const x=new Date();return utcDate(x.getFullYear(),x.getMonth()+1,x.getDate());}
export function validDate(value,precision){
 const re={day:/^\d{4}-\d{2}-\d{2}$/,month:/^\d{4}-\d{2}$/,year:/^\d{4}$/}[precision];
 if(!re||!re.test(value))return false;const [y,m=1,d=1]=value.split('-').map(Number),x=utcDate(y,m,d);
 return y>=1000&&y<=9999&&x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d;
}
export function range(e){const [y,m=1,d=1]=e.date.split('-').map(Number);return {start:utcDate(y,m,d),end:e.precision==='year'?utcDate(y,12,31):e.precision==='month'?utcDate(y,m+1,0):utcDate(y,m,d)};}
export function direction(e,now=todayDate()){const r=range(e);return r.start>now?'upcoming':r.end<now?'past':'current';}
export function dateLabel(e){const [y,m=1,d=1]=e.date.split('-').map(Number);if(e.precision==='year')return String(y);return utcDate(y,m,d).toLocaleDateString('en-US',{year:'numeric',month:'long',...(e.precision==='day'?{day:'numeric'}:{}),timeZone:'UTC'});}
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
