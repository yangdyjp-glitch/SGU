import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { admissionsFixture,admissionsText } from './fixtures/admissions.mjs';
import { documentSchema,validateSchema } from '../lib/document-schema.mjs';
import { extractDocumentRules,readResponseStream } from '../lib/document-ai.mjs';
import { buildDocumentReview,refreshReviewValidation } from '../lib/document-organizer.mjs';
import { validateProgram,matchProgram,applicationWindow,validDate,tri,allState } from '../lib/engine.mjs';
import { importedLanguageAttempt } from '../lib/imported-program.mjs';
import { renderDocumentReview,blankDocumentProgram } from '../public/document-review.js';
import { renderProjectDetail } from '../public/project-detail.js';
import { renderSchoolDetail } from '../public/school-detail.js';
import { seedPrograms } from '../lib/seed.mjs';
import { queryPrograms } from '../lib/query.mjs';
import { reviewValidationVersion } from '../lib/document-review-version.mjs';
process.env.DATA_DIR='.qa/auto-unit-'+randomUUID();
process.env.DATABASE_URL='';
const {createDocumentWorkflow,emptyManualDraft}=await import('../lib/document-workflow.mjs');
const {confirmDocument}=await import('../lib/document-publish.mjs');
const store=await import('../lib/store.mjs');
const doc=()=>({id:randomUUID(),filename:'example.pdf',name:'example.pdf',text:admissionsText,status:'review'});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,icon:()=>'',badge:esc,tag:esc,button:(label,act,extra='',cls='')=>`<button data-act="${act}" ${extra}>${label}</button>`,evidence:()=>''};
const waitFor=async(test)=>{for(let i=0;i<150;i++){if(test())return;await delay(10);}throw new Error('workflow did not settle');};

test('shared queue recovery never resets another worker status or progress',async()=>{
 const saved={...doc(),status:'extracting',statusVersion:8,organizingProgress:{page:12},autoRetryCount:1,reviewerFeedback:'保留核对意见'};let statusWrites=0;
 const workflow=createDocumentWorkflow({documents:async()=>[structuredClone(saved)],programs:async()=>[],config:async()=>({apiKey:'test'}),canProcess:()=>true,
  mutate:fn=>fn(),saveStatus:()=>{statusWrites++;},withLease:async(id,fn)=>({acquired:true,result:await fn()}),retryDelay:10});
 // Inspect the durable result of resume without starting an endless mock lease.
 const queued=await workflow.enqueue(saved.id,'系统',{resume:true});
 assert.equal(queued.status,'extracting');assert.equal(queued.autoRetryCount,1);assert.deepEqual(queued.organizingProgress,{page:12});assert.equal(statusWrites,0);
 // The next read observes completion by the real owner and drains the local queue.
 saved.status='published';
});

test('a worker without the required parser leaves the shared job queued for a capable worker',async()=>{
 const saved={...doc(),status:'queued',text:''};let calls=0;
 const workflow=createDocumentWorkflow({documents:async()=>[structuredClone(saved)],programs:async()=>[],config:async()=>({apiKey:'test'}),canProcess:()=>false,mutate:fn=>fn(),parse:()=>{calls++;},saveStatus:()=>{calls++;}});
 await workflow.resumePending();assert.equal(workflow.isBusy(),false);assert.equal(calls,0);
});

test('strict schema requires complete fields while representing unknown dates, thresholds and facts explicitly',()=>{
 const data=admissionsFixture();assert.deepEqual(validateSchema(data),[]);
 data.programs[0].language[0].score=null;assert.deepEqual(validateSchema(data),[]);
 delete data.programs[0].materials;assert.ok(validateSchema(data).some(e=>e.includes('materials')));
 const check=s=>{if(s.type==='object'){assert.equal(s.additionalProperties,false);assert.deepEqual(s.required,Object.keys(s.properties));Object.values(s.properties).forEach(check);}if(s.items)check(s.items);s.anyOf?.forEach(check);};check(documentSchema);Object.values(documentSchema.$defs).forEach(check);
});

