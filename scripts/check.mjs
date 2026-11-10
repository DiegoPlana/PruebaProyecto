import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
for(const folder of ['src','scripts','public','test']) for(const file of await readdir(folder)) {
 if(!/\.(mjs|js)$/.test(file))continue;
 const result=spawnSync(process.execPath,['--check',`${folder}/${file}`],{stdio:'inherit'});
 if(result.status)process.exit(result.status);
}
console.log('Sintaxis JavaScript comprobada.');

const pages=spawnSync(process.execPath,['scripts/build-pages.mjs','--check'],{stdio:'inherit'});
if(pages.status)process.exit(pages.status);
