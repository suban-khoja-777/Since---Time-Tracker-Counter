export type Workspace = { id: string; name: string };
export type Folder = { id: string; workspaceId: string; name: string };
export type Timer = { id: string; workspaceId: string; folderId: string | null; title: string; note: string; kind: 'since' | 'until'; startedAt: string; counter: boolean; labels: string[]; color: string; emoji: string; count: number; lastEvent: string | null };
export type Event = { id: string; timerId: string; happenedAt: string; note: string; createdAt: string };
export type Snapshot = { workspaces: Workspace[]; folders: Folder[]; timers: Timer[]; user: { name: string; email: string } };
export const colors = ['mint','peach','lavender','sky','rose','sand'] as const;
export function elapsed(timer: Timer, now: number) {
 const anchor=Date.parse(timer.kind==='since'?(timer.lastEvent??timer.startedAt):timer.startedAt);
 const seconds=Math.max(0,Math.floor((timer.kind==='since'?now-anchor:anchor-now)/1000));
 return {days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60,done:timer.kind==='until'&&now>=anchor};
}
export function localDate(value: string | number = Date.now()) { const d=new Date(value); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); }
export function matches(timer:Timer,query:string,label:string){const q=query.trim().toLocaleLowerCase().replace(/^#/,'');return(!label||timer.labels.includes(label))&&(!q||`${timer.title} ${timer.note} ${timer.labels.join(' ')}`.toLocaleLowerCase().includes(q))}