test('OpenAI request contains only this document and review feedback, uses strict Responses output and never stores it remotely',async()=>{
 const fixture=admissionsFixture();let request;
 const result=await extractDocumentRules(doc(),{apiKey:'test-secret-not-real',model:'gpt-6.1-sol'},{feedback:'核对意见',fetchImpl:async(url,options)=>{request={url,...options};return Response.json({status:'completed',output:[{type:'reasoning'},{content:[{type:'output_text',text:JSON.stringify(fixture)}]}]});}});
 assert.equal(request.url,'https://api.openai.com/v1/responses');const body=JSON.parse(request.body);
 assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.text.format.type,'json_schema');assert.equal(JSON.parse(body.input[0].content[0].text).reviewerCorrections,'核对意见');assert.doesNotMatch(request.body,/test-secret-not-real|students|sample-lin/);assert.deepEqual(result.extracted,fixture);
 for(const response of [{status:'incomplete',output:[]},{status:'completed',output:[{content:[{type:'refusal'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:'{}'}]}]}])await assert.rejects(()=>extractDocumentRules(doc(),{apiKey:'test',model:'test'},{fetchImpl:async()=>Response.json(response)}));
 await assert.rejects(()=>extractDocumentRules(doc(),{apiKey:'test',model:'test'},{fetchImpl:async()=>Response.json({error:'provider-secret'},{status:401})}),error=>!error.message.includes('provider-secret')&&/密钥/.test(error.message));
});

test('organizer preserves full rules, separates schools and years, records exact updates and detects unsupported evidence',()=>{
 const original=seedPrograms(),before=JSON.stringify(original),d=doc(),input=admissionsFixture();
 let result=buildDocumentReview(input,d,original);
 assert.equal(result.entries.length,2);assert.ok(result.entries.every(e=>e.mode==='create'));
 for(const entry of result.entries){assert.deepEqual(validateProgram(entry.program),[]);assert.equal(entry.program.materials[0].label,'两封推荐信');assert.equal(entry.program.language[0].speaking,6);assert.equal(entry.program.requirements[1].detail,input.programs[0].requirements[1].detail);assert.equal(entry.program.paths[0].source.sourceId,d.id);}
 const current={...result.entries[0].program,version:3};input.programs[0].language[0].score=7;
 result=buildDocumentReview(input,d,[...original,current]);assert.equal(result.entries[0].mode,'update');assert.equal(result.entries[0].expectedVersion,3);assert.equal(result.entries[0].program.id,current.id);assert.ok(result.entries[0].changes.some(c=>c.field==='language'));
 input.programs[0].paths[0].source={page:'99',quote:'invented evidence'};input.programs[0].year=2028;
 const separate=buildDocumentReview(input,d,[current]).entries[0];assert.equal(separate.mode,'create');assert.ok(separate.issues.some(i=>i.reason.includes('引用')));assert.equal(separate.program.paths[0].source.page,null);
 assert.equal(JSON.stringify(original),before);
});

test('streaming accepts only a complete response, handles UTF-8/chunk boundaries and rejects truncated results',async()=>{
 const result={status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(admissionsFixture())}]}]};
 const frames=[{type:'response.created'},{type:'response.output_text.delta',delta:'中文'}, {type:'response.completed',response:result}].map(event=>'data: '+JSON.stringify(event)+'\r\n\r\n').join('');
 const bytes=new TextEncoder().encode(frames),progress=[];
 const stream=new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=17)controller.enqueue(bytes.slice(i,i+17));controller.close();}});
 assert.deepEqual(await readResponseStream(new Response(stream,{headers:{'content-type':'text/event-stream'}}),p=>progress.push(p)),result);assert.equal(progress.at(-1).receivedCharacters,2);
 await assert.rejects(()=>readResponseStream(new Response('data: {"type":"response.output_text.delta","delta":"partial"}\n\n',{headers:{'content-type':'text/event-stream'}})),/传输中断/);
});

test('automatic review highlights doubts and preserves all details with just one overall confirmation',()=>{
 const d=doc();d.autoReview=buildDocumentReview(admissionsFixture(),d,[]);const html=renderDocumentReview(d,[],ui);
 assert.equal((html.match(/data-act="confirm-document"/g)||[]).length,1);assert.doesNotMatch(html,/type="checkbox"|document-target-form|确认资料归属/);
 assert.match(html,/<mark>The document does not clarify/);assert.match(html,/class="admission-section admission-doubt"/);assert.match(html,/两封推荐信/);assert.match(html,/译文须经认证/);assert.match(html,/≥ 6.5/);assert.match(html,/总分/);assert.match(html,/2026-11-30/);
 const p=d.autoReview.entries[0].program;assert.match(renderProjectDetail(p,ui),/提交两封推荐信；译文须经认证/);assert.match(renderSchoolDetail(p.school,[p],ui),/提交两封推荐信；译文须经认证/);
});

