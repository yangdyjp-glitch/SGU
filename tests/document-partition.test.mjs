import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDocumentRules } from '../lib/document-ai.mjs';
import { admissionsFixture,admissionsText } from './fixtures/admissions.mjs';

const fixture=admissionsFixture(),config={apiKey:'test-only-secret',model:'gpt-6.1-sol'};
const source=()=>({filename:'multi-program.pdf',text:admissionsText});
const manifest=()=>({kind:fixture.kind,summary:fixture.summary,targets:fixture.programs.map(p=>({school:p.school,year:p.year,name:p.name,englishName:p.englishName,channel:p.channel,scope:p.name,source:p.paths[0].source})),doubts:fixture.doubts});
const complete=extracted=>Response.json({status:'completed',model:config.model,usage:{input_tokens:10,output_tokens:20,total_tokens:30},output:[{content:[{type:'output_text',text:JSON.stringify(extracted)}]}]});
const tooLong=()=>Response.json({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},usage:{input_tokens:5,output_tokens:5,total_tokens:10},output:[{content:[{type:'output_text',text:'{"programs":[incomplete data'}]}]});
const part=index=>({...structuredClone(fixture),programs:[structuredClone(fixture.programs[index])]});

test('oversized documents are indexed and fully extracted per project without dropping shared text or accepting truncation',async()=>{
 const requests=[],checkpoints=[];
 const result=await extractDocumentRules(source(),config,{onCheckpoint:async c=>checkpoints.push(structuredClone(c)),fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body),input=JSON.parse(body.input[0].content[0].text);requests.push({body,input});
  if(requests.length===1)return tooLong();if(requests.length===2)return complete(manifest());
  return complete(part(requests.length-3));
 }});
 assert.equal(requests.length,4);assert.equal(result.partitioned,true);assert.deepEqual(result.extracted.programs,fixture.programs);
 for(const {body,input} of requests){assert.equal(body.store,false);assert.equal(body.model,config.model);assert.equal(input.document,admissionsText);assert.equal(body.text.format.strict,true);}
 assert.equal(requests[2].input.selectedProject.name,fixture.programs[0].name);assert.equal(requests[3].input.selectedProject.name,fixture.programs[1].name);
 assert.equal(checkpoints.at(-1).parts.length,2);assert.equal(result.usage.total_tokens,100);
});

test('completed scoped projects resume after a later connection failure, while corrected input invalidates their cache',async()=>{
 const doc=source();let calls=0;
 const onCheckpoint=async organization=>{doc.analysis={organizationMode:'by-program',organization:structuredClone(organization)};};
 await assert.rejects(extractDocumentRules(doc,config,{onCheckpoint,fetchImpl:async()=>{
  if(++calls===1)return tooLong();if(calls===2)return complete(manifest());if(calls===3)return complete(part(0));throw new Error('network interrupted');
 }}),{retryable:true});
 assert.equal(doc.analysis.organization.parts.length,1);let resumed=0;
 const result=await extractDocumentRules(doc,config,{onCheckpoint,fetchImpl:async(url,options)=>{
  const input=JSON.parse(JSON.parse(options.body).input[0].content[0].text);assert.equal(input.selectedProject.name,fixture.programs[1].name);resumed++;return complete(part(1));
 }});
 assert.equal(resumed,1);assert.deepEqual(result.extracted.programs,fixture.programs);
 let corrected=0;
 await extractDocumentRules(doc,config,{feedback:'新的核对意见',onCheckpoint,fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body),input=JSON.parse(body.input[0].content[0].text);assert.equal(input.reviewerCorrections,'新的核对意见');corrected++;
  if(body.text.format.name==='admissions_project_index')return complete(manifest());
  return complete(part(input.selectedProject.name===fixture.programs[0].name?0:1));
 }});
 assert.equal(corrected,3);
});

test('a missing project, wrong identity or incomplete scoped result cannot produce an overall review',async()=>{
 for(const bad of [{...part(0),programs:[]},part(1),{...part(0),kind:'other'}]){
  const doc={...source(),analysis:{organizationMode:'by-program'}};let calls=0;
  await assert.rejects(extractDocumentRules(doc,config,{fetchImpl:async()=>++calls===1?complete(manifest()):complete(bad)}),/归属/);
 }
 let calls=0;
 await assert.rejects(extractDocumentRules({...source(),analysis:{organizationMode:'by-program'}},config,{fetchImpl:async()=>++calls===1?complete(manifest()):tooLong()}),{code:'max_output_tokens'});
});
