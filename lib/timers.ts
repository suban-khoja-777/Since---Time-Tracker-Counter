export type Workspace = { id: string; name: string };
export type Folder = { id: string; workspaceId: string; name: string };
export type Timer = { id: string; workspaceId: string; folderId: string | null; title: string; note: string; kind: 'since' | 'until'; startedAt: string; resetEnabled?: boolean; endedAt?: string | null; counter: boolean; labels: string[]; color: string; emoji: string; count: number; lastEvent: string | null };
export type Event = { id: string; timerId: string; happenedAt: string; note: string; createdAt: string };
export type Label = { id:string; workspaceId:string; name:string };
export type Snapshot = { workspaces: Workspace[]; folders: Folder[]; labels: Label[]; timers: Timer[]; user: { name: string; email: string } };
export const colors = ['#FF5252','#FF1744','#F50057','#E040FB','#D500F9','#7C4DFF','#651FFF','#536DFE','#3D5AFE','#448AFF','#2979FF','#40C4FF','#00B0FF','#18FFFF','#00E5FF','#64FFDA','#1DE9B6','#69F0AE','#00E676','#B2FF59','#76FF03','#EEFF41','#C6FF00','#FFFF00','#FFD740','#FFC400','#FFAB40','#FF9100','#FF6E40','#FF3D00'] as const;
const legacyColors:Record<string,string>={mint:'#69F0AE',peach:'#FFAB40',lavender:'#B388FF',sky:'#40C4FF',rose:'#FF80AB',sand:'#FFD740'};
export function cardColor(color:string){return /^#[0-9a-f]{6}$/i.test(color)?color:legacyColors[color]??'#69F0AE'}
export function cardInk(color:string){const hex=cardColor(color).slice(1);const values=[0,2,4].map(i=>{const v=parseInt(hex.slice(i,i+2),16)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return values[0]*.2126+values[1]*.7152+values[2]*.0722>.179?'#171717':'#ffffff'}
export function timerStatus(timer:Timer,now:number):'Future'|'Active'|'Closed'{
 const start=Date.parse(timer.startedAt);
 if(timer.kind==='until')return now>=start?'Closed':'Active';
 if(now<start)return 'Future';
 return timer.resetEnabled===false&&timer.endedAt&&now>=Date.parse(timer.endedAt)?'Closed':'Active';
}
export function elapsed(timer: Timer, now: number) {
 const anchor=Date.parse(timer.kind==='since'?(timer.resetEnabled===false?timer.startedAt:timer.lastEvent??timer.startedAt):timer.startedAt);
 const finish=timer.resetEnabled===false&&timer.endedAt?Math.min(now,Date.parse(timer.endedAt)):now;
 const seconds=Math.max(0,Math.floor((timer.kind==='since'?(now<anchor?anchor-now:finish-anchor):anchor-now)/1000));
 return {days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60,done:timer.kind==='until'&&now>=anchor};
}
export function localDate(value: string | number = Date.now()) { const d=new Date(value); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); }
export function matches(timer:Timer,query:string,label:string){const q=query.trim().toLocaleLowerCase().replace(/^#/,'');return(!label||timer.labels.includes(label))&&(!q||`${timer.title} ${timer.note} ${timer.labels.join(' ')}`.toLocaleLowerCase().includes(q))}