test('missing model configuration pauses after extraction; saving configuration resumes once, reuses text and retains draft until a new review is complete',async()=>{
 const d={...doc(),text:undefined,status:'uploaded'},saved=new Map([[d.id,d]]);let key='',parses=0,calls=0;const statuses=[];
 const workflow=createDocumentWorkflow({documents:()=>[...saved.values()].map(d=>structuredClone(d)),programs:()=>[],config:()=>({apiKey:key}),saveStatus:(value,status,actor,error)=>{Object.assign(value,{status,error,statusVersion:(value.statusVersion||0)+1});saved.set(value.id,structuredClone(value));statuses.push(status);},parse:async value=>{parses++;value.text=admissionsText;},extract:async()=>{calls++;await delay(25);return {extracted:admissionsFixture(),model:'test'};}});
 await Promise.all([workflow.enqueue(d.id,'test'),workflow.enqueue(d.id,'test')]);await waitFor(()=>!workflow.isBusy());assert.equal(saved.get(d.id).status,'needs_configuration');assert.equal(parses,1);assert.equal(calls,0);
 key='fake';await workflow.resumePending();await workflow.resumePending();await waitFor(()=>!workflow.isBusy());assert.equal(calls,1);assert.equal(parses,1);assert.equal(saved.get(d.id).status,'review');assert.equal(saved.get(d.id).autoReview.version,1);
 await workflow.enqueue(d.id,'test',{feedback:'核对意见',expectedReviewVersion:1});assert.equal(saved.get(d.id).autoReview.version,1);await waitFor(()=>!workflow.isBusy());assert.equal(saved.get(d.id).autoReview.version,2);assert.equal(parses,1);assert.deepEqual(statuses,['queued','needs_configuration','queued','extracting','review','queued','extracting','review']);
});

test('queue resumes interrupted correction jobs and processes documents sequentially',async()=>{
 const first=doc(),second=doc();first.status='extracting';first.autoReview={version:1};second.status='queued';const records=[first,second];let active=0,peak=0;
 const workflow=createDocumentWorkflow({documents:()=>records,programs:()=>[],config:()=>({apiKey:'fake'}),saveStatus:(d,s)=>d.status=s,extract:async()=>{active++;peak=Math.max(peak,active);await delay(20);active--;return {extracted:admissionsFixture()};}});
 await workflow.resumePending();await waitFor(()=>!workflow.isBusy());assert.equal(peak,1);assert.equal(first.status,'review');assert.equal(first.autoReview.version,2);assert.equal(second.status,'review');
});

test('scan configuration pause does not start empty semantic extraction, and OCR doubts use the existing overall review',async()=>{
 const d={...doc(),status:'uploaded',text:''};let extractionCalls=0;
 const workflow=createDocumentWorkflow({documents:()=>[d],programs:()=>[],config:()=>({apiKey:''}),saveStatus:(value,status)=>value.status=status,
  parse:async value=>{value.status='needs_configuration';},extract:async()=>{extractionCalls++;}});
 await workflow.enqueue(d.id,'test');await waitFor(()=>!workflow.isBusy());assert.equal(d.status,'needs_configuration');assert.equal(extractionCalls,0);
 const reviewed={...doc(),extractionWarnings:[{page:'2',quote:'[无法辨认]',reason:'分数识别不清'}]};
 reviewed.autoReview=buildDocumentReview(admissionsFixture(),reviewed,[]);
 const html=renderDocumentReview(reviewed,[],ui);
 assert.match(html,/第2页识别疑点：分数识别不清/);assert.match(html,/<mark>\[无法辨认\]<\/mark>/);
 assert.equal((html.match(/data-act="confirm-document"/g)||[]).length,1);
});

