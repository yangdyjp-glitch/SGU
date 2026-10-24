import test from 'node:test';
import assert from 'node:assert/strict';
import {isAdmissionDoubt,filterReviewDoubts} from '../public/document-doubts.js';
import {buildDocumentReview,refreshReviewValidation} from '../lib/document-organizer.mjs';
import {reviewValidationVersion} from '../lib/document-review-version.mjs';
import {renderAutoReview} from '../public/document-auto-review.js';
import {admissionsFixture,admissionsText} from './fixtures/admissions.mjs';

const irrelevant=[
 ['页面上方中间截图内的注册规则正文过小、模糊，无法逐字可靠辨认；保留其所在位置，未推测条款内容。','[无法辨认：Registration Rule正文]'],
 ['页面上方右图中，Email输入框右侧的格式提示字形过小，无法可靠辨认。','[无法辨认：Email输入框右侧文字]'],
 ['页面上方右图中，邮箱确认输入框右侧的格式提示字形过小，无法可靠辨认。','[无法辨认：Email Address Confirmation输入框右侧文字]'],
 ['左侧付款操作截图中的参考编号被黑色矩形遮挡，无法辨认。','[无法辨认：左图Reference Number黑色遮挡处]'],
 ['右侧付款操作截图中的参考编号被黑色矩形遮挡，无法辨认。','[无法辨认：右图Reference Number黑色遮挡处]'],
 ['页面底部左侧信用卡付款截图分辨率不足，标题下的细小说明文字无法可靠辨认。','[无法辨认：信用卡付款页标题下说明文字]'],
 ['卡种下拉框及信用卡标志中的细小文字无法可靠辨认。','[无法辨认：卡种选择框及标志文字]'],
 ['卡号输入框附近的细小说明文字模糊，无法可靠辨认。','[无法辨认：卡号栏说明文字]'],
 ['护照示例图的机读区第二行字号过小，后续字母、数字和填充符号无法逐一可靠辨认。','P<EXAMPLE<<[无法辨认]'],
 ['页面下方界面截图左上角票券图标内有极小文字，分辨率不足，无法可靠辨认。','[无法辨认]'],
 ['底部三张截图右上角的字号按钮文字过小，无法可靠辨认。','[无法辨认]'],
 ['底部三张截图右上角的配色按钮文字过小，无法完整辨认。','[无法辨认]'],
 ['The email input format hint in the screenshot is too small to read.','Email Address Confirmation [unreadable]'],
 ['The sample reference number is redacted in the payment screenshot.','Reference number: [redacted]'],
].map(([reason,quote])=>({page:'16',reason,quote}));
const doubt=warning=>({path:'',reason:warning.reason,source:{page:warning.page,quote:warning.quote}});
const doc=()=>({id:'doubt-filter-test',filename:'admissions.pdf',status:'review',text:admissionsText,extractionWarnings:structuredClone(irrelevant)});
const important=[
 ['最低分不清','HKDSE best four: [无法辨认]'],
 ['页面中付款操作截图的申请费金额和币种无法辨认','[无法辨认]'],
 ['信用卡付款截图标题下的缴费截止时间模糊','[无法辨认]'],
 ['按钮旁的文字过小，无法确认是否必须邮寄原件','[无法辨认]'],
 ['注册规则截图中关于学历资格的例外条款无法辨认','[无法辨认]'],
 ['注册规则截图中年龄条件无法辨认','[无法辨认]'],
 ['注册规则截图国籍限制无法辨认','[无法辨认]'],
 ['付款截图标题下方细小说明文字无法辨认','JPY [无法辨认]'],
 ['Email输入框旁的域名限制无法可靠辨认','Make sure you can receive emails from domain [无法辨认]'],
 ['页脚文字过小，无法辨认','IELTS minimum score: [无法辨认]'],
 ['页眉的入学年份文字模糊','[无法辨认]'],
 ['页眉学校名称无法辨认','[无法辨认]'],
 ['The registration rule screenshot is blurry.','File size limit: [unreadable]'],
 ['输入提示截图中推荐信文件格式不清晰','[无法辨认]'],
 ['截图中说明段落无法辨认','Applicants must submit two recommendation letters.'],
 ['The payment screenshot fine print is unreadable.','Application fee: [unreadable]'],
 ['The credit card dropdown hint is blurry.','Only this payment method is accepted.'],
 ['出願書類の提出期限が不明','[无法辨认]'],
 ['图中间一段文字无法辨认，不能确定其内容','[无法辨认]'],
 ['本页截图的导航栏、表单标签、输入框内容、正文和部分按钮文字因尺寸过小、清晰度不足而无法可靠辨认','[无法辨认]'],
 ['页面中网页截图内绝大部分字段、导航、说明及表格文字字号过小，无法可靠辨认','[无法辨认]'],
 ['这两段的条件存在冲突','Conditions differ between sections.'],
].map(([reason,quote])=>({page:'16',reason,quote}));

