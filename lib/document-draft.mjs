import { blankDocumentProgram, matchingDocumentPrograms, normalizeSchool } from '../public/document-review.js';
import { analyzeDocument } from './document-analysis.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export function prepareDocumentDraft(doc, body, programs, actor) {
  if (!['review','needs_configuration'].includes(doc.status) || !doc.text) fail('请先完成资料解析');
  if(doc.autoReview)fail('此资料已自动整理，请在整体核对界面提交修正意见');
  const previous = doc.projectDraft;
  if (body.target) {
    if (previous) fail('此资料已有草稿，请继续整理已有草稿', 409);
    const { mode, programId } = body.target;
    const school = normalizeSchool(body.target.school), year = Number(body.target.year);
    if (!school || school.length > 200 || !Number.isInteger(year) || year < 2000 || year > 2100 || !['create', 'update'].includes(mode)) fail('请确认学校、入学年份和处理方式');
    const selected = mode === 'update' ? matchingDocumentPrograms(programs, school, year).find(p => p.id === programId) : null;
    if (mode === 'update' && !selected) fail('只能选择已确认学校和入学年份下的项目');
    const scope = { ...analyzeDocument(doc, programs), school, year };
    const program = selected ? structuredClone(selected) : blankDocumentProgram(scope, doc.id);
    program.sourceIds = [...new Set([...(program.sourceIds || []), doc.id])];
    return { version: 1, target: { school, year, mode, programId: selected?.id || null }, program, note: '', savedBy: actor, savedAt: new Date().toISOString() };
  }
  if (!previous || body.expectedDraftVersion !== previous.version) fail('草稿已更新，请重新打开后再保存', 409);
  const p = body.program;
  if (!p || typeof p !== 'object' || ['id','name','school','channel'].some(k => typeof p[k] !== 'string') || ['paths','rounds','language','waivers','materials','hardConditions','requirements','sourceIds'].some(k => !Array.isArray(p[k])) || ['languagePolicy','tuition','interview','academicTests','combination'].some(k => !p[k] || typeof p[k] !== 'object')) fail('项目草稿结构不完整');
  if (!Array.isArray(p.languagePolicy.excludedFormats) || [...p.paths, ...p.waivers].some(path => !path || typeof path.label !== 'string' || !Array.isArray(path.all) || path.all.some(rule => !rule || typeof rule !== 'object')) || p.language.some(row => !row || typeof row.exam !== 'string' || !row.source) || [...p.rounds, ...p.materials, ...p.hardConditions, ...p.requirements].some(row => !row || typeof row !== 'object')) fail('项目草稿中的条件或条目结构不完整');
  validateDocumentScope(previous, p, doc.id);
  return { ...previous, version: previous.version + 1, program: p, note: String(body.note || ''), savedBy: actor, savedAt: new Date().toISOString() };
}

export function validateDocumentScope(draft, program, sourceId) {
  if (normalizeSchool(program.school) !== draft.target.school || program.year !== draft.target.year) fail('项目学校或年份与已确认的资料归属不一致');
  if (draft.target.mode === 'update' && program.id !== draft.target.programId) fail('请更新已选定的项目');
  if (!program.sourceIds?.includes(sourceId)) fail('项目必须保留本次上传文件的来源关联');
}
