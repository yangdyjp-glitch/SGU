import test from 'node:test';
import assert from 'node:assert/strict';
import { seedPrograms } from '../lib/seed.mjs';
import { buildProjectView, renderProjectDetail } from '../public/project-detail.js';

const programs = seedPrograms();
const program = id => structuredClone(programs.find(p => p.id === id));
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const ui = { esc, icon: () => '', tag: esc, button: esc, evidence: () => '', requirementsRows: () => '' };
const render = p => renderProjectDetail(p, ui);
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

test('all academic alternatives retain accreditation, qualification lists, scope, age and exceptional review conditions', () => {
  for (const p of programs) {
    const view = buildProjectView(p);
    assert.deepEqual(view.paths.map(x => x.id), p.paths.map(x => x.id));
    assert.match(view.paths.find(x => x.id === 'B').description, /\(WASC, NEASC, Cognia, COBIS, CIS or ACSI\)/);
    for (const name of p.paths.find(x => x.id === 'D').all.find(x => x.field === 'qualification').value) assert.ok(view.paths.find(x => x.id === 'D').description.includes(name));
    assert.match(view.paths.find(x => x.id === 'C').description, /等同海外高中/);
    assert.match(view.paths.find(x => x.id === 'E').description, /白俄罗斯.*乌兹别克斯坦.*不能仅凭国籍/);
    assert.match(view.paths.find(x => x.id === 'I').description, /高中毕业或以上学力.*18岁.*Chosen Kokyu Gakko.*3周.*International Admissions Office/);
    for (const path of view.paths) assert.equal(path.description.includes('18岁'), ['G', 'H', 'I'].includes(path.id));
    if (p.id === 'JDP') {
      assert.ok(!view.paths.some(x => ['F', 'H'].includes(x.id)));
      assert.match(view.academic.find(x => x.id === 'R013').detail, /短学制加MEXT指定预备教育.*日本高卒认定考试.*専修学校の高等課程.*不泛指全部职业教育/);
    } else {
      assert.match(view.paths.find(x => x.id === 'F').description, /少于12年.*日本大学预备/);
      assert.match(view.paths.find(x => x.id === 'H').description, /高等学校卒業程度認定試験/);
    }
  }
});

