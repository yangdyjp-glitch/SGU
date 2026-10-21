import { buildProjectView, pathDescription } from './requirement-model.js';

// The shared catalogue names qualifications, not school-specific A/B/C paths.
// Acceptance is derived from each live program's rules; the matching engine
// continues to evaluate every AND condition within every eligible alternative.
const normal = value => String(value).normalize('NFKC').toLowerCase().replace(/[\s_–—-]/g, '');
const diploma = (id, label, values) => ({ id, label, field: 'qualification', values: values || [label] });
export const baseQualifications = [
  { id: 'standard12', label: '十二年正规学校课程', field: 'standard12' },
  { id: 'mext-equivalent', label: 'MEXT认定等同课程', field: 'standard12', mext: true },
  { id: 'international12', label: '国际学校十二年课程', field: 'international12' },
  ...['WASC', 'NEASC', 'Cognia', 'COBIS', 'CIS', 'ACSI'].map(value => ({ id: `accreditation-${value.toLowerCase()}`, label: value, field: 'accreditation', values: [value] })),
  { id: 'japanDesignated12', label: '日本境内MEXT指定国际学校', field: 'japanDesignated12' },
  diploma('ib', 'IB Diploma', ['IB Diploma', 'International Baccalaureate Diploma']),
  diploma('gce-alevel', 'GCE A-Level'),
  diploma('international-alevel', 'International A-Level'),
  diploma('abitur', 'Abitur'),
  diploma('baccalaureate', 'Baccalaureate'),
  diploma('european-baccalaureate', 'European Baccalaureate'),
  diploma('ossd', 'OSSD', ['OSSD', 'Ontario Secondary School Diploma']),
  diploma('dse', 'DSE', ['DSE', 'HKDSE', 'Hong Kong Diploma of Secondary Education']),
  { id: 'designated11', label: 'MEXT指定十一年课程', field: 'designated11' },
  { id: 'preparatory', label: '短学制＋MEXT指定预备教育', field: 'preparatory' },
  { id: 'equivalency', label: 'GED／海外十二年同等学力考试', field: 'equivalency' },
  { id: 'japanEquivalency', label: '日本高卒认定考试', field: 'japanEquivalency' },
  { id: 'individualReview', label: '大学个别资格认定', field: 'individualReview' }
];

const positiveValues = atom => atom.op === 'in' && Array.isArray(atom.value) ? atom.value : atom.op === 'eq' ? [atom.value] : [];
const sameValue = (a, b) => normal(a) === normal(b);

export function buildQualificationCatalog(programs) {
  const result = baseQualifications.map(item => ({ ...item }));
  const coveredFields = new Set([...result.map(item => item.field), 'educationStatus', 'ageAtEnrollment', 'shortSchool']);
  for (const p of programs) for (const path of p.paths || []) for (const atom of path.all || []) {
    if (['qualification', 'accreditation'].includes(atom.field)) {
      for (const value of positiveValues(atom).filter(value => typeof value === 'string')) {
        if (!result.some(item => item.field === atom.field && item.values?.some(v => sameValue(v, value)))) {
          result.push({ id: `${atom.field}:${normal(value)}`, label: value, field: atom.field, values: [value] });
        }
      }
    } else if (!coveredFields.has(atom.field) && atom.op === 'eq' && atom.value === true) {
      result.push({ id: `condition:${atom.field}`, label: atom.label || atom.field, field: atom.field });
      coveredFields.add(atom.field);
    }
  }
  return result;
}

function matchingAtoms(item, path, program) {
  return (path.all || []).filter(atom => {
    if (atom.field !== item.field) return false;
    if (item.values) return positiveValues(atom).some(value => item.values.some(v => sameValue(v, value)));
    if (atom.op !== 'eq' || atom.value !== true) return false;
    if (item.mext) {
      const requirement = program.requirements?.find(row => row.id === atom.source?.ruleId);
      return /MEXT/i.test([atom.label, atom.source?.quote, requirement?.detail].filter(Boolean).join(' '));
    }
    return true;
  });
}

