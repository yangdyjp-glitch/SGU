import { spawnSync } from 'node:child_process';
import { readdirSync,readFileSync,statSync } from 'node:fs';
import { join } from 'node:path';
const files=['server.mjs',...readdirSync('lib').filter(f=>f.endsWith('.mjs')).map(f=>'lib/'+f),...readdirSync('public').filter(f=>f.endsWith('.js')).map(f=>'public/'+f)];
for(const file of files){const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(r.status)process.exit(r.status);}
const {seedPrograms}=await import('../lib/seed.mjs');const {validateProgram}=await import('../lib/engine.mjs');
for(const p of seedPrograms()){const errors=validateProgram(p);if(errors.length)throw new Error(`${p.id}: ${errors.join(';')}`);}
for(const file of ['public/index.html','public/styles.css','public/compact.css','public/favicon.svg','public/sources/aohb27.pdf'])if(!statSync(file).size)throw new Error(file+' is empty');
console.log('Syntax, seed rules and required assets: OK');