test('all 28 language rows render their live threshold, version, basis, individual scores and notes', () => {
  let count = 0;
  for (const p of programs) {
    const html = render(p);
    assert.ok(html.includes('<th>备注</th>'));
    for (const row of p.language) {
      const rendered = html.match(new RegExp(`<tr data-score="${row.id}">([\\s\\S]*?)</tr>`))?.[1];
      assert.ok(rendered, row.id);
      assert.ok(rendered.includes(esc(row.exam)));
      assert.ok(rendered.includes(`≥ ${row.score}`));
      assert.ok(rendered.includes(`<strong>≥ ${row.score}</strong><span class="score-basis">（${esc(row.basis)}）</span>`));
      const cells = [...rendered.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(match => match[1]);
      assert.equal(cells.length, 7);
      assert.equal(cells[0], `<strong>${esc(row.exam)}</strong>`);
      assert.doesNotMatch(rendered, /<br|class="round-meta"|class="score-note"/);
      if (row.version !== '未注明') assert.ok(cells.at(-1).includes(esc(row.version)));
      if (row.note) assert.ok(cells.at(-1).includes(esc(row.note)));
      for (const field of ['reading', 'listening', 'writing', 'speaking']) {
        const expected = typeof row[field] === 'number' ? `≥ ${row[field]}` : row[field] === '不适用' ? '—' : row[field];
        assert.ok(rendered.includes(`<td>${esc(expected)}</td>`), `${row.id}/${field}`);
      }
      count++;
    }
  }
  assert.equal(count, 28);
});

test('score exclusions, optional academic evidence and post-entry scores remain in their correct sections', () => {
  for (const p of programs) {
    const view = buildProjectView(p), formats = view.languageFormats.map(x => x.detail).join(' ');
    for (const term of ['Home Edition', 'Essentials', 'MyBest', 'IELTS Online', 'One Skill Retake', 'TOEIC IP']) assert.ok(formats.includes(term), `${p.id}/${term}`);
    assert.match(view.academic.find(x => x.id === 'R085').detail, /可选提交.*不接受SAT Subject Tests/);
    assert.match(view.academic.find(x => x.id === 'R015').detail, /GPA.*SAT总分.*ACT综合分.*IB总分.*A-Level.*仍会审查/);
  }
  assert.match(buildProjectView(program('GLA')).languageFormats.at(-1).detail, /C1 Advanced.*不接受B2 First和C2 Proficiency/);
  assert.match(buildProjectView(program('JDP')).languageFormats.at(-1).detail, /不接受Superscore.*一次/);
  assert.match(buildProjectView(program('GS')).post.map(x => x.detail).join(' '), /520/);
  assert.match(buildProjectView(program('ISSE')).academic.find(x => x.id === 'R111').detail, /物理.*化学.*生物.*计算机科学.*不影响.*高中数学\/科学/);
});

test('six-year waiver criteria and school proof are centralized once and not repeated in other sections', () => {
  for (const id of ['GS', 'CRPS', 'ISSE']) {
    const p = program(id), view = buildProjectView(p), html = render(p);
    assert.equal(view.waivers.length, 1);
    assert.ok(view.waivers[0].paragraphs.includes(p.requirements.find(r => r.id === 'R027').detail));
    assert.match(view.waivers[0].paragraphs.join(' '), /入学.*6年.*每所学校.*除非最后一所.*School Profile/);
    assert.ok(!view.academic.some(r => ['R027', 'R067'].includes(r.id)));
    assert.ok(!view.materials.some(m => m.parts.some(part => /最近6年|6年英语教育证明范围/.test(part.text))));
    assert.equal(text(html).split(p.requirements.find(r => r.id === 'R027').detail).length - 1, 0);
    assert.ok(html.includes(`data-info="${esc(JSON.stringify({ label: view.waivers[0].title, parts: view.waivers[0].paragraphs.map(text => ({ text })) }))}"`));
  }
});

test('GLA conditional IB completion and JDP curriculum or country alternatives remain complete', () => {
  const gla = buildProjectView(program('GLA'));
  assert.match(gla.waivers[0].paragraphs.join(' '), /教学和考核.*非英语语言.*入学前取得.*撤销录取/);
  assert.match(gla.materials.find(m => m.id === 'ib-qualification').parts.map(x => x.text).join(' '), /IB Predicted Grades.*English Language Test Score Waiver Request Form.*入学前.*IBO直送/);
  const jdp = program('JDP'), waiver = buildProjectView(jdp).waivers[0].paragraphs.join(' ');
  assert.match(waiver, /Grade 9–12.*唯一教学语言.*未修读ESL.*美国区域认证.*IB.*CXC.*英国.*学校所在地不限/);
  const countries = jdp.requirements.find(r => r.id === 'R026').detail.replace('保留文件分组。', '');
  assert.ok(waiver.includes(countries));
  for (const id of ['GLA', 'JDP']) {
    const p = program(id), view = buildProjectView(p), html = render(p);
    for (const waiver of view.waivers) {
      assert.ok(html.includes(`data-info="${esc(JSON.stringify({ label: waiver.title, parts: waiver.paragraphs.map(text => ({ text })) }))}"`));
      for (const paragraph of waiver.paragraphs) assert.ok(!text(html).includes(paragraph));
    }
  }
});

test('material explanations retain China certificates, translation exceptions, essays and delivery instructions', () => {
  const gla = buildProjectView(program('GLA')), jdp = buildProjectView(program('JDP')), crps = buildProjectView(program('CRPS'));
  const detail = (view, id) => view.materials.find(m => m.id === id).parts.map(x => x.text).join(' ');
  assert.match(detail(gla, 'graduation'), /CSSD.*英文Verification Report of China Secondary Education Qualification Certificate/);
  assert.match(detail(jdp, 'transcript'), /高中\/高等中等教育所有年级.*非英语成绩单均须译成英语.*日语成绩单.*不接受chousasho/);
  for (const term of ['200', '250', '300', '必须有标题']) assert.ok(detail(crps, 'essay').includes(term));
  assert.match(detail(jdp, 'english'), /5766.*1366/);
  assert.match(gla.materialNotes.map(x => x.text).join(' '), /翻译.*印章|官方.*签名/);
});

test('empty post-entry sections and links disappear; academic deadline appears only with rounds', () => {
  for (const p of programs) {
    const html = render(p), view = buildProjectView(p);
    assert.equal(html.includes('id="detail-after"'), view.post.length > 0);
    assert.equal(html.includes(`#program/${p.id}/after`), view.post.length > 0);
    assert.ok(html.includes('role="switch" aria-checked="false"'));
    assert.ok(!text(html).includes('资格组合'));
    const academic = html.slice(html.indexOf('id="detail-academic"'), html.indexOf('id="detail-language"'));
    for (const round of p.rounds) {
      assert.ok(html.includes(round.enrollmentDate));
      assert.ok(!academic.includes(round.enrollmentDate));
    }
    assert.match(html, /id="detail-rounds"[\s\S]*资格须在对应入学节点前取得/);
  }
});

test('edited rule values, additional materials and HTML-sensitive strings survive safely', () => {
  const p = program('GLA');
  p.language[0].score = 89;
  p.paths.find(x => x.id === 'G').all.find(c => c.field === 'ageAtEnrollment').value = 19;
  p.materials.push({ id: 'custom', label: '<img onerror=alert(1)>', note: '员工补充 <完整说明>', stage: '申请' });
  const view = buildProjectView(p), html = render(p);
  assert.match(view.paths.find(x => x.id === 'G').description, /19岁/);
  assert.ok(html.includes('≥ 89'));
  assert.equal(view.materials.at(0).id, p.materials[0].id);
  assert.ok(view.materials.find(m => m.id === 'custom').parts.some(x => x.text === '员工补充 <完整说明>'));
  assert.ok(!html.includes('<img onerror'));
  assert.ok(html.includes('&lt;img onerror'));
});
