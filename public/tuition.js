// Published fees can have several rates. A missing single amount is never zero.
export const hasTuitionAmount = tuition => Number.isFinite(tuition?.amount) && tuition.amount >= 0;
export function tuitionText(tuition, year) {
  const summary=tuition.status==='published'
    ? hasTuitionAmount(tuition) ? `${tuition.amount} ${tuition.currency} / ${tuition.period}` : '已公布收费标准，按适用条件核对。'
    : `${year || tuition.year || ''}年度金额未注明。`;
  return [summary,tuition.detail].filter(Boolean).join(' ');
}
