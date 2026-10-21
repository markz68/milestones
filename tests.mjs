import test from 'node:test';
import assert from 'node:assert/strict';
import {validDate,utcDate,range,calendarSpan,timeLabel,direction,nextOccurrence,nextLabel,isUpcoming,ordinal,primaryLabel} from './dates.mjs';
import {validateEvents,readBackup,mergeEvents,csvText} from './data.mjs';
const event=(date,precision='day')=>({id:'one',title:'A milestone',date,precision,updatedAt:'2026-10-21T12:00:00Z'});
test('Valid dates preserve precision and reject calendar rollover',()=>{assert.ok(validDate('1997-11','month'));assert.ok(validDate('1997','year'));assert.ok(validDate('2024-02-29','day'));for(const [v,p] of [['2025-02-29','day'],['2026-13','month'],['0999','year'],['2026-01-01','month'],['2026-00-10','day']])assert.equal(validDate(v,p),false);});
test('Month and year ranges do not invent exact dates',()=>{const r=range(event('1997-11','month'));assert.equal(r.start.toISOString(),'1997-11-01T00:00:00.000Z');assert.equal(r.end.toISOString(),'1997-11-30T00:00:00.000Z');assert.match(timeLabel(event('1997-11','month'),utcDate(2026,10,21)),/^About 28 years, 11 months ago$/);assert.equal(direction(event('2026-10','month'),utcDate(2026,10,21)),'current');assert.match(timeLabel(event('2026','year'),utcDate(2026,10,21)),/date unknown/);});
test('Exact dates handle leap years and month ends',()=>{assert.deepEqual(calendarSpan(utcDate(2024,2,29),utcDate(2025,2,28)),{years:1,months:0,days:0,totalDays:365});assert.deepEqual(calendarSpan(utcDate(2026,1,31),utcDate(2026,3,1)),{years:0,months:1,days:1,totalDays:29});assert.equal(timeLabel(event('2026-10-21'),utcDate(2026,10,21)),'Today');assert.equal(timeLabel(event('2026-10-22'),utcDate(2026,10,21)),'1 day to go');});
test('Backups round trip all precision and notes and reject invalid schema',()=>{const original=validateEvents([{...event('1997-11','month'),notes:'Email said last Saturday',source:'Family email',pinned:true}]);assert.deepEqual(readBackup(JSON.parse(JSON.stringify({app:'Milestones',schemaVersion:1,events:original}))),original);assert.throws(()=>readBackup({app:'Milestones',schemaVersion:99,events:original}));assert.throws(()=>validateEvents([event('2026-02-30')]));assert.throws(()=>validateEvents([event('1997','year'),event('2020','year')]));});
test('Import keeps newer local edits and adds missing records',()=>{const local=validateEvents([event('1997','year')]);const old={...local[0],title:'old',updatedAt:'2025-01-01T00:00:00Z'};const next={...local[0],id:'two'};assert.deepEqual(mergeEvents(local,[old,next]),[...local,next]);});
test('CSV escapes quotes, newlines, and spreadsheet formulas',()=>{const output=csvText([{...event('1997','year'),title:'=DANGEROUS()',notes:'a "quote"\nand line'}]);assert.ok(output.includes('"\'=DANGEROUS()"'));assert.ok(output.includes('"a ""quote""\nand line"'));});

