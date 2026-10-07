import {test} from 'node:test';
import assert from 'node:assert/strict';
import {csvCell,toCSV} from '../lib/export.ts';
import {colors,cardColor,cardInk} from '../lib/timers.ts';
import {timerInput} from '../lib/validation.ts';
test('CSV preserves commas, quotes, newlines and Unicode',()=>{assert.equal(csvCell('A,"B"\n健康'),'"A,""B""\n健康"');assert.equal(toCSV(['note'],[{note:'α'}]),'\uFEFF"note"\r\n"α"\r\n')});
test('CSV neutralizes spreadsheet formula cells',()=>{for(const v of ['=1+1',' +cmd','-cmd','@SUM(A1)'])assert.equal(csvCell(v),'"\''+v+'"')});
test('custom colors validate, legacy colors remain readable, and palette has over 20 presets',()=>{assert.ok(colors.length>20);assert.equal(cardColor('#123AbC'),'#123AbC');assert.equal(cardColor('peach'),'#FFAB40');assert.equal(cardInk('#000000'),'#ffffff');assert.equal(cardInk('#ffffff'),'#171717');const t={id:'t',workspaceId:'w',folderId:null,title:'t',note:'',kind:'since',startedAt:'2026-10-01T00:00:00Z',counter:true,labels:[],color:'#FF5252'};assert.equal(timerInput.parse(t).emoji,'');assert.throws(()=>timerInput.parse({...t,color:'javascript:red'}))});
