// A month in the source is not an invalid day and must not be replaced with
// an invented first/last day. Keep it in the rule and compare at that precision.
export const isLanguageMonth=value=>typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export const validLanguageDate=(value,validDate)=>validDate(value)||isLanguageMonth(value);
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
function explicitlyIncludesMonth(boundary,direction,quote){
 const [year,month]=boundary.split('-'),name=months[Number(month)-1],m=Number(month);
 const date=`(?:${name}|${name.slice(0,3)}\\.?)\\s+${year}`;
 const text=String(quote||'').normalize('NFKC');
 const inclusive=direction==='after'
  ?`(?:on\\s+or\\s+after|from|since)\\s+(?:the\\s+(?:beginning|start)\\s+of\\s+)?${date}|${date}\\s+or\\s+(?:later|after)|${year}年\\s*0?${m}月\\s*(?:起|及以后|或以后|以降)`
  :`on\\s+or\\s+before\\s+${date}|${date}\\s+or\\s+(?:earlier|before)|${year}年\\s*0?${m}月\\s*(?:及以前|或以前|以前)`;
 // Conflicting explicit exclusions cannot be resolved by the inclusive phrase.
 const exclusive=direction==='after'
  ?`(?:strictly\\s+after|excluding)\\s+${date}|${date}\\s*(?:is\\s+)?(?:excluded|not\\s+accepted)`
  :`(?:strictly\\s+before|excluding)\\s+${date}|${date}\\s*(?:is\\s+)?(?:excluded|not\\s+accepted)`;
 return new RegExp(inclusive,'i').test(text)&&!new RegExp(exclusive,'i').test(text);
}
export function languageDateBoundary(date,boundary,direction,source,validDate){
 if(boundary===null||boundary===undefined)return 'pass';
 if(!validDate(date)||!validLanguageDate(boundary,validDate))return 'unknown';
 const compare=value=>direction==='after'?value>=boundary:value<=boundary;
 if(!isLanguageMonth(boundary))return compare(date)?'pass':'fail';
 const month=date.slice(0,7);
 if(month!==boundary)return compare(month)?'pass':'fail';
 // Inside a boundary month, only an explicit inclusive source can establish a
 // pass. "After September" alone leaves September scores for human review.
 return explicitlyIncludesMonth(boundary,direction,source?.quote)?'pass':'unknown';
}
