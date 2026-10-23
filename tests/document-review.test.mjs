import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestions, analyzeDocument, documentForReview } from '../lib/document-analysis.mjs';
import { prepareDocumentDraft } from '../lib/document-draft.mjs';
import { blankDocumentProgram, matchingDocumentPrograms, renderDocumentReview } from '../public/document-review.js';
import { seedPrograms } from '../lib/seed.mjs';
import { renderProjectDetail } from '../public/project-detail.js';

const cover = '<!-- page 1 of 24 -->\n# Application Guide for AO April Entry (Overseas) 2027\n# School of International Liberal Studies\n# WASEDA UNIVERSITY\n';
const doc = { id: 'waseda-doc', filename: '2027_April-Overseas_Guide早大.pdf', name: '早稻田资料', status: 'review', text: cover + '<!-- page 4 of 24 -->\nApplicants must be 18 years of age.\nTOEFL iBT is accepted.\n' };
const programs = seedPrograms();

test('page, image, language and passage are not age requirements; formatting never becomes a suggestion', () => {
  const lines = ['<!-- page 2 of 24 -->', '![Image block](doc:abc/tier:standard/page:1/block:5)', 'The first language is Japanese.', 'The following passage explains the program.', '# LANGUAGE OF INSTRUCTION', '| --- | --- |', '<!-- age: 18 -->'];
  assert.deepEqual(suggestions(lines.join('\n'), { pdf: true }), []);
  assert.deepEqual(suggestions('Applicants must be 18 years of age.')[0].fields, ['年龄']);
  assert.deepEqual(suggestions('Applicants aged 18 or above are eligible.')[0].fields, ['年龄']);
  assert.deepEqual(suggestions('申请者必须在入学时达到18岁，并提交证明。')[0].fields, ['年龄','其他证明材料']);
  assert.equal(suggestions('<small><span class="page_footnote">There is no minimum age requirement.</span></small>')[0].text, 'There is no minimum age requirement.');
  assert.equal(suggestions('TOEFL ≥80')[0].fields[0], '语言成绩');
  assert.deepEqual(suggestions('<!-- page 2 of 24 -->\n## TABLE OF CONTENTS\n- BEFORE THE APPLICATION PERIOD\n- Tuition .... page 17\n<!-- page 3 of 24 -->\nTOEFL ≥80',{pdf:true}).map(row=>row.page),[3]);
});

test('real PDF page markers survive cleaning; raw links do not create keyword matches', () => {
  const text = '<!-- page 7 of 24 -->\n![image](doc:abc/page:7)\n[English score](https://example.test/age/visa/ACT)\nTOEFL iBT score of 80 is required.\n<!-- page 8 of 24 -->\nSubmit a passport and diploma.\n';
  const rows = suggestions(text, { pdf: true });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => r.page), [7, 8]);
  assert.deepEqual(rows.map(r => r.line), [4, 6]);
  assert.deepEqual(rows[0].fields, ['语言成绩']);
  assert.ok(suggestions(text).every(r => !r.page), 'text uploads must not claim PDF pages');
});

test('cover identifies Waseda and the intake without treating its document as a Ritsumeikan project', () => {
  assert.deepEqual(analyzeDocument(doc, programs), { school: '早稻田大学', year: 2027, englishName: 'School of International Liberal Studies', channel: 'AO April Entry (Overseas)' });
  assert.deepEqual(matchingDocumentPrograms(programs, '早稻田大学', 2027), []);
  assert.equal(matchingDocumentPrograms(programs, 'Ritsumeikan University', 2027).length, 5);
  assert.deepEqual(matchingDocumentPrograms(programs, '立命馆大学', 2028), []);
  assert.deepEqual(matchingDocumentPrograms(programs, '', 2027), []);
  assert.equal(analyzeDocument({filename:'unknown.pdf',text:'No school identified'}, programs).school, '');
});

