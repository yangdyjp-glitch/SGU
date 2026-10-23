import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { openDatabase,initializeDatabase } from '../lib/database.mjs';
import { readDocument,readDocumentSummaries,readRecoveryDocuments } from '../lib/document-storage.mjs';
import { documentSummary } from '../public/document-status.js';

export async function exerciseDocumentReads(db){
 const text='不得遗漏的完整资格、成绩与原文。'.repeat(3000);
 const large={text,suggestions:[{text}],projectDraft:{program:{text}},previousManualDraft:{text},previousAutoReview:{text},analysis:{text},reviewerFeedback:text};
 const rows=[
  {id:'poll-review',status:'review',statusVersion:8,...large,autoReview:{version:4,validationVersion:3,entries:[{text}]}},
  {id:'poll-parsing',status:'parsing',organizingProgress:{phase:'pdf',page:2,pages:3}},
  {id:'poll-extracting',status:'extracting',text,autoReview:{version:1,validationVersion:3,entries:[{text}]}},
  {id:'poll-config',status:'needs_configuration',text:''},
  {id:'poll-legacy',status:'review',text},
  {id:'poll-old-validation',status:'review',text,autoReview:{version:1,validationVersion:2}},
  {id:'poll-error-old',status:'error',error:'MinerU server_not_running'},
  {id:'poll-error-current',status:'error',workflowVersion:2,error:'model failure'},
  {id:'poll-published',status:'published',text,autoReview:{version:2,validationVersion:2}},
 ];
 for(const row of rows)await db.prepare('INSERT INTO documents VALUES(?,?)').run(row.id,JSON.stringify(row));
 let transferredBytes=0;
 const measured={kind:db.kind,prepare:sql=>({all:async()=>{const result=await db.prepare(sql).all();transferredBytes+=JSON.stringify(result).length;return result;}})};
 const summaries=await readDocumentSummaries(measured);
 for(const row of rows)assert.deepEqual(summaries.find(d=>d.id===row.id),documentSummary(row));
 assert.ok(transferredBytes<10000,'summary SQL must not transfer full transcripts or drafts');
 assert.deepEqual(await readDocument(db,'poll-review'),rows[0]);assert.equal(await readDocument(db,'missing'),null);
 const recovered=await readRecoveryDocuments(db);
 assert.deepEqual(recovered.filter(d=>d.id.startsWith('poll-')).map(d=>d.id).sort(),['poll-parsing','poll-extracting','poll-config','poll-legacy','poll-old-validation','poll-error-old'].sort());
 assert.equal(recovered.find(d=>d.id==='poll-extracting').text,text);
}

test('document polling transfers only summaries; recovery reads only active or outdated documents',async()=>{
 const path='.qa/document-storage-'+randomUUID();await mkdir(path,{recursive:true});
 const db=await openDatabase({url:'',filename:path+'/sgu.db'});
 try{await initializeDatabase(db);await exerciseDocumentReads(db);}finally{await db.close();}
});