test('workflow durably resumes scoped extraction and exposes a review only after every project is complete',async()=>{
 const d=doc(),saved=new Map([[d.id,d]]),fixture=admissionsFixture();let bulk=0,index=0,first=0,second=0;
 const complete=value=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 const fetchImpl=async(url,options)=>{
  const body=JSON.parse(options.body),input=JSON.parse(body.input[0].content[0].text);
  if(body.text.format.name==='admissions_project_index'){index++;return complete({kind:fixture.kind,summary:fixture.summary,doubts:[],targets:fixture.programs.map(p=>({school:p.school,year:p.year,name:p.name,englishName:p.englishName,channel:p.channel,scope:p.name,source:p.paths[0].source}))});}
  if(!input.selectedProject){bulk++;return Response.json({status:'incomplete',incomplete_details:{reason:'max_output_tokens'}});}
  const target=input.selectedProject.name===fixture.programs[0].name?0:1;
  if(target===0)first++;else if(++second===1)throw new Error('connection interrupted');
  return complete({...fixture,programs:[fixture.programs[target]]});
 };
 const workflow=createDocumentWorkflow({documents:()=>[...saved.values()].map(d=>structuredClone(d)),programs:()=>[],config:()=>({apiKey:'test',model:'test'}),retryDelay:1,
  saveStatus:(value,status)=>{value.status=status;saved.set(value.id,structuredClone(value));},saveProgress:value=>saved.set(value.id,structuredClone(value)),
  extract:(doc,config,options)=>extractDocumentRules(doc,config,{...options,fetchImpl})});
 await workflow.enqueue(d.id,'test');await waitFor(()=>!workflow.isBusy());
 const result=saved.get(d.id);assert.equal(result.status,'review');assert.equal(result.autoReview.entries.length,2);
 assert.equal(bulk,1);assert.equal(index,1);assert.equal(first,1);assert.equal(second,2);
 assert.equal(result.analysis.organization,undefined);assert.equal(result.analysis.organizationMode,'by-program');
});

test('a broken model connection retries once automatically without re-parsing the file',async()=>{
 const d=doc();let calls=0,parses=0;
 const workflow=createDocumentWorkflow({documents:()=>[d],programs:()=>[],config:()=>({apiKey:'fake'}),saveStatus:(v,s)=>v.status=s,retryDelay:1,parse:async()=>{parses++;},extract:async()=>{calls++;if(calls===1)throw Object.assign(new Error('connection lost'),{retryable:true});return {extracted:admissionsFixture()};}});
 await workflow.enqueue(d.id,'test');await waitFor(()=>!workflow.isBusy());assert.equal(calls,2);assert.equal(parses,0);assert.equal(d.status,'review');
 const bad=doc();let failedCalls=0;
 const failing=createDocumentWorkflow({documents:()=>[bad],programs:()=>[],config:()=>({apiKey:'fake'}),saveStatus:(v,s)=>v.status=s,retryDelay:1,extract:async()=>{failedCalls++;throw Object.assign(new Error('connection lost'),{retryable:true});}});
 await failing.enqueue(bad.id,'test');await waitFor(()=>!failing.isBusy());assert.equal(failedCalls,2);assert.equal(bad.status,'error');
});

test('legacy empty shells migrate automatically with a preserved copy; manual rules are never replaced',async()=>{
 const first=doc(),second=doc(),draft={target:{mode:'create'},note:'',program:blankDocumentProgram({school:'早稻田大学',year:2027},first.id)};first.projectDraft=draft;second.projectDraft=structuredClone(draft);second.projectDraft.program.paths=admissionsFixture().programs[0].paths;
 assert.equal(emptyManualDraft(draft),true);assert.equal(emptyManualDraft(second.projectDraft),false);
 const workflow=createDocumentWorkflow({documents:()=>[first,second],programs:()=>[],config:()=>({apiKey:'fake'}),saveStatus:(d,s)=>d.status=s,extract:async()=>({extracted:admissionsFixture()})});
 await workflow.resumePending({includeLegacy:true});await waitFor(()=>!workflow.isBusy());assert.deepEqual(first.previousManualDraft,draft);assert.equal(first.projectDraft,undefined);assert.equal(first.autoReview.entries.length,2);assert.ok(second.projectDraft.program.paths.length);assert.equal(second.autoReview,undefined);await assert.rejects(()=>workflow.enqueue(second.id,'test'),/不会覆盖/);
});