test('irrelevant interface transcription warnings are ignored, substantive and uncertain content stays',()=>{
 for(const warning of irrelevant){assert.equal(isAdmissionDoubt(warning),false,warning.reason);assert.equal(isAdmissionDoubt(doubt(warning)),false,warning.reason);}
 for(const warning of important){assert.equal(isAdmissionDoubt(warning),true,warning.reason);assert.equal(isAdmissionDoubt(doubt(warning)),true,warning.reason);}
 for(const kind of ['blocking','change'])assert.equal(isAdmissionDoubt({...doubt(irrelevant[0]),kind}),true);
 for(const path of ['/year','/language/0/score','/rounds/0/applyEnd','/materials/0'])assert.equal(isAdmissionDoubt({...doubt(irrelevant[0]),path}),true);
});

test('new reviews filter OCR and model alerts without deleting source text, raw doubts or admissions rules',()=>{
 const d=doc(),input=admissionsFixture();
 d.extractionWarnings.push(...important);
 input.doubts=[...irrelevant.map(doubt),...important.map(doubt)];
 input.programs[0].doubts.push(...irrelevant.map(doubt));
 const beforeDoc=JSON.stringify(d),beforeInput=JSON.stringify(input);
 const review=buildDocumentReview(input,d,[]);
 for(const warning of irrelevant){assert.ok(!review.doubts.some(d=>d.reason.endsWith(warning.reason)));assert.ok(!review.entries[0].issues.some(d=>d.reason===warning.reason));}
 for(const warning of important)assert.ok(review.doubts.some(d=>d.reason===`第16页识别疑点：${warning.reason}`));
 assert.deepEqual(review.modelDoubts,input.doubts);assert.deepEqual(review.entries[0].modelDoubts,input.programs[0].doubts);
 const clean=admissionsFixture();assert.deepEqual(review.entries.map(e=>e.program),buildDocumentReview(clean,d,[]).entries.map(e=>e.program));
 assert.equal(JSON.stringify(d),beforeDoc);assert.equal(JSON.stringify(input),beforeInput);
});

test('existing pending drafts refresh without OCR/model reruns or modifications to published history',()=>{
 const d=doc();d.autoReview=buildDocumentReview(admissionsFixture(),d,[]);
 d.autoReview.validationVersion=4;delete d.autoReview.modelDoubts;
 d.autoReview.doubts=irrelevant.map(w=>({...doubt(w),reason:`第${w.page}页识别疑点：${w.reason}`}));
 d.autoReview.entries[0].modelDoubts.push(doubt(irrelevant[0]));
 d.autoReview.entries[0].issues.push({...doubt(irrelevant[0]),kind:'uncertain'});
 const original=structuredClone(d),review=refreshReviewValidation(d,[]);
 assert.equal(review.validationVersion,reviewValidationVersion);assert.equal(review.version,original.autoReview.version+1);
 assert.equal(review.doubts.length,0);assert.ok(review.entries[0].issues.every(i=>!i.reason.includes('Registration Rule')&&!i.reason.includes('注册规则')));
 assert.deepEqual(review.entries.map(e=>e.program),original.autoReview.entries.map(e=>e.program));assert.deepEqual(d,original);
 assert.equal(refreshReviewValidation({...d,autoReview:review},[]),null);
 assert.equal(refreshReviewValidation({...d,status:'published'},[]),null);
});

test('cached legacy review rendering filters alert counts and panels but keeps meaningful highlights',()=>{
 const d=doc(),input=admissionsFixture();input.programs.forEach(p=>p.doubts=[]);
 d.autoReview=buildDocumentReview(input,{...d,extractionWarnings:[]},[]);
 d.autoReview.doubts=irrelevant.map(doubt);
 d.autoReview.entries[0].issues.push({...doubt(irrelevant[0]),kind:'uncertain'});
 const original=structuredClone(d);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ui={esc,button:label=>label};
 const html=renderAutoReview(d,ui);
 assert.match(html,/未发现明显疑点/);assert.doesNotMatch(html,/文件整体疑点|Registration Rule|第16页识别疑点/);
 assert.deepEqual(d,original);
 d.autoReview.doubts.push(doubt(important[0]));
 const withScore=renderAutoReview(d,ui);
 assert.match(withScore,/1 处需留意/);assert.match(withScore,/文件整体疑点/);assert.match(withScore,/<mark>HKDSE best four: \[无法辨认\]<\/mark>/);
 const projection=filterReviewDoubts(d.autoReview);assert.equal(projection.entries[0].program,d.autoReview.entries[0].program);
 assert.doesNotThrow(()=>renderAutoReview({...d,status:'extracting',autoReview:{version:1}},ui));
});
