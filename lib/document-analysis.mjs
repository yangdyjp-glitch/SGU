import { normalizeSchool } from '../public/document-review.js';

const fields = [
  ['年龄', /\bage\b|\baged\b|\b\d{1,2}\s+years?\s+(?:of\s+age|old)\b|年龄|年齢|\d+\s*[岁歳]/i],
  ['国籍及签证', /\bcitizen(?:s|ship)?\b|\bnationalit(?:y|ies)\b|\bvisas?\b|\bresiden(?:t|ce|cy)\b|国籍|签证|在留/i],
  ['多项目及多轮申请', /\bmultiple\s+applications?\b|\bre-?appl(?:y|ication|ications)\b|复用|并申|併願/i],
  ['学费', /\btuition\b|学费|授業料/i],
  ['其他证明材料', /\b(?:passports?|photographs?|photos?|awards?|financial|certificates?|transcripts?|recommendations?)\b|证明|証明/i],
  ['语言成绩', /\b(?:TOEFL|IELTS|PTE|Duolingo|TOEIC|Cambridge)\b/i],
  ['学术考试', /\b(?:SAT|ACT|EJU)\b/i],
  ['学历路径', /\bdiplomas?\b|\bA[- ]Levels?\b|\b(?:12|twelve)[- ]year\b|\bqualifications?\b|\bsecondary\s+education\b|学历|学歴|资格|資格/i],
  ['申请时间', /\b(?:application\s+(?:period|deadline)|deadline|enrollment\s+date)\b|申请截止|出願期間/i]
];
const clean = value => value.replace(/<!--.*?-->/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+|doc:[^\s)]+/g, '').replace(/<\/?[a-z][^>]*>/gi, ' ').replace(/&(?:nbsp|amp|lt|gt|quot);/g, entity => ({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"'}[entity])).replace(/\s+/g, ' ').trim();

export function suggestions(text, { pdf = false } = {}) {
  const result = [], seen = new Set();
  let page = null, inComment = false, inContents = false;
  for (const [index, raw] of String(text || '').split(/\r?\n/).entries()) {
    const marker = raw.match(/<!--\s*page\s+(\d+)\s+of\s+\d+\s*-->/i);
    if (marker) { page = pdf ? Number(marker[1]) : null; inContents = false; continue; }
    if (inComment) { if (raw.includes('-->')) inComment = false; continue; }
    if (raw.includes('<!--') && !raw.includes('-->')) { inComment = true; continue; }
    const value = clean(raw);
    if (/^#{0,6}\s*(?:table of contents|contents|目录|目次)\s*$/i.test(value)) { inContents = true; continue; }
    if (/^#{1,6}\s/.test(value)) { inContents = false; continue; }
    if (inContents || value.length < 12 && !/\d/.test(value) || /^[\s|:\-]+$/.test(value)) continue;
    const tags = fields.filter(([, expression]) => expression.test(value)).map(([field]) => field);
    const key = value.toLowerCase().replace(/\s+/g, ' ');
    if (!tags.length || seen.has(key)) continue;
    seen.add(key); result.push({ line: index + 1, ...(page ? { page } : {}), text: value, fields: tags });
  }
  return result;
}

export function analyzeDocument(doc, programs = []) {
  const text = String(doc.text || '');
  const cover = text.split(/<!--\s*page\s+2\s+of\s+\d+\s*-->/i)[0].slice(0, 8000);
  const lines = cover.split(/\r?\n/).map(line => clean(line).replace(/^#+\s*/, '')).filter(Boolean);
  const known = [...new Set(programs.map(p => p.school)), '早稻田大学', '早稲田大学', 'Waseda University', '立命馆大学', '立命館大学', 'Ritsumeikan University'];
  const matches = [...new Set(known.filter(name => cover.toLowerCase().includes(name.toLowerCase())).map(normalizeSchool))];
  const school = matches.length === 1 ? matches[0] : matches.length > 1 ? '' : lines.find(line => /^(?:[\p{L} .&'-]+ University|University of [\p{L} .&'-]+|[\p{Script=Han}]{2,20}大学)$/iu.test(line)) || '';
  const title = lines.find(line => /application guide|admissions?|entry|入学|招生/i.test(line) && /\b20\d{2}\b/.test(line)) || doc.filename || '';
  const year = title.match(/\b20\d{2}\b/);
  const englishName = lines.find(line => /^(?:School|College|Faculty|Department) of /i.test(line)) || '';
  const channel = title.match(/Application Guide for\s+(.+?)\s+20\d{2}/i)?.[1] || '';
  return { school: normalizeSchool(school), year: year ? Number(year[0]) : null, englishName, channel };
}

export function documentForReview(doc, programs) {
  const {previousAutoReview,previousManualDraft,...current}=doc;
  if(doc.autoReview&&!doc.projectDraft){const {analysis,suggestions,...review}=current;return review;}
  return { ...current, analysis: analyzeDocument(doc, programs), suggestions: suggestions(doc.text, { pdf: /\.pdf$/i.test(doc.filename || '') }) };
}