test('one document publishes all projects atomically, rejects stale drafts and preserves students and prior rules',async()=>{
 const d=doc();d.autoReview=buildDocumentReview(admissionsFixture(),d,await store.getPrograms());await store.saveDocument(d);
 const before=JSON.stringify(await store.getPrograms());await store.saveStudent({id:'retained',name:'保留的学生'},'test');const student=JSON.stringify(await store.getStudent('retained'));
 await assert.rejects(()=>confirmDocument(d.id,{expectedReviewVersion:0,confirmed:true},'test'),/已更新/);assert.equal(JSON.stringify(await store.getPrograms()),before);
 const collision=d.autoReview.entries[1].program;await store.db.prepare('INSERT INTO versions VALUES(?,?,?,?,?,?,?,?)').run('test-collision',collision.id,1,JSON.stringify(collision),'test','rollback test',store.now(),null);
 await assert.rejects(()=>confirmDocument(d.id,{expectedReviewVersion:1,confirmed:true},'test'));assert.equal(JSON.stringify(await store.getPrograms()),before);assert.equal((await store.getDocuments()).find(x=>x.id===d.id).status,'review');
 await store.db.prepare('DELETE FROM versions WHERE id=?').run('test-collision');
 const result=await confirmDocument(d.id,{expectedReviewVersion:1,confirmed:true},'test');assert.equal(result.programs.length,2);assert.equal(result.document.status,'published');assert.equal(result.programs[0].verificationNotes.length,1);assert.equal((await store.getPrograms()).length,7);assert.equal(JSON.stringify(await store.getStudent('retained')),student);
 assert.equal((await confirmDocument(d.id,{expectedReviewVersion:1,confirmed:true},'test')).alreadyPublished,true);assert.equal((await store.db.prepare('SELECT count(*) n FROM versions').get()).n,7);
 const updated=doc();updated.autoReview=buildDocumentReview(admissionsFixture(),updated,await store.getPrograms());await store.saveDocument(updated);await store.saveProgram(result.programs[1],'coworker','并发修改',1);
 await assert.rejects(()=>confirmDocument(updated.id,{expectedReviewVersion:1,confirmed:true},'test'),/核对期间被更新/);assert.equal((await store.getProgram(result.programs[0].id)).version,1);
});

test('unknown imported requirements never become automatic passes and absent dates cannot crash matching',()=>{
 const d=doc(),p=buildDocumentReview(admissionsFixture(),d,[]).entries[0].program,round=p.rounds[0];
 const student={schoolCountry:'中国',educationYears:12,formalEducation:true,standard12:true,birthDate:'2008-01-01',educationStatus:'completed',graduationDate:'2026-06-01',exams:[{exam:'IELTS Academic Module',score:7,reading:7,listening:7,writing:7,speaking:7,date:'2026-01-01',availableDate:'2026-01-15',format:'center',scale:'0–9'}]};
 assert.equal(matchProgram(student,p,round).state,'pass');assert.equal(applicationWindow(round).status,'unknown');
 p.language[0].score=null;p.language[0].minimumStatus='unspecified';assert.equal(matchProgram(student,p,round).state,'unknown');
 p.language[0].score=6.5;p.language[0].minimumStatus='stated';p.languagePolicy.validYears=null;assert.equal(matchProgram(student,p,round).state,'unknown');
 p.rounds[0].enrollmentDate=null;p.rounds[0].applyEnd=null;assert.doesNotThrow(()=>matchProgram(student,p,round));
 p.languageRequirement='not-required';p.paths[0].all=[];assert.equal(matchProgram(student,p,round).state,'unknown');
});

test('imported queries retain unknown thresholds and their own source instead of borrowing seed-school facts',()=>{
 const d=doc(),p=buildDocumentReview(admissionsFixture(),d,[]).entries[0].program;
 p.language[0].score=null;p.language[0].minimumStatus='unspecified';const result=queryPrograms({exam:'IELTS Academic Module',maxScore:6.5},[p]);assert.equal(result.matched.length,0);assert.equal(result.uncertain.length,1);
 const refs=queryPrograms({mode:'reference'},[p]);assert.equal(refs.matched[0].sources[0].sourceId,d.id);
 const ages=queryPrograms({mode:'age'},[p]);assert.equal(ages.uncertain.length,1);assert.doesNotMatch(JSON.stringify(ages),/G／H／I|aohb27/);
 p.rounds=[];assert.equal(queryPrograms({academic:'not-required'},[p]).matched.length,1);
});

