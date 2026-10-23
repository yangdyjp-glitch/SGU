const text = { type: 'string' };
const nullableText = { type: ['string', 'null'] };
const number = { type: ['number', 'null'] };
const boolean = { type: ['boolean', 'null'] };
const choice = values => ({ type: 'string', enum: values });
const object = properties => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });
const list = items => ({ type: 'array', items });
const ref = name => ({ $ref: '#/$defs/' + name });
const source = ref('source');
const value = { anyOf: [text, {type:'number'}, {type:'boolean'}, list(text), {type:'null'}] };
export const documentSchema = {
 ...object({ kind: choice(['admissions','supplement','other']), summary: text, programs: list(ref('program')), doubts: list(ref('doubt')) }),
 $defs: {
  source: object({ page: nullableText, quote: text }),
  doubt: object({ path: text, reason: text, source }),
  rule: object({ field: text, op: choice(['eq','neq','in','gte','lte','contains']), value, label: text, referenceDate: nullableText, state: choice(['stated','unspecified']), source }),
  path: object({ id: text, label: text, all: list(ref('rule')), source }),
  round: object({ id: text, intake: nullableText, period: {type:'integer'}, applyStart: nullableText, applyEnd: nullableText, enrollmentDate: nullableText, startTime: nullableText, endTime: nullableText, timezone: nullableText, first: nullableText, interview: nullableText, final: nullableText, note: text, source }),
  language: object({ id: text, exam: text, scale: text, score: number, basis: text, reading: number, listening: number, writing: number, speaking: number, minimumStatus: choice(['stated','no-minimum','unspecified']), version: text, note: text, source }),
  material: object({ id: text, label: text, required: boolean, stage: text, note: text, when: {anyOf:[ref('rule'),{type:'null'}]}, source }),
  requirement: object({ id: text, topic: text, stage: text, nature: choice(['硬性','附条件','材料','建议','说明','待核实']), detail: text, source }),
  program: object({
   school: text, year: {type:['integer','null']}, name: text, englishName: text, channel: text, direction: text, degree: text, partner: nullableText,
   paths: list(ref('path')), hardConditions: list(ref('rule')), language: list(ref('language')), waivers: list(ref('path')), rounds: list(ref('round')), materials: list(ref('material')), requirements: list(ref('requirement')),
   languageRequirement: choice(['required','not-required','unspecified']),
   languagePolicy: object({validYears:number, validAfter:nullableText, validUntil:nullableText, availabilityRequired:boolean, allowSuperscore:boolean, excludedFormats:list(text), detail:text, source}),
   graduationPolicy: object({required:boolean, deadline:nullableText, allowExpected:boolean, detail:text, source}),
   tuition: object({status:choice(['published','unspecified']),amount:number,currency:text,period:text,detail:text,source}),
   academicTests: object({status:choice(['required','optional','not-required','unspecified']),detail:text,source}),
   interview: object({status:choice(['required','conditional','not-required','unspecified']),detail:text,source}),
   combination: object({parallel:choice(['allowed','forbidden','unspecified']),reapply:choice(['allowed','forbidden','unspecified']),materials:text,referenceReuse:text,source}),
   coverage: text, doubts: list(ref('doubt'))
  })
 }
};

export function validateSchema(value, schema = documentSchema, root = documentSchema, path = '') {
 if (schema.$ref) return validateSchema(value,root.$defs[schema.$ref.split('/').pop()],root,path);
 if (schema.anyOf) return schema.anyOf.some(item=>!validateSchema(value,item,root,path).length) ? [] : [path+'类型不符合要求'];
 const types=Array.isArray(schema.type)?schema.type:[schema.type];
 const actual=value===null?'null':Array.isArray(value)?'array':typeof value;
 if (!types.some(type=>type===actual||type==='integer'&&Number.isInteger(value))) return [path+'类型不符合要求'];
 if (schema.enum&&!schema.enum.includes(value)) return [path+'取值不符合要求'];
 if (actual==='array') return value.flatMap((item,i)=>validateSchema(item,schema.items,root,path+'/'+i));
 if (actual==='object') return [...schema.required.filter(key=>!Object.hasOwn(value,key)).map(key=>path+'/'+key+'缺失'),...Object.keys(value).filter(key=>!Object.hasOwn(schema.properties,key)).map(key=>path+'/'+key+'未定义'),...Object.keys(schema.properties).filter(key=>Object.hasOwn(value,key)).flatMap(key=>validateSchema(value[key],schema.properties[key],root,path+'/'+key))];
 return [];
}

// Stored rules add server-owned IDs, evidence links and review metadata.
// Validate their model fields without weakening the strict API response schema.
export function schemaFields(value, schema=documentSchema.$defs.program) {
 if(schema.$ref)return schemaFields(value,documentSchema.$defs[schema.$ref.split('/').pop()]);
 if(value===null||value===undefined)return value;
 if(schema.anyOf){const target=schema.anyOf.find(s=>s.$ref||s.type===typeof value||s.type==='array'&&Array.isArray(value));return target?schemaFields(value,target):value;}
 if(schema.type==='object'&&typeof value==='object'&&!Array.isArray(value))return Object.fromEntries(Object.entries(schema.properties).filter(([key])=>Object.hasOwn(value,key)).map(([key,s])=>[key,schemaFields(value[key],s)]));
 if(schema.type==='array'&&Array.isArray(value))return value.map(item=>schemaFields(item,schema.items));
 return value;
}
