// Some imports put a list of intake-specific enrollment dates in the single
// referenceDate field. Reuse the existing round date only when the complete
// list agrees exactly with every round; never choose one date or infer a day.
export function normalizeEnrollmentAgeReference(rule,rounds,validDate){
 if(rule.field!=='ageAtEnrollment'||!rule.label?.trim()||typeof rule.referenceDate!=='string'||validDate(rule.referenceDate)||!rounds.length)return false;
 const original=rule.referenceDate,dates=new Map();
 for(const part of original.normalize('NFKC').split(/\s*[;；]\s*/)){
  const match=part.trim().match(/^(\d{4}-\d{2}-\d{2})\s*\(\s*(?:(\d{4})年\s*)?(0?[1-9]|1[0-2])月入学\s*\)$/);
  if(!match||!validDate(match[1]))return false;
  const intake=(match[2]||match[1].slice(0,4))+'-'+match[3].padStart(2,'0');
  if(dates.has(intake))return false;
  dates.set(intake,match[1]);
 }
 const intakes=new Set(rounds.map(round=>round.intake));
 if(intakes.size!==dates.size||rounds.some(round=>!validDate(round.enrollmentDate)||!dates.has(round.intake)||dates.get(round.intake)!==round.enrollmentDate))return false;
 rule.label=(rule.label||'年龄条件')+'（基准日：'+original+'；按对应轮次入学日计算）';
 rule.referenceDate=null;
 return true;
}
