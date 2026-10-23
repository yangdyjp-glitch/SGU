export const documentStatusLabels = { ready:'已核对', uploaded:'待处理', queued:'等待处理', parsing:'提取原文中', extracting:'自动整理中', needs_configuration:'等待模型配置', review:'待整体核对', published:'已入库', error:'处理失败' };

export function documentSummary(doc) {
  const { text, suggestions, projectDraft, previousManualDraft, previousAutoReview, analysis, autoReview, reviewerFeedback, ...summary } = doc;
  return { ...summary, statusVersion: doc.statusVersion || 0, hasText: Boolean(text || doc.hasText), hasReview:Boolean(autoReview||doc.hasReview),reviewVersion:autoReview?.version??doc.reviewVersion??0 };
}

export function mergeDocumentSnapshot(current, incoming) {
  if (current && (current.statusVersion || 0) > (incoming.statusVersion || 0)) return current;
  return { ...current, ...incoming };
}

export const documentStatusKey = doc => JSON.stringify([doc.statusVersion || 0, doc.status, doc.error || '']);

export function renderDocumentBadge(doc, { esc, badge }) {
  return `<span data-document-status="${esc(doc.id)}" role="status">${badge(documentStatusLabels[doc.status] || doc.status, ['ready','published'].includes(doc.status) ? 'pass' : doc.status === 'error' ? 'fail' : 'unknown')}</span>`;
}
