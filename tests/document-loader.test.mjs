import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentLoader } from '../public/document-loader.js';

function harness(options = {}) {
  const calls = [], started = [], shown = [], errors = [], snapshots = new Map();
  const loader = createDocumentLoader({
    read(id, signal) {
      return new Promise((resolve, reject) => {
        calls.push({ id, signal, resolve, reject });
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    },
    latest: id => snapshots.get(id),
    apply: doc => snapshots.set(doc.id, doc),
    start: (id, options) => started.push({ id, ...options }),
    success: doc => shown.push(doc),
    failure: (id, error) => errors.push({ id, error }),
    ...options
  });
  return { loader, calls, started, shown, errors, snapshots };
}
const doc = (id, statusVersion = 1) => ({ id, statusVersion, status: 'review' });

test('view opens immediately and repeated clicks/polling share the pending read', async () => {
  const h = harness(), pending = h.loader.open('28');
  assert.deepEqual(h.started, [{ id: '28', background: false }]);
  assert.equal(h.shown.length, 0);
  assert.equal(h.loader.open('28'), pending);
  assert.equal(h.loader.open('28', { background: true }), pending);
  assert.equal(h.loader.open('old', { background: true }), pending);
  assert.equal(h.calls.length, 1);
  h.calls[0].resolve(doc('28')); await pending;
  assert.deepEqual(h.shown, [doc('28')]);
  assert.equal(h.errors.length, 0);
});

test('closing a loading dialog cancels the read and never opens it again', async () => {
  const h = harness(), pending = h.loader.open('27');
  h.loader.cancel(); await pending;
  h.calls[0].resolve(doc('27'));
  assert.equal(h.calls[0].signal.aborted, true);
  assert.equal(h.shown.length, 0);
  assert.equal(h.errors.length, 0);
});

test('switching files or opening a foreground view cancels an older background read', async () => {
  const h = harness(), old = h.loader.open('27', { background: true });
  const current = h.loader.open('29');
  assert.equal(h.calls[0].signal.aborted, true);
  h.calls[1].resolve(doc('29')); await Promise.all([old, current]);
  assert.deepEqual(h.shown.map(d => d.id), ['29']);
  assert.equal(h.errors.length, 0);
});

test('a newer polling snapshot triggers a fresh read instead of silently dropping the view', async () => {
  const h = harness(), pending = h.loader.open('28');
  h.snapshots.set('28', doc('28', 3));
  h.calls[0].resolve(doc('28', 2)); await Promise.resolve();
  assert.equal(h.calls.length, 2);
  assert.equal(h.shown.length, 0);
  h.calls[1].resolve(doc('28', 3)); await pending;
  assert.deepEqual(h.shown, [doc('28', 3)]);
});

test('repeatedly stale data produces a visible error and permits retry', async () => {
  const h = harness(); h.snapshots.set('28', doc('28', 3));
  const pending = h.loader.open('28');
  h.calls[0].resolve(doc('28', 2)); await Promise.resolve();
  h.calls[1].resolve(doc('28', 2)); await pending;
  assert.equal(h.shown.length, 0);
  assert.match(h.errors[0].error.message, /重试加载最新内容/);
  const retry = h.loader.open('28'); h.calls[2].resolve(doc('28', 3)); await retry;
  assert.deepEqual(h.shown, [doc('28', 3)]);
});

test('network errors and timeouts remain actionable and do not prevent a new read', async () => {
  const h = harness({ timeoutMs: 10 });
  const first = h.loader.open('27'); h.calls[0].reject(new TypeError('fetch failed')); await first;
  assert.equal(h.errors[0].error.name, 'TypeError');
  await h.loader.open('27');
  assert.equal(h.calls[1].signal.aborted, true);
  assert.match(h.errors[1].error.message, /加载超时/);
  const retry = h.loader.open('27'); h.calls[2].resolve(doc('27')); await retry;
  assert.equal(h.shown.length, 1);
});

test('a render exception is reported as a load failure rather than leaving a blank view', async () => {
  const h = harness({ success: () => { throw new Error('render failed'); } });
  const pending = h.loader.open('29'); h.calls[0].resolve(doc('29')); await pending;
  assert.equal(h.errors[0].error.message, 'render failed');
});
