import test from 'node:test';
import assert from 'node:assert/strict';
import { seedPrograms } from '../lib/seed.mjs';
import { buildProjectView } from '../public/requirement-model.js';
import { buildQualificationCatalog, buildQualificationRows, renderQualificationMatrix } from '../public/qualification-matrix.js';
import { buildSchoolView, renderSchoolDetail, groupSchools } from '../public/school-detail.js';
import { renderRoundsTable } from '../public/rounds-table.js';

const programs = seedPrograms();
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const ui = { esc, icon: () => '', tag: esc, button: esc, evidence: () => '' };

test('shared catalogue splits qualifications and certifications and retains unlisted OSSD/DSE evidence', () => {
  const rows = buildQualificationRows(programs);
  for (const id of ['standard12', 'mext-equivalent', 'ib', 'gce-alevel', 'international-alevel', 'accreditation']) {
    assert.ok(rows.find(row => row.id === id).cells.every(cell => cell.accepted), id);
  }
  for (const id of ['ossd', 'dse']) assert.ok(rows.find(row => row.id === id).cells.every(cell => !cell.accepted && cell.reason === '手册未列明'));
  for (const id of ['preparatory', 'japanEquivalency']) {
    const row = rows.find(row => row.id === id);
    assert.deepEqual(row.cells.filter(cell => cell.accepted).map(cell => cell.programId), ['GLA', 'GS', 'CRPS', 'ISSE']);
    assert.equal(row.cells.find(cell => cell.programId === 'JDP').reason, '手册明确不适用');
  }
  for (const p of programs) for (const path of p.paths) assert.ok(rows.some(row => row.cells.some(cell => cell.programId === p.id && cell.pathIds.includes(path.id))), `${p.id}/${path.id} must remain represented`);
  assert.ok(rows.find(row => row.id === 'international12').cells.every(c=>!c.accepted));
  for (const row of rows.filter(row => row.field === 'accreditation')) {
    assert.ok(row.conditions.every(condition => condition.text.includes('完成12年国际学校课程')));
  }
  const texts = rows.flatMap(row => row.conditions.map(c => c.text)).join('\n');
  assert.doesNotMatch(texts, /白俄罗斯|Chosen Kokyu Gakko/);
  assert.match(texts, /MEXT指定11年教育.*不能仅凭国籍/);
  assert.match(texts, /高中毕业或以上学力.*18岁.*3周.*International Admissions Office/);
  const background = rows.flatMap(row => row.conditions.flatMap(condition => condition.backgroundNotes.map(part => part.text))).join('\n');
  assert.match(background, /白俄罗斯.*乌兹别克斯坦/);
  assert.match(background, /Chosen Kokyu Gakko/);
  const html = renderQualificationMatrix(programs, programs, ui);
  assert.ok(html.includes('data-qualification="secondary-education"'));
  assert.ok(html.includes('日本以外12年正规学校教育'));
  assert.ok(!html.includes('<td class="qualification-conditions"><div>'));
  assert.match(html, /不妨碍通过其他路径申请/);
});

test('a separate international-school path stays visible when certification rows cannot represent it', () => {
  const other = structuredClone(programs[0]); other.id = 'OTHER';
  other.paths = [{ id: 'standalone', all: [{ field: 'international12', op: 'eq', value: true, label: '完成12年国际学校课程' }] }];
  const rows = buildQualificationRows([other], [...programs, other]);
  assert.deepEqual(rows.find(row => row.id === 'international12').cells[0].pathIds, ['standalone']);
  assert.ok(rows.filter(row => row.field === 'accreditation').every(row => !row.cells[0].accepted));
});

test('a qualification introduced by another school expands every school catalogue without granting unsupported acceptance', () => {
  const other = structuredClone(programs[0]); other.id = 'OTHER'; other.school = '另一所大学';
  other.paths = [{ id: 'new', label: '新的毕业证书', all: [{ field: 'qualification', op: 'in', value: ['OSSD', 'New Diploma <2028>'], label: '完整文凭' }], source: { sourceId: 'new-source', page: 2 } }];
  const all = [...programs, other];
  assert.equal(groupSchools(all).length, 2);
  assert.ok(buildQualificationCatalog(all).some(row => row.label === 'New Diploma <2028>'));
  const original = buildQualificationRows(programs, all);
  assert.ok(original.find(row => row.label === 'New Diploma <2028>').cells.every(cell => !cell.accepted));
  const added = buildQualificationRows([other], all);
  assert.equal(added.find(row => row.id === 'ossd').cells[0].accepted, true);
  assert.equal(added.find(row => row.id === 'ib').cells[0].accepted, false);
  assert.ok(renderQualificationMatrix([other], all, ui).includes('New Diploma &lt;2028&gt;'));
});