test('existing parsed documents get corrected suggestions without parsing or modifying their stored text', () => {
  const original = { ...doc, suggestions: [{ fields:['年龄'],text:'<!-- page 2 of 24 -->' }] };
  const reviewed = documentForReview(original, programs);
  assert.equal(reviewed.text, original.text);
  assert.equal(original.suggestions[0].text, '<!-- page 2 of 24 -->');
  assert.ok(reviewed.suggestions.every(s => !s.text.includes('<!--')));
  assert.ok(reviewed.suggestions.every(s => s.page === 4));
});

test('new document drafts start with no inherited eligibility, scores, waivers, dates or source pages', () => {
  const p = blankDocumentProgram(analyzeDocument(doc, programs), doc.id);
  assert.equal(p.school, '早稻田大学');
  for (const key of ['paths','rounds','language','waivers','materials','hardConditions','requirements']) assert.deepEqual(p[key], []);
  assert.equal(p.languagePolicy.validYears, null); assert.equal(p.languagePolicy.allowSuperscore, null);
  assert.equal(p.languagePolicy.source.page, ''); assert.equal(p.reviewed, false);
  assert.deepEqual(p.sourceIds, [doc.id]);
  assert.ok(!JSON.stringify(p).includes('aohb27'));
});

test('draft target rejects wrong school/year and stale saves while keeping official programs untouched', () => {
  const before = JSON.stringify(programs);
  assert.throws(() => prepareDocumentDraft(doc, { target:{school:'早稻田大学',year:2027,mode:'update',programId:'CRPS'} }, programs, 'test'), /只能选择/);
  assert.throws(() => prepareDocumentDraft(doc, { target:{school:'立命馆大学',year:2028,mode:'update',programId:'CRPS'} }, programs, 'test'), /只能选择/);
  const draft = prepareDocumentDraft(doc, { target:{school:'早稻田大学',year:2027,mode:'create'} }, programs, 'test');
  assert.equal(draft.version, 1);
  assert.throws(() => prepareDocumentDraft({...doc,projectDraft:draft}, {program:draft.program,expectedDraftVersion:0}, programs, 'test'), /草稿已更新/);
  assert.throws(() => prepareDocumentDraft({...doc,projectDraft:draft}, {program:{...draft.program,school:'立命馆大学'},expectedDraftVersion:1}, programs, 'test'), /不一致/);
  assert.equal(prepareDocumentDraft({...doc,projectDraft:draft}, {program:draft.program,expectedDraftVersion:1}, programs, 'test').version, 2);
  assert.equal(JSON.stringify(programs), before);
});

test('new document review no longer asks users to select a project; legacy drafts keep their scoped original links', () => {
  const esc = v => String(v??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ui = { esc, badge:esc, tag:esc, button:esc, field:(label,name,value)=>esc(value), select:(label,name,value,options)=>`<select name="${name}">${options.map(([id,text])=>`<option value="${esc(id)}">${esc(text)}</option>`).join('')}</select>`, empty:esc };
  const html = renderDocumentReview(documentForReview(doc, programs), programs, ui);
  assert.match(html, /核对高亮疑点/); assert.match(html, /整体确认入库/);assert.doesNotMatch(html,/确认资料归属|document-target-form/);
  assert.doesNotMatch(html, /CRPS|GLA|ISSE|JDP/);
  assert.match(html, /\/uploads\/waseda-doc/);
  const draft=prepareDocumentDraft(doc,{target:{school:'早稻田大学',year:2027,mode:'create'}},programs,'test');
  assert.match(renderDocumentReview({...documentForReview(doc,programs),projectDraft:draft},programs,ui),/\/uploads\/waseda-doc#page=4/);
  const p = structuredClone(programs[0]);p.sourceIds=[doc.id];p.school='早稻田大学';
  const detail = renderProjectDetail(p,{esc,icon:()=>'',tag:esc,button:esc,evidence:()=>''});
  assert.match(detail, /href="\/uploads\/waseda-doc"/);
  assert.doesNotMatch(detail, /href="\/sources\/aohb27.pdf"/);
});
