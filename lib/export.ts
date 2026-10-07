export function csvCell(value:unknown){let text=value===null||value===undefined?'':String(value);if(/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'}
export function toCSV(columns:string[],rows:Record<string,unknown>[]){return '\uFEFF'+[columns.map(csvCell).join(','),...rows.map(r=>columns.map(c=>csvCell(r[c])).join(','))].join('\r\n')+'\r\n'}