test('school score aggregation preserves all 28 live thresholds with exact program scope', () => {
  const view = buildSchoolView(programs);
  assert.equal(view.scores.reduce((n, row) => n + row.programs.length, 0), 28);
  const html = renderSchoolDetail(programs[0].school, programs, ui);
  assert.ok(html.includes('<th>适用项目</th><th>备注</th>'));
  for (const row of view.scores) {
    const rendered = html.match(new RegExp(`<tr data-school-score="${row.id}">([\\s\\S]*?)</tr>`))?.[1];
    assert.ok(rendered, row.id);
    const cells = [...rendered.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(match => match[1]);
    assert.equal(cells.length, 8);
    assert.equal(cells[0], `<strong>${esc(row.exam)}</strong>`);
    assert.ok(cells[1].includes(`（${esc(row.basis)}）`));
    for (const id of row.programs) assert.ok(cells[6].includes(id));
    if (row.version !== '未注明') assert.ok(cells[7].includes(esc(row.version)));
    if (row.note) assert.ok(cells[7].includes(esc(row.note)));
    assert.doesNotMatch(rendered, /<br|class="round-meta"|class="score-note"/);
  }
  for (const p of programs) for (const score of p.language) {
    assert.ok(view.scores.some(row => row.programs.includes(p.id) && ['exam', 'score', 'scale', 'version', 'basis', 'reading', 'listening', 'writing', 'speaking', 'note'].every(k => row[k] === score[k])), `${p.id}/${score.id}`);
  }
  const modified = structuredClone(programs);
  modified.find(p => p.id === 'GS').language.find(row => row.exam === 'IELTS Academic Module').score = 8;
  const changed = buildSchoolView(modified).scores.find(row => row.exam === 'IELTS Academic Module' && row.score === 8);
  assert.deepEqual(changed.programs, ['GS']);
});

test('school aggregation retains every material explanation, waiver, academic and later-stage requirement', () => {
  const view = buildSchoolView(programs);
  for (const p of programs) {
    const detail = buildProjectView(p);
    for (const material of detail.materials) assert.ok(view.materials.some(row => row.programs.includes(p.id) && row.label === material.label && JSON.stringify(row.parts) === JSON.stringify(material.parts)));
    for (const waiver of detail.waivers) assert.ok(view.waivers.some(row => row.programs.includes(p.id) && JSON.stringify(row.paragraphs) === JSON.stringify(waiver.paragraphs)));
    for (const key of ['academic', 'post']) for (const requirement of detail[key]) assert.ok(view[key].some(row => row.programs.includes(p.id) && row.detail === requirement.detail));
  }
  assert.deepEqual(view.waivers.find(row => row.paragraphs.some(text => text.includes('最近6年'))).programs, ['GS', 'CRPS', 'ISSE']);
  assert.ok(view.post.every(row => !row.programs.includes('CRPS') && !row.programs.includes('ISSE')));
  const html = renderSchoolDetail(programs[0].school, programs, ui);
  for (const waiver of view.waivers) {
    assert.ok(html.includes(`data-info="${esc(JSON.stringify({ label: waiver.title + ' · ' + waiver.programs.join(' / '), parts: waiver.paragraphs.map(text => ({ text })) }))}"`));
    for (const paragraph of waiver.paragraphs) assert.ok(!html.includes(`<p>${esc(paragraph)}</p>`));
  }
});

test('all eleven rounds retain independent first-screen, interview and final columns plus conditional-result notes', () => {
  const html = renderRoundsTable(programs, ui);
  for (const heading of ['初筛', '面试', '最终结果']) assert.ok(html.includes(`<th>${heading}</th>`));
  assert.equal((html.match(/data-round=/g) || []).length, 11);
  for (const p of programs) for (const r of p.rounds) {
    assert.ok(html.includes(r.enrollmentDate));
    assert.ok(html.includes(r.applyStart));
    assert.ok(html.includes(r.applyEnd));
    assert.ok(html.includes(r.final));
    if (r.first) assert.ok(html.includes(r.first));
    if (r.interview && r.interview !== '不适用') assert.ok(html.includes(r.interview));
    if (r.note) assert.ok(html.includes(esc(r.note)));
  }
});

test('school overview isolates admission year/channel and keeps school-to-project navigation', () => {
  const next = structuredClone(programs[0]); next.id = 'GLA-2028'; next.year = 2028; next.name = '下一年度项目'; next.language[0].score = 123;
  const all = [...programs, next];
  const html = renderSchoolDetail('立命馆大学', all, ui, { year: 2027 });
  assert.ok(html.includes('href="#programs"'));
  for (const p of programs) assert.ok(html.includes(`href="#program/${p.id}"`));
  assert.ok(!html.includes('下一年度项目'));
  assert.ok(!html.includes('≥ 123'));
  assert.ok(html.includes('role="switch" aria-checked="false"'));
  assert.ok(renderSchoolDetail('立命馆大学', all, ui, { year: 2028 }).includes('下一年度项目'));
});
