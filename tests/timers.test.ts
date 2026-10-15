import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dateInput,dateISO,timerPrecision,formatDuration,elapsed,timerStatus,matches,type Timer} from '../lib/timers.ts';
import {assertEventDate,assertTimerDate,timerInput} from '../lib/validation.ts';
const t:Timer={id:'t',workspaceId:'w',folderId:null,title:'Fast food',note:'Takeaway',kind:'since',startedAt:'2026-10-01T00:00:00.000Z',counter:true,labels:['food','health'],color:'peach',emoji:'🍔',count:0,lastEvent:null};
test('a reset uses event time rather than initial start',()=>{assert.deepEqual(elapsed({...t,lastEvent:'2026-10-05T01:02:03.000Z',count:1},Date.parse('2026-10-06T03:04:06.000Z')),{days:1,hours:2,minutes:2,seconds:3,done:false})});
test('countdown reaches zero and never becomes negative',()=>{assert.equal(elapsed({...t,kind:'until'},Date.parse('2026-10-02T00:00:00Z')).days,0);assert.equal(elapsed({...t,kind:'until'},Date.parse('2026-10-02T00:00:00Z')).done,true)});
test('search matches titles, notes and #labels without case sensitivity',()=>{assert.equal(matches(t,'#HEALTH',''),true);assert.equal(matches(t,'TAKEAWAY','food'),true);assert.equal(matches(t,'','travel'),false)});
test('counter remains derived from recorded events, not elapsed days',()=>{assert.equal(elapsed(t,Date.parse('2026-10-06T00:00:00Z')).days,5);assert.equal(t.count,0)});
test('reject future events and events before initial start',()=>{assert.throws(()=>assertEventDate('2026-10-07T00:00:00Z',t.startedAt,Date.parse('2026-10-06T00:00:00Z')));assert.throws(()=>assertEventDate('2026-09-01T00:00:00Z',t.startedAt));assert.throws(()=>assertTimerDate('since','2026-10-07T00:00:00Z',Date.parse('2026-10-06T00:00:00Z')))});
test('labels are normalized and duplicate labels removed',()=>{const parsed=timerInput.parse({...t,labels:[' Health ','health','Food']});assert.deepEqual(parsed.labels,['health','food']);assert.throws(()=>timerInput.parse({...t,title:'   '}));assert.throws(()=>timerInput.parse({...t,labels:['<script>']}))});
test('lifetime statuses and duration freeze at the end',()=>{const phone={...t,resetEnabled:false,endedAt:'2026-10-04T00:00:00.000Z',lastEvent:'2026-10-03T00:00:00.000Z'};assert.equal(timerStatus(phone,Date.parse('2026-09-30T00:00:00Z')),'Future');assert.equal(timerStatus(phone,Date.parse('2026-10-02T00:00:00Z')),'Active');assert.equal(timerStatus(phone,Date.parse(phone.endedAt)),'Closed');assert.equal(elapsed(phone,Date.parse('2026-10-10T00:00:00Z')).days,3);assert.equal(elapsed({...phone,endedAt:null},Date.parse('2026-10-10T00:00:00Z')).days,9)});
test('end date validation and legacy reset defaults',()=>{assert.equal(timerInput.parse(t).resetEnabled,true);assert.equal(timerInput.parse({...t,resetEnabled:false,endedAt:'2026-10-02T00:00:00Z'}).endedAt,'2026-10-02T00:00:00.000Z');assert.throws(()=>timerInput.parse({...t,endedAt:'2026-10-02T00:00:00Z'}));assert.throws(()=>timerInput.parse({...t,resetEnabled:false,endedAt:'2026-09-01T00:00:00Z'}));assert.equal(timerStatus({...t,kind:'until'},Date.parse(t.startedAt)),'Closed')});

test('duration expands exactly at seconds, minutes, hours, days, months and years',()=>{
 const cases:[number,string][]=[[0,'0s'],[59,'59s'],[60,'1m 0s'],[3599,'59m 59s'],[3600,'1h 0m 0s'],[86399,'23h 59m 59s'],[86400,'1d 0h 0m 0s'],[30*86400-1,'29d 23h 59m 59s'],[30*86400,'1mo 0d 0h 0m 0s'],[365*86400-1,'12mo 4d 23h 59m 59s'],[365*86400,'1y 0mo 0d 0h 0m 0s'],[2*365*86400+33*86400+3661,'2y 1mo 3d 1h 1m 1s']];
 for(const [seconds,expected] of cases)assert.equal(formatDuration(seconds),expected);
});
test('precision truncates smaller units and preserves a meaningful sub-unit reading',()=>{
 assert.equal(formatDuration(2*86400+5*3600+42*60+9,'hours'),'2d 5h');assert.equal(formatDuration(59,'minutes'),'<1m');assert.equal(formatDuration(0,'seconds'),'0s');assert.equal(formatDuration(-5),'0s');assert.equal(formatDuration(400*86400,'months'),'1y 1mo');assert.equal(formatDuration(366*86400,'years'),'1y');assert.equal(timerInput.parse(t).precision,'seconds');assert.equal(timerInput.parse({...t,precision:'days'}).precision,'days');assert.throws(()=>timerInput.parse({...t,precision:'invalid'}));
});

test('date-only timers preserve the chosen date and restrict precision',()=>{
 assert.equal(dateISO('2026-10-15',true),'2026-10-15T00:00:00.000Z');assert.equal(dateInput('2026-10-15T00:00:00Z',true),'2026-10-15');
 assert.equal(timerInput.parse({...t,dateOnly:true,precision:'seconds'}).precision,'days');assert.equal(timerInput.parse({...t,dateOnly:true,precision:'months'}).precision,'months');assert.equal(timerInput.parse(t).dateOnly,false);assert.equal(timerPrecision({...t,dateOnly:true,precision:'hours'}),'days');
});
test('date-only durations follow local calendar boundaries, including daylight saving',()=>{
 const previous=process.env.TZ;try{process.env.TZ='America/New_York';const timer={...t,dateOnly:true,startedAt:'2026-03-07T00:00:00.000Z'};
 assert.deepEqual(elapsed(timer,new Date(2026,2,9,0,0).getTime()),{days:2,hours:0,minutes:0,seconds:0,done:false});assert.equal(elapsed(timer,new Date(2026,2,9,23,59).getTime()).days,2);
 const countdown={...timer,kind:'until' as const,startedAt:'2026-03-10T00:00:00.000Z'};assert.equal(elapsed(countdown,new Date(2026,2,9,23,59).getTime()).days,1);assert.equal(timerStatus(countdown,new Date(2026,2,10,0,0).getTime()),'Closed');
 const life={...timer,resetEnabled:false,endedAt:'2026-03-08T00:00:00.000Z'};assert.equal(elapsed(life,new Date(2026,2,10).getTime()).days,1);assert.equal(timerStatus(life,new Date(2026,2,8).getTime()),'Closed');
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('date-only reset validation accepts today before UTC midnight and rejects tomorrow',()=>{
 const previous=process.env.TZ;try{process.env.TZ='Asia/Kolkata';const now=new Date(2026,9,15,0,15).getTime();assert.doesNotThrow(()=>assertTimerDate('since','2026-10-15T00:00:00Z',now,true));assert.doesNotThrow(()=>assertEventDate('2026-10-15T00:00:00Z',t.startedAt,now,true));assert.throws(()=>assertEventDate('2026-10-16T00:00:00Z',t.startedAt,now,true));}finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
