import {academicScoreStatuses,scholarshipScoreStatuses} from '../public/academic-scores.js';

export function validateAcademicScores(program){
 const errors=[],a=program?.academicTests;
 if(!a)return errors;
 const source=s=>s&&typeof s.quote==='string'&&s.quote.trim()&&(s.sourceId||s.page||/^https:\/\/[^/\s]+/.test(s.url||''));
 for(const key of ['scoreDetails','scholarshipGrades']){
  if(a[key]===undefined)continue;
  if(!Array.isArray(a[key])){errors.push('课程成绩明细必须为列表');continue;}
  const ids=new Set();
  for(const r of a[key]){
   if(!r||typeof r!=='object'||!r.id||ids.has(r.id)){errors.push('课程成绩条目编号缺失或重复');continue;}ids.add(r.id);
   if(!source(r.source))errors.push('课程成绩需保留原文依据');
   if(key==='scoreDetails'){
    if(typeof r.qualification!=='string'||!r.qualification.trim()||!academicScoreStatuses.includes(r.admissionStatus)||!scholarshipScoreStatuses.includes(r.scholarshipStatus))errors.push('课程成绩类型或状态无效');
    if(r.admissionStatus==='minimum'&&(typeof r.admissionText!=='string'||!r.admissionText.trim())||r.scholarshipStatus==='minimum'&&(typeof r.scholarshipText!=='string'||!r.scholarshipText.trim()))errors.push('已公布的成绩门槛不能为空');
    for(const k of ['variant','admissionText','scholarshipText','scholarshipName','conditions'])if(typeof r[k]!=='string')errors.push('课程成绩说明不完整');
   }else if(typeof r.name!=='string'||!r.name.trim()||!['入学申请','入学后／续领'].includes(r.stage)||!['minimum','holistic','unspecified'].includes(r.status)||typeof r.text!=='string'||!r.text.trim()||typeof r.conditions!=='string')errors.push('奖学金成绩需名称、阶段和完整要求');
  }
 }
 return [...new Set(errors)];
}