test('imported validity uses the stated first day or deadline, and never guesses an unstated anchor',()=>{
 const p=buildDocumentReview(admissionsFixture(),doc(),[]).entries[0].program,round=p.rounds[0];
 const exam={exam:'IELTS Academic Module',score:7,reading:7,listening:7,writing:7,speaking:7,date:'2024-11-15',availableDate:'2024-11-20',format:'center'};
 const attempt=()=>importedLanguageAttempt(exam,p,round,false,{validDate,tri,allState});
 assert.equal(attempt().state,'fail');
 p.languagePolicy.detail='考试须在网申首日前两年内参加，官方成绩须在网申最后一天前可获得。';p.languagePolicy.source.quote='the official score must be available by the last day of the Application Period';
 exam.date='2024-11-01';assert.equal(attempt().state,'pass');exam.date='2024-10-31';assert.equal(attempt().state,'fail');
 p.languagePolicy.detail='成绩有效期两年。';p.languagePolicy.source.quote='Scores are valid for two years.';p.languagePolicy.validUntil='2026-11-30';assert.equal(attempt().state,'unknown');
 p.languagePolicy.validAfter='2024-10-01';assert.equal(attempt().state,'pass');
});

test('named prohibited formats apply only to their exam and IELTS does not require a TOEFL scale',()=>{
 const p=buildDocumentReview(admissionsFixture(),doc(),[]).entries[0].program,round=p.rounds[0],exam={exam:'IELTS Academic Module',score:7,reading:7,listening:7,writing:7,speaking:7,date:'2026-01-01',availableDate:'2026-01-15',format:'center'};
 p.languagePolicy.excludedFormats=['TOEFL Home Edition','TOEFL ITP','IELTS Online','TOEFL MyBest scores'];p.languagePolicy.allowSuperscore=false;
 const attempt=()=>importedLanguageAttempt(exam,p,round,false,{validDate,tri,allState});
 assert.equal(attempt().state,'pass');exam.format='one-skill';assert.equal(attempt().state,'pass');exam.format='online';assert.equal(attempt().state,'fail');
 exam.format='center';exam.superscore=true;assert.equal(attempt().state,'unknown');
 exam.exam='TOEFL iBT';exam.superscore=false;exam.format='home';assert.equal(attempt().state,'fail');exam.format='institutional';assert.equal(attempt().state,'fail');
});

test('imported age uses the stated reference or enrollment date and JST dates are recognized',()=>{
 const p=buildDocumentReview(admissionsFixture(),doc(),[]).entries[0].program,round=p.rounds[0];p.languageRequirement='not-required';
 p.paths[0].all=[{...p.paths[0].all[0],field:'ageAtEnrollment',op:'gte',value:18,label:'入学时年满18岁'}];
 const student={birthDate:'2009-04-01',educationStatus:'completed',graduationDate:'2027-03-01'};
 assert.equal(matchProgram(student,p,round).education.state,'pass');assert.equal(matchProgram(student,p,round).generalEducation.state,'unknown');p.paths[0].all[0].referenceDate='2027-03-31';assert.equal(matchProgram(student,p,round).state,'fail');
 round.startTime='10:00';round.timezone='JST';assert.equal(applicationWindow(round,new Date('2026-11-15T00:00:00Z')).status,'open');
});

test('fragment citations remain verifiable, infer unique pages and retain fabricated-fragment warnings',()=>{
 const d=doc(),input=admissionsFixture();const source=input.programs[0].materials[0].source;
 source.page=null;source.quote='Submit two recommendation letters.; Translations must be certified.';
 let entry=buildDocumentReview(input,d,[]).entries[0];assert.equal(entry.program.materials[0].source.page,'2');assert.ok(!entry.issues.some(i=>i.path==='/materials/0'));
 source.quote='Submit two recommendation letters.; Imaginary invented requirement.';
 entry=buildDocumentReview(input,d,[]).entries[0];assert.equal(entry.issues.filter(i=>i.path==='/materials/0').length,1);assert.match(entry.issues.find(i=>i.path==='/materials/0').reason,/引用/);
});

