// Test-only transport. Production has no alternate endpoint or mock switch.
import { admissionsFixture } from './admissions.mjs';
const original=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 if(String(url).startsWith('https://api.openai.com/v1/models/'))return Response.json({id:'gpt-6.1-sol'});
 if(String(url)!=='https://api.openai.com/v1/responses')return original(url,options);
 const body=JSON.parse(options.body),input=JSON.parse(body.input[0].content[0].text);
 await new Promise(resolve=>setTimeout(resolve,Number(process.env.QA_MODEL_DELAY||15)));
 if(input.document.includes('TEST_MODEL_ERROR'))return Response.json({error:{message:'never relay provider secrets'}},{status:429});
 const extracted=admissionsFixture();
 if(input.reviewerCorrections?.includes('最低分改为7'))extracted.programs[0].language[0].score=7;
 return Response.json({status:'completed',model:body.model,output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text:JSON.stringify(extracted)}]}],usage:{input_tokens:100,output_tokens:200}});
};
