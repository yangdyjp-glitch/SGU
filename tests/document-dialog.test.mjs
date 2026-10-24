import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Execute the real page click handler with only the browser surface stubbed.
const appUrl = new URL('../public/app.js', import.meta.url);
const source = await readFile(appUrl, 'utf8');
const imports = {};
for (const match of source.matchAll(/^import \{([^}]+)\} from '([^']+)';$/gm)) {
  const module = await import(new URL(match[2], appUrl));
  for (const name of match[1].split(',').map(s => s.trim())) imports[name] = module[name];
}
const code = source.replace(/^import .*;\r?\n/gm, '');
const decode = text => text.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

async function page() {
  const listeners = new Map(), requests = [], notices = [];
  let visible = false, title = '', content = '';
  const body = {
    get innerHTML() { return notices.join('') + content; },
    set innerHTML(value) { content = value; notices.length = 0; },
    insertAdjacentHTML(position, html) { assert.equal(position, 'afterbegin'); notices.unshift(html); }
  };
  const root = {
    set innerHTML(value) {
      visible = Boolean(value);
      title = value.match(/id="modal-title">([^<]*)/)?.[1] || '';
      body.innerHTML = value.match(/<div class="modal-body">([\s\S]*)<\/div><\/section><\/div>$/)?.[1] || '';
    },
    get innerHTML() { return visible ? body.innerHTML : ''; }
  };
  const nodes = { '#modal-root': root, '#app': { innerHTML: '' }, '#toast': { innerHTML: '' } };
  const document = {
    body: { style: {} }, activeElement: { focus() {} }, hidden: false,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
    querySelectorAll() { return []; },
    querySelector(selector) {
      if (nodes[selector]) return nodes[selector];
      if (!visible) return null;
      if (selector === '.modal-body') return body;
      if (selector === '.document-load-feedback') return notices.length ? { remove() { notices.length = 0; } } : null;
      if (selector === '.document-review') {
        const match = content.match(/class="document-review" data-document-id="([^"]+)" data-content-status="([^"]+)"/);
        return match ? { dataset: { documentId: decode(match[1]), contentStatus: decode(match[2]) } } : null;
      }
      return null;
    }
  };
  const app = await vm.runInNewContext(`(async()=>{${code}\nreturn { setData(value){data=value;auth={login:'test'};}, applyDocumentSnapshots };})()`, {
    ...imports, setupDetailHints() {}, setupTableScrolling() {}, document, window: { addEventListener() {} },
    location: { hash: '#library' }, setInterval() {}, setTimeout, clearTimeout, confirm: () => true,
    fetch(url, options) {
      if (url === '/api/auth/state') return Promise.resolve({ ok: true, json: async () => ({ user: null }) });
      return new Promise((resolve, reject) => {
        requests.push({ url, options, resolve: doc => resolve({ ok: true, json: async () => doc }), reject });
        options.signal?.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      });
    }
  });
  const docs = ['28', '27', '29'].map(id => ({ id, name: `${id}筑波大学.pdf`, status: 'review', statusVersion: 1, hasReview: true }));
  app.setData({ documents: docs, programs: [] });
  function click(act, id) {
    const button = { dataset: { act, id }, isConnected: true, disabled: false };
    const target = { closest: selector => selector === '[data-act]' ? button : null };
    return Promise.all((listeners.get('click') || []).map(fn => fn({ target })));
  }
  return { click, requests, body, docs, app, visible: () => visible, title: () => title };
}
function detail(doc) {
  return { ...doc, text: `资料原文 ${doc.id}`, autoReview: { version: 1, entries: [], issues: [] } };
}

test('library View clicks open a named loading dialog immediately and render each returned document', async () => {
  const p = await page();
  for (const doc of p.docs) {
    const loading = p.click('document', doc.id);
    assert.equal(p.visible(), true);
    assert.equal(p.title(), doc.name);
    assert.match(p.body.innerHTML, /正在加载资料/);
    assert.equal(p.requests.at(-1).url, `/api/documents/${doc.id}`);
    p.requests.at(-1).resolve(detail(doc)); await loading;
    assert.match(p.body.innerHTML, new RegExp(`data-document-id="${doc.id}"`));
    assert.match(p.body.innerHTML, new RegExp(`资料原文 ${doc.id}`));
    assert.doesNotMatch(p.body.innerHTML, /正在加载资料|资料暂时无法加载/);
    await p.click('close'); assert.equal(p.visible(), false);
  }
});

test('load failure remains in the dialog with a working retry and original-file link', async () => {
  const p = await page(), doc = p.docs[0];
  const loading = p.click('document', doc.id);
  p.requests[0].reject(new TypeError('Failed to fetch')); await loading;
  assert.equal(p.visible(), true);
  assert.match(p.body.innerHTML, /资料暂时无法加载/);
  assert.match(p.body.innerHTML, /重试加载/);
  assert.match(p.body.innerHTML, /href="\/uploads\/28"/);
  const retry = p.click('document', doc.id);
  p.requests[1].resolve(detail(doc)); await retry;
  assert.match(p.body.innerHTML, /data-document-id="28"/);
  assert.doesNotMatch(p.body.innerHTML, /资料暂时无法加载/);
});

test('closing during a read does not resurrect the modal, and unchanged refresh preserves review content', async () => {
  const p = await page(), doc = p.docs[0];
  const canceled = p.click('document', doc.id);
  await p.click('close'); await canceled;
  assert.equal(p.visible(), false);
  assert.equal(p.requests[0].options.signal.aborted, true);
  const loading = p.click('document', doc.id);
  p.requests[1].resolve(detail(doc)); await loading;
  p.body.innerHTML += '<textarea>未提交的核对意见</textarea>';
  const original = p.body.innerHTML, refresh = p.click('document', doc.id);
  assert.match(p.body.innerHTML, /未提交的核对意见/);
  p.requests[2].resolve(detail(doc)); await refresh;
  assert.equal(p.body.innerHTML, original);
  await p.click('close');
});