test('validation upgrades preserve model doubts and formal values, without touching published reviews',()=>{
 const d=doc();d.autoReview=buildDocumentReview(admissionsFixture(),d,[]);delete d.autoReview.validationVersion;
 for(const entry of d.autoReview.entries){delete entry.modelDoubts;entry.issues.push({path:'/paths',reason:'此条件已完整保留，学生匹配时需要核实相关事实',kind:'uncertain'});}
 const refreshed=refreshReviewValidation(d,[]);assert.equal(refreshed.version,2);assert.equal(refreshed.validationVersion,reviewValidationVersion);assert.equal(refreshed.entries[0].issues.length,1);assert.match(refreshed.entries[0].issues[0].reason,/拼分/);assert.deepEqual(refreshed.entries[0].program,d.autoReview.entries[0].program);
 d.status='published';assert.equal(refreshReviewValidation(d,[]),null);
});

test('published conditional tuition retains every fee, allows overall confirmation and never treats null as zero',async()=>{
 const d=doc(),input=admissionsFixture();
 const quote='Tuition: Japanese Students: 267,900 JPY / semester (535,800 JPY / year) *subject to change International Students: 450,000 JPY / semester (900,000 JPY / year) *subject to change';
 d.text+='\n<!-- page 3 of 3 -->\n'+quote.replaceAll('*','\\*');
 const tuition={status:'published',amount:null,currency:'JPY',period:'学年',detail:'日本学生等：535800日元/年、267900日元/学期；国际学生：900000日元/年、450000日元/学期。国际学生指持留学在留资格在日居住者；金额暂定且可调整。',source:{page:'3',quote}};
 input.programs.forEach(p=>{p.name+='分档收费';p.englishName+=' Tiered tuition';p.tuition=structuredClone(tuition);});
 d.autoReview=buildDocumentReview(input,d,await store.getPrograms());
 for(const {program:p,issues} of d.autoReview.entries){
  assert.deepEqual(validateProgram(p),[]);
  assert.ok(!issues.some(i=>i.kind==='blocking'));
  assert.equal(issues.filter(i=>i.path==='/tuition').length,1,'escaped Markdown must not create a false source warning');
  assert.equal(p.tuition.amount,null);assert.equal(p.tuition.detail,tuition.detail);
  assert.equal(matchProgram({budget:0},p,p.rounds[0]).preferences[0].state,'unknown');
  for(const budget of [0,1,1000000]){const result=queryPrograms({mode:'tuition',tuition:budget},[p]);assert.equal(result.matched.length,0);assert.equal(result.uncertain.length,1);assert.ok(result.uncertain[0].reasons.includes('已公布收费标准，按适用条件核对。 '+tuition.detail));}
  assert.equal(queryPrograms({mode:'tuition'},[p]).matched.length,1);
  for(const html of [renderDocumentReview(d,[],ui),renderProjectDetail(p,ui),renderSchoolDetail(p.school,[p],ui)]){assert.ok(html.includes(esc(tuition.detail)));assert.doesNotMatch(html,/null JPY|>0 JPY|年度金额未注明/);}
 }
 assert.doesNotMatch(renderDocumentReview(d,[],ui),/data-act="confirm-document"[^>]*disabled/);
 const original=d.autoReview.entries[0].program;
 for(const change of [{amount:-1},{amount:NaN},{currency:''},{period:''},{detail:''},{source:{page:'3',quote:''}}])assert.ok(validateProgram({...original,tuition:{...original.tuition,...change}}).some(error=>/学费/.test(error)));
 const numeric={...original,tuition:{...original.tuition,amount:900000}};
 assert.equal(matchProgram({budget:899999},numeric,numeric.rounds[0]).preferences[0].state,'fail');
 assert.equal(matchProgram({budget:900000},numeric,numeric.rounds[0]).preferences[0].state,'pass');
 d.autoReview.validationVersion=2;d.autoReview.entries.forEach(entry=>entry.issues.push({path:'/coverage',reason:'已公布学费需金额、币种和周期，请补充核对意见后重新整理',kind:'blocking'}));
 const prior=JSON.stringify(d);const refreshed=refreshReviewValidation(d,await store.getPrograms());assert.equal(JSON.stringify(d),prior);
 assert.ok(refreshed.entries.every(entry=>!entry.issues.some(i=>i.kind==='blocking')));
 assert.equal(refreshed.entries[0].program.tuition.detail,tuition.detail);
 d.autoReview=refreshed;await store.saveDocument(d);
 const student=JSON.stringify(await store.getStudent('retained'));
 assert.equal((await confirmDocument(d.id,{expectedReviewVersion:refreshed.version,confirmed:true},'test')).programs.length,2);
 assert.equal(JSON.stringify(await store.getStudent('retained')),student);
});
