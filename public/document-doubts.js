// A missing word is not necessarily a missing admissions rule. Keep unknown
// cases and substantive requirements; suppress only recognizable UI/example
// transcription noise. Raw OCR warnings and model doubts remain stored.
const substantivePath=/^\/(?:school|name|englishName|year|channel|paths|hardConditions|language|languagePolicy|languageRequirement|waivers|rounds|materials|graduationPolicy|academicTests|interview|tuition|combination|coverage)(?:\/|$)/;
const substantiveText=[
 /学校名称|项目名称|年份|资格|学历|学制|教育|学分|学位|专业|学院|学部|科目|成绩|分数|最低|门槛|豁免|国籍|居住要求|年龄|年满|毕业|授课|认证|认可范围|签证|在留|推荐信|文书|自我介绍|面试|选拔|考试/,
 /学费|申请费|报名费|检定料|金额|费用|币种|退款|退费|截止|有效期|缴费期限|付款期限|申请时间|招生年度|开学|开课|轮次|申请开始|出愿开始|递交|提交|寄送|寄达|邮寄|上传要求|上传格式|文件格式|文件大小|视频格式|证明材料|申请材料|原件|公证|份数|字数|联系邮箱|指定邮箱|收件地址|域名|必须|不得|仅接受|不接受|收费|支付方式|付款方式|缴费方式/,
 /入学資格|学歴|成績|出願期間|出願書類|納付期限|受験料|授業料|郵送/,
 /\b(?:eligibility|qualifications?|requirements?|nationality|citizenship|age|minimum|scores?|subjects?|grades?|diploma|accreditation|TOEFL|IELTS|HKDSE|IB|SAT|ACT|A[- ]Level|deadlines?|tuition|fees?|amounts?|refunds?|scholarships?|waivers?|transcripts?|recommendations?|essays?|interviews?|required\s+documents?|application\s+(?:period|deadline|materials|requirements)|payment\s+(?:deadline|method)|acceptable\s+format|file\s+(?:format|size)|word\s+limit|self[- ]introduction\s+video|JPY|USD|CNY|must|shall)\b/i,
];
const transcriptionProblem=/无法|不能.{0,8}(?:辨认|识别|转录|确认)|不清|模糊|过小|极小|微小|细小|分辨率|遮挡|遮盖|遮蔽|截断|裁切|未能辨认|\b(?:unreadable|illegible|blurred|blurry|obscured|redacted|too\s+small)\b/i;
const interfaceContext=/截图|界面|网页|表单|输入框|输入栏|选择框|下拉框|控件|按钮|\b(?:screenshot|interface|form|input|dropdown|button)\b/i;
const interfaceFurniture=/页眉|页脚|导航|配色|字号(?:设置|按钮|选项)|颜色选项|设置栏|标志|图标|校徽|校章|标语|版权|装饰性|\b(?:logo|icon|copyright|navigation|footer|header)\b/i;
const accountField=/(?:email|e-mail|邮箱|电子邮件|password|密码|用户名).{0,24}(?:输入|确认|格式|提示)|(?:输入框|输入栏).{0,24}(?:email|邮箱|password|密码)|\b(?:email\s+address\s+confirmation|registration\s+rule|operation\s+of\s+this\s+site)\b|注册规则/i;
const paymentField=/卡号|安全码|卡种|卡标|信用卡标志|\b(?:card\s+(?:number|type)|security\s+code|cvv|cvc)\b/i;
const paymentInterface=/信用卡|付款|支付|クレジットカード|\b(?:credit\s+card|payment)\b/i;
const interfaceDetail=/输入|标签|提示|说明文字|小字|细字|按钮|选项|字段名称|页首|标题下|\b(?:hint|label|button|field|fine\s+print)\b/i;
const referenceNumber=/参考编号|参考号码|reference\s+number/i;
const maskedExample=/黑色|黑条|黑块|遮挡|遮盖|示例|示意|\b(?:redacted|masked|example|sample)\b/i;
const sampleIdentity=/(?:护照|passport).{0,20}(?:示例|示意)|(?:示例|示意).{0,20}(?:护照|passport)|(?:信封|envelope).{0,12}(?:示例|示意)/i;
// A warning covering a whole table/page can mention navigation as well as
// unknown substantive text. One harmless item cannot exempt that entire scope.
const mixedUnknownContent=/绝大部分|整页|全页|表格(?:文字|内容)|(?:及|和|与|、)正文|正文(?:和|及|、)|\b(?:whole\s+page|entire\s+table|body\s+text)\b/i;

export function isAdmissionDoubt(doubt){
 if(['blocking','change'].includes(doubt.kind)||substantivePath.test(doubt.path||''))return true;
 const reason=String(doubt.reason||''),text=reason+' '+String(doubt.source?.quote??doubt.quote??'');
 if(!transcriptionProblem.test(text)||substantiveText.some(pattern=>pattern.test(text)))return true;
 if(mixedUnknownContent.test(text))return true;
 if(interfaceFurniture.test(text))return false;
 if(accountField.test(text))return false;
 if(paymentField.test(text)&&interfaceDetail.test(text))return false;
 if(interfaceContext.test(text)&&referenceNumber.test(text)&&maskedExample.test(text))return false;
 if(interfaceContext.test(text)&&paymentInterface.test(text)&&interfaceDetail.test(text))return false;
 if(sampleIdentity.test(text)&&/机读|机器可读|填充符|签名|姓名|\b(?:machine.readable|signature|name)\b/i.test(text))return false;
 return true;
}

// Also used at render time for an already-open/cached legacy draft. This is a
// projection, never a mutation of the source, confirmed rules or review history.
export function filterReviewDoubts(review){
 if(!review)return review;
 return {...review,doubts:(review.doubts||[]).filter(isAdmissionDoubt),
  entries:(review.entries||[]).map(entry=>({...entry,issues:(entry.issues||[]).filter(isAdmissionDoubt)}))};
}
