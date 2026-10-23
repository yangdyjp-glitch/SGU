import test from 'node:test';
import assert from 'node:assert/strict';
import { documentSummary, mergeDocumentSnapshot } from '../public/document-status.js';

test('late status responses cannot restore an earlier failure or parsing state', () => {
  const failed = { id: 'doc', status: 'error', error: 'first attempt failed', statusVersion: 2 };
  const retry = { id: 'doc', status: 'parsing', error: null, statusVersion: 3 };
  const complete = { id: 'doc', status: 'review', error: null, statusVersion: 4 };
  const duringRetry = mergeDocumentSnapshot(failed, retry);
  assert.equal(duringRetry.status, 'parsing');
  assert.equal(duringRetry.error, null);
  assert.deepEqual(mergeDocumentSnapshot(duringRetry, failed), duringRetry);
  const finished = mergeDocumentSnapshot(duringRetry, complete);
  assert.deepEqual(mergeDocumentSnapshot(finished, retry), finished);
  assert.equal(finished.status, 'review');
});

test('status polling omits extracted text and editable drafts while retaining file identity', () => {
  const summary = documentSummary({ id: 'doc', name: '上智.pdf', status: 'review', text: 'TOEFL 80', suggestions: [{text:'TOEFL 80'}], projectDraft: {program:{name:'unsaved draft'}}, analysis: {school:'上智大学'} });
  assert.equal(summary.id, 'doc');
  assert.equal(summary.name, '上智.pdf');
  assert.equal(summary.statusVersion, 0);
  assert.equal(summary.hasText, true);
  for (const field of ['text','suggestions','projectDraft','analysis']) assert.equal(summary[field], undefined);
  assert.equal(documentSummary(summary).hasText, true);
});
