import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve('dist/client');
async function assets(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await assets(file));else if(/\.(js|css|woff2?|png|svg)$/.test(entry.name))result.push('/'+path.relative(root,file).replaceAll('\\','/'));}return result;}
const files=(await assets(path.join(root,'_next'))).sort();
const version=createHash('sha256').update(JSON.stringify(files)).update(await readFile('public/sw.js')).digest('hex').slice(0,16);
await writeFile(path.join(root,'pwa-assets.json'),JSON.stringify(files));
await writeFile(path.join(root,'sw.js'),(await readFile('public/sw.js','utf8')).replace('__BUILD__',version));
console.log('PWA: prepared '+files.length+' offline assets.');
