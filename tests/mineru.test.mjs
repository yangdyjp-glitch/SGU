import test from 'node:test';
import assert from 'node:assert/strict';
import { createMineruClient, runMineru } from '../lib/mineru.mjs';

const ready = { running: true, parse_server: { local: { healthy: true, mode: 'managed', supported_tiers: ['basic', 'standard', 'advanced'] } } };
const warming = { running: true, parse_server: { local: { healthy: false, mode: 'managed', starting: true, supported_tiers: [] } } };
const payload = { content: { content: '完整提取文本', tier: 'standard' } };
const coded = code => Object.assign(new Error(code), { code });

test('a stopped service starts once, waits for the local engine, then parses the exact file', async () => {
  const calls = [];
  const statuses = [{ running: false }, warming, ready];
  let time = 0;
  const client = createMineruClient({
    clock: () => time,
    pause: async ms => { time += ms; },
    run: async (args, options) => {
      calls.push({ args, options });
      if (args[1] === 'status') return statuses.shift();
      if (args[1] === 'start') return 'started';
      return payload;
    }
  });
  assert.equal(await client.parse('D:/招 生/guide.pdf'), payload);
  assert.equal(calls.filter(c => c.args[1] === 'start').length, 1);
  assert.equal(calls.find(c => c.args[1] === 'start').options.json, false);
  assert.deepEqual(calls.at(-1).args, ['parse', 'D:/招 生/guide.pdf', '--pages', 'all', '--tier', 'standard', '--wait', '180', '--limit', '1000000', '--json']);
  assert.ok(calls.every(c => !c.args.some(a => ['stop', 'restart', '--remote', '--force'].includes(a))));
});

test('a healthy shared service is reused without starting or restarting it', async () => {
  const calls = [];
  const client = createMineruClient({ run: async args => { calls.push(args); return args[0] === 'server' ? ready : payload; } });
  assert.equal(await client.parse('guide.pdf'), payload);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], ['server', 'status', '--json']);
});

test('service ownership errors propagate without trying to take over', async () => {
  const calls = [];
  const client = createMineruClient({ run: async args => { calls.push(args); throw coded('service_unavailable'); } });
  await assert.rejects(client.parse('guide.pdf'), { code: 'service_unavailable' });
  assert.equal(calls.length, 1);
});

test('disabled local parsing cannot fall back to remote or reduced quality', async () => {
  const calls = [];
  const client = createMineruClient({ run: async args => { calls.push(args); return { running: true, parse_server: { local: { mode: 'disabled' }, remote: { healthy: true, supported_tiers: ['standard'] } } }; } });
  await assert.rejects(client.parse('guide.pdf'), { code: 'local_engine_disabled' });
  assert.equal(calls.length, 1);
});

test('a cold engine has a bounded wait and is never restarted repeatedly', async () => {
  let time = 0, starts = 0, parses = 0;
  const client = createMineruClient({
    clock: () => time, pause: async ms => { time += ms; },
    run: async args => {
      if (args[0] === 'parse') parses++;
      if (args[1] === 'start') starts++;
      return { running: false };
    }
  });
  await assert.rejects(client.parse('guide.pdf'), { code: 'startup_timeout' });
  assert.equal(starts, 1);
  assert.equal(parses, 0);
});

test('a queued parse continues waiting for the same request until its content is ready', async () => {
  let time = 0;
  const parses = [];
  const client = createMineruClient({ clock: () => time, run: async args => {
    if (args[0] === 'server') return ready;
    parses.push(args);
    if (parses.length < 3) { time += 180000; throw coded('parse_wait_timeout'); }
    return payload;
  } });
  assert.equal(await client.parse('guide.pdf'), payload);
  assert.equal(parses.length, 3);
  assert.deepEqual(parses[0], parses[1]);
  assert.deepEqual(parses[1], parses[2]);
});

test('long-running parses stop waiting at the time budget without destroying the background task', async () => {
  let time = 0;
  const waits = [];
  const client = createMineruClient({ clock: () => time, run: async args => {
    if (args[0] === 'server') return ready;
    const seconds = Number(args[args.indexOf('--wait') + 1]);
    waits.push(seconds); time += seconds * 1000;
    throw coded('parse_wait_timeout');
  } });
  await assert.rejects(client.parse('guide.pdf'), { code: 'parse_timeout' });
  assert.deepEqual(waits, [180, 180, 180, 60]);
});

test('a service lost between health check and parsing is recovered only once', async () => {
  let parses = 0, checks = 0;
  const client = createMineruClient({ run: async args => {
    if (args[0] === 'server') { checks++; return ready; }
    parses++; throw coded('server_not_running');
  } });
  await assert.rejects(client.parse('guide.pdf'), { code: 'server_not_running' });
  assert.equal(checks, 2); assert.equal(parses, 2);
});

test('CLI transport reads complete output, preserves structured errors and bounds stalled processes', async t => {
  const original = process.env.MINERU_BIN;
  process.env.MINERU_BIN = process.execPath;
  t.after(() => { if (original === undefined) delete process.env.MINERU_BIN; else process.env.MINERU_BIN = original; });
  const runScript = (script, options) => runMineru(['--input-type=module', '-e', script], options);
  const result = await runScript("process.stdout.write(JSON.stringify({content:'字'.repeat(300000)}));");
  assert.equal(result.content.length, 300000);
  await assert.rejects(runScript("console.log(JSON.stringify({error:{code:'server_not_running',message:'stopped'}})); process.exitCode=1;"), { code: 'server_not_running' });
  assert.equal(await runScript("console.log('started');", { json: false }), 'started');
  await assert.rejects(runScript("console.log('not json');"), { code: 'invalid_response' });
  await assert.rejects(runScript('setTimeout(()=>{},10000);', { timeoutMs: 40 }), { code: 'command_timeout' });
});
