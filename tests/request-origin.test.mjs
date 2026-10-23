import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createRequestOrigin } from '../lib/request-origin.mjs';

const request = (host, encrypted = false, headers = {}) => ({ headers: { host, ...headers }, socket: { encrypted } });

test('direct HTTP and TLS origins retain the actual host and port without trusting forwarded headers', () => {
  const origin = createRequestOrigin({});
  assert.equal(origin(request('localhost:3210')), 'http://localhost:3210');
  assert.equal(origin(request('[::1]:3210')), 'http://[::1]:3210');
  assert.equal(origin(request('example.test:443', true)), 'https://example.test');
  assert.equal(origin(request('localhost:3210', false, { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'evil.test', forwarded: 'host=evil.test;proto=https' })), 'http://localhost:3210');
  for (const host of [undefined, ['one.test', 'two.test'], 'example.test@evil.test', 'example.test/path']) assert.equal(origin(request(host)), null);
});

test('Railway HTTPS origin is fixed by the platform domain despite the internal HTTP transport', () => {
  const origin = createRequestOrigin({ RAILWAY_PUBLIC_DOMAIN: 'sgu.up.railway.app' });
  assert.equal(origin(request('127.0.0.1:3210')), 'https://sgu.up.railway.app');
  assert.equal(origin(request('evil.test', false, { 'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'http' })), 'https://sgu.up.railway.app');
});

test('an explicit custom origin takes precedence and invalid origin configuration fails closed', () => {
  const origin = createRequestOrigin({ APP_ORIGIN: ' https://school.example:443/ ', RAILWAY_PUBLIC_DOMAIN: 'sgu.up.railway.app' });
  assert.equal(origin(request('evil.test')), 'https://school.example');
  for (const value of ['*', 'null', 'file:///tmp', 'https://user:password@example.test', 'https://example.test/path', 'https://example.test?query=1', 'https://example.test#fragment', 'https://one.test,https://two.test']) assert.throws(() => createRequestOrigin({ APP_ORIGIN: value }), /APP_ORIGIN/);
  for (const value of ['https://sgu.up.railway.app', 'sgu.up.railway.app/path', 'sgu.up.railway.app@evil.test']) assert.throws(() => createRequestOrigin({ RAILWAY_PUBLIC_DOMAIN: value }), /RAILWAY_PUBLIC_DOMAIN/);
});

test('Railway-proxied account creation and login work while cross-site and CSRF attacks remain rejected', async t => {
  const base = 'http://127.0.0.1:3228', publicOrigin = 'https://sgu.up.railway.app';
  const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, DATABASE_URL: '', DATABASE_SCHEMA: '', PORT: '3228', HOST: '127.0.0.1', DATA_DIR: '.qa/origin-' + randomUUID(), APP_ORIGIN: '', RAILWAY_PUBLIC_DOMAIN: 'sgu.up.railway.app', COOKIE_SECURE: '', MINERU_BIN: '', OPENAI_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  t.after(async () => { child.kill(); if (child.exitCode === null) await once(child, 'exit'); });
  await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('origin test server exited early'); })]);
  const post = async (path, body, headers = {}) => {
    const response = await fetch(base + '/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SGU-Request': '1', Origin: publicOrigin, ...headers }, body: JSON.stringify(body) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  for (const origin of ['https://evil.test', 'http://sgu.up.railway.app', 'https://sgu.up.railway.app.evil.test', 'null']) {
    const blocked = await post('/auth/register', {}, { Origin: origin, 'X-Forwarded-Host': new URL(origin === 'null' ? 'https://evil.test' : origin).host, 'X-Forwarded-Proto': 'https' });
    assert.equal(blocked.status, 403); assert.equal(blocked.body.error, '不允许跨站请求');
  }
  assert.equal((await post('/auth/register', {})).status, 400, 'a same-origin invalid form reaches validation, not the cross-site blocker');
  const created = await post('/auth/register', { login: 'origin_qa', password: 'OriginQA26' });
  assert.equal(created.status, 201); assert.equal(created.body.user.role, 'admin');
  assert.match(created.headers.get('set-cookie'), /; Secure/);
  const login = await post('/auth/login', { login: 'origin_qa', password: 'OriginQA26' });
  assert.equal(login.status, 200); assert.match(login.headers.get('set-cookie'), /; Secure/);
  const session = { Cookie: login.headers.get('set-cookie').split(';')[0], 'X-CSRF-Token': login.body.csrf };
  assert.equal((await post('/student-text', { text: '测试' }, session)).status, 200);
  assert.equal((await post('/student-text', { text: '测试' }, { ...session, 'X-CSRF-Token': 'wrong' })).status, 403);
  assert.equal((await post('/student-text', { text: '测试' }, { ...session, Origin: 'https://evil.test' })).status, 403);
});
