import { qualificationTypes, qualificationNameKey } from './education-model.js';

// Shared display vocabulary only. A listed type is not evidence that a program
// accepts it. Reuse the existing diploma aliases and retain each source row.
const diploma = id => qualificationTypes.find(type=>type.id===id);
const exam = (id,label,aliases=[]) => ({id,label,values:[label,...aliases]});
export const academicScoreTypes = [
  diploma('ib'), diploma('gce-alevel'), diploma('international-alevel'),
  exam('singapore-alevel','Singapore A-Level',['Singapore GCE A-Level','Singapore-Cambridge GCE A-Level','新加坡 A-Level']),
  diploma('abitur'), diploma('baccalaureate'), diploma('european-baccalaureate'),
  diploma('ossd'), diploma('dse'),
  exam('ap','AP',['Advanced Placement','Advanced Placement (AP)']),
  exam('sat','SAT'), exam('act','ACT'),
  exam('eju','EJU',['Examination for Japanese University Admission for International Students','日本留学考试']),
  exam('stpm','STPM',['Sijil Tinggi Persekolahan Malaysia']),
  exam('uec','UEC',['Unified Examination Certificate']),
  exam('atar','ATAR',['Australian Tertiary Admission Rank']),
  exam('ncea','NCEA',['National Certificate of Educational Achievement']),
  exam('canadian-diploma','加拿大高中文凭'),
  exam('us-diploma','美国高中文凭'),
  exam('regional-diplomas','越南／蒙古／印尼／台湾／泰国高中文凭')
];
const typesByName=new Map(academicScoreTypes.flatMap(type=>[type.id,...type.values].map(value=>[qualificationNameKey(value),type])));

export function academicScoreType(name) {
  const key=qualificationNameKey(name);
  return typesByName.get(key) || {id:'other:'+key,label:String(name||'').trim(),values:[name]};
}

export function buildAcademicScoreCatalog(programs=[]) {
  const extra=new Map();
  // Inspect the whole library, not just the selected school, year or entry type.
  // An unfamiliar source name is shared globally without guessing equivalence.
  for(const p of programs)for(const row of p.academicTests?.scoreDetails||[]) {
    const type=academicScoreType(row.qualification);
    if(type.label&&type.id.startsWith('other:')) {
      const existing=extra.get(type.id);
      if(!existing||type.label<existing.label)extra.set(type.id,type);
    }
  }
  return [...academicScoreTypes,...[...extra.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)];
}