function describe(item, path, matching) {
  if (!item.values) return path.description;
  // Remove only the alternatives already named by this row, retaining all other conditions.
  const remainder = { ...path, all: path.all.filter(atom => !matching.includes(atom)) };
  const detail = pathDescription(remainder);
  return (item.field === 'qualification' ? '须持有完整资格；' : '') + (detail !== '。' ? detail : '预计取得的资格须按入学节点核对。');
}

export function buildQualificationRows(programs, allPrograms = programs) {
  const views = new Map(programs.map(p => [p.id, buildProjectView(p)]));
  return buildQualificationCatalog(allPrograms).map(item => {
    const cells = programs.map(p => {
      const paths = views.get(p.id).paths.filter(path => matchingAtoms(item, path, p).length);
      const descriptions = paths.map(path => describe(item, path, matchingAtoms(item, path, p)));
      const exclusion = p.requirements?.find(row => row.id === 'R013' && p.sourceIds?.includes('aohb27'));
      const explicitlyExcluded = !paths.length && exclusion && ['preparatory', 'japanEquivalency'].includes(item.id);
      return { programId: p.id, accepted: paths.length > 0, reason: paths.length ? '明确列明，须满足附加条件' : explicitlyExcluded ? '手册明确不适用' : '手册未列明',
        pathIds: paths.map(path => path.id), descriptions,
        sources: paths.flatMap(path => path.sources || [path.source]).filter(Boolean) };
    });
    const groups = new Map();
    for (const cell of cells) for (const text of cell.descriptions) {
      if (!groups.has(text)) groups.set(text, { text, programs: [], sources: [] });
      const group = groups.get(text); if (!group.programs.includes(cell.programId)) group.programs.push(cell.programId); group.sources.push(...cell.sources);
    }
    return { ...item, cells, conditions: [...groups.values()] };
  });
}

export function renderQualificationMatrix(programs, allPrograms, ui) {
  const { esc, evidence } = ui;
  const rows = buildQualificationRows(programs, allPrograms);
  const refs = sources => [...new Map(sources.map(source => [JSON.stringify(source), source])).values()].map(evidence).join(' ');
  return `<div class="qualification-tools"><label class="search">${ui.icon('search')}<input data-qualification-search aria-label="搜索学制或资格" placeholder="搜索学制、认证或文凭，如 IB、WASC、DSE"></label><span class="muted small">${rows.length} 项统一资格</span></div>
    <div class="table-wrap"><table class="qualification-matrix"><thead><tr><th scope="col">学制／资格</th>${programs.map(p => `<th scope="col" class="acceptance-column"><a href="#program/${esc(p.id)}">${esc(p.id)}</a></th>`).join('')}<th scope="col">附加条件与适用说明</th></tr></thead><tbody>${rows.map(row => `<tr data-qualification="${esc(row.id)}" data-qualification-label="${esc(row.label.toLowerCase())}"><th scope="row">${esc(row.label)}</th>${row.cells.map(cell => `<td class="acceptance-cell" title="${esc(cell.reason)}"><span class="qualification-status ${cell.accepted ? 'accepted' : 'not-listed'}" aria-label="${esc(cell.programId + '：' + (cell.accepted ? '可；' : '否；') + cell.reason)}">${cell.accepted ? '可' : '否'}</span></td>`).join('')}<td class="qualification-conditions">${row.conditions.length ? row.conditions.map(group => `<div>${group.programs.length < programs.length ? `<strong class="inline-programs">${group.programs.map(esc).join(' / ')}：</strong>` : ''}${esc(group.text)} ${refs(group.sources)}</div>`).join('') : '手册未列明为独立资格。'}${row.cells.some(c => !c.accepted) && row.conditions.length ? `<div class="muted">${row.cells.filter(c => !c.accepted).map(c => `${esc(c.programId)}：${esc(c.reason)}`).join('；')}。</div>` : ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="qualification-legend">“可”表示明确列为资格，仍须满足本行附加条件及语言、材料等要求。“否”表示未列明或明确不适用，不代表持有人不能通过其他通用资格申请。</p><p class="qualification-empty hidden">没有找到该学制或资格。</p>`;
}