test('Annual holiday has no origin year and rolls over after the day',()=>{
 const e=validateEvents([{...event('12-25','annual'),repeat:'annual'}])[0];
 assert.equal(nextOccurrence(e,utcDate(2026,10,21)).date,'2026-12-25');
 assert.equal(nextOccurrence(e,utcDate(2026,12,25)).date,'2026-12-25');
 assert.equal(nextOccurrence(e,utcDate(2026,12,26)).date,'2027-12-25');
 assert.equal(isUpcoming(e,utcDate(2026,12,26)),true);
 assert.equal(e.date,'12-25');assert.equal(validDate('02-30','annual'),false);
});
test('One marriage event retains elapsed time and next anniversary',()=>{
 const e={...event('1997-11-14'),repeat:'origin'};
 assert.equal(direction(e,utcDate(2026,10,21)),'past');
 assert.equal(isUpcoming(e,utcDate(2026,10,21)),true);
 assert.match(timeLabel(e,utcDate(2026,10,21)),/ago$/);
 assert.match(nextLabel(e,utcDate(2026,10,21)),/29-year anniversary/);
 assert.equal(nextOccurrence(e,utcDate(2026,11,15)).date,'2027-11-14');
 assert.equal(nextOccurrence({...e,date:'2028-11-14'},utcDate(2026,10,21)).date,'2028-11-14');
});
test('Annual approximate months stay approximate and year-only repeats are rejected',()=>{
 const e={...event('1997-11','month'),repeat:'origin'};
 assert.equal(nextOccurrence(e,utcDate(2026,11,15)).date,'2026-11');
 assert.match(nextLabel(e,utcDate(2026,11,15)),/day unknown/);
 assert.equal(nextOccurrence(e,utcDate(2026,12,1)).date,'2027-11');
 assert.throws(()=>validateEvents([{...event('1997','year'),repeat:'origin'}]));
});
test('Leap-day annual events use February 28 in non-leap years',()=>{
 for(const e of [{...event('2000-02-29'),repeat:'origin'},{...event('02-29','annual'),repeat:'annual'}]){
 assert.equal(nextOccurrence(e,utcDate(2026,2,1)).date,'2026-02-28');
 assert.equal(nextOccurrence(e,utcDate(2028,2,1)).date,'2028-02-29');
 assert.equal(nextOccurrence(e,utcDate(2026,3,1)).date,'2027-02-28');}
});
test('New backups preserve repeat types and old backups remain readable',()=>{
 const events=validateEvents([{...event('12-25','annual'),repeat:'annual'},{...event('1997-11-14'),id:'two',repeat:'origin'}]);
 assert.deepEqual(readBackup({app:'Milestones',schemaVersion:2,events}),events);
 assert.equal(readBackup({app:'Milestones',schemaVersion:1,events:[event('1997','year') ]})[0].repeat,'none');
 assert.throws(()=>validateEvents([{...event('12-25','annual'),repeat:'none'}]));
 assert.ok(csvText(events).includes('"repeat"'));
});

test('Birthday wording handles next age, today, unknown origin year and approximate months',()=>{
 const b={...event('1968-10-08'),repeat:'origin',eventType:'birthday'};
 assert.match(nextLabel(b,utcDate(2026,10,21)),/^Turning 59/);
 assert.match(nextLabel(b,utcDate(2026,10,8)),/^Turns 58 today/);
 assert.match(primaryLabel(b,utcDate(2026,10,21)),/^Age: 58 years/);
 assert.match(nextLabel({...b,date:'10-08',precision:'annual',repeat:'annual'},utcDate(2026,10,21)),/^Next birthday/);
 assert.match(nextLabel({...b,date:'1968-10',precision:'month'},utcDate(2026,10,21)),/Turning 58.*day unknown/);
 assert.match(nextLabel({...b,date:'2028-10-08'},utcDate(2026,10,21)),/^Birth date/);
});
test('Wedding and other anniversary wording uses correct ordinals without icon inference',()=>{
 for(const [n,label] of [[1,'1st'],[2,'2nd'],[3,'3rd'],[4,'4th'],[11,'11th'],[12,'12th'],[13,'13th'],[21,'21st'],[22,'22nd'],[23,'23rd'],[30,'30th'],[111,'111th']])assert.equal(ordinal(n),label);
 const wedding={...event('1996-11-14'),repeat:'origin',eventType:'wedding',icon:'🌍'};
 assert.match(nextLabel(wedding,utcDate(2026,10,21)),/^30th wedding anniversary/);
 assert.match(nextLabel({...wedding,eventType:'anniversary'},utcDate(2026,10,21)),/^30th anniversary/);
 assert.match(nextLabel({...wedding,eventType:'general',icon:'rings'},utcDate(2026,10,21)),/^30-year anniversary/);
 assert.match(nextLabel({...wedding,date:'2028-11-14'},utcDate(2026,10,21)),/^Wedding day/);
});
