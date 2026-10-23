import test from 'node:test';
import assert from 'node:assert/strict';
import { access, writeFile } from 'node:fs/promises';
import { splitPDFPages, pagesNeedingVision, extractCloudPDF, transcribePDFPage, runPDFTool } from '../lib/cloud-pdf.mjs';

const native = 'Eligibility: twelve years of formal school education. TOEFL 94; IELTS 6.5. 日本語・中文。';
const config = { apiKey: 'test-secret', model: 'gpt-6.1-sol' };
const success = page => Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(page) }] }] });
function toolsFor(pages, imageList = '') {
  const files = [], calls = [];
  return { files, calls, run: async (command, args) => {
    calls.push({ command, args });
    if (command === 'pdfinfo') return 'Pages: ' + pages.length + '\n';
    if (command === 'pdftotext') return pages.join('\f') + '\f';
    if (command === 'pdfimages') return imageList;
    if (command === 'pdfseparate') { const name = args.at(-1).replace('%d', args[1]); files.push(name); await writeFile(name, '%PDF-1.7 fixture page ' + args[1]); return ''; }
    throw new Error('unexpected tool');
  } };
}

test('native PDF retains all physical pages and text without a model call', async () => {
  const tools = toolsFor([native, native + ' second page']);
  const result = await extractCloudPDF('/safe/document.pdf', {}, { ...tools, transcribe: () => { throw new Error('unnecessary model call'); } });
  assert.equal(result.locator.pageCount, 2); assert.deepEqual(result.locator.visionPages, []);
  assert.ok(result.text.includes(native)); assert.match(result.text, /<!-- page 2 of 2 -->/);
  assert.deepEqual(result.warnings, []);
});

test('physical page boundaries and blank pages cannot be silently dropped', () => {
  assert.deepEqual(splitPDFPages(native + '\f\f', 2), [native, '']);
  assert.throws(() => splitPDFPages(native + '\f', 2), /页数/);
  assert.throws(() => splitPDFPages('one\ftwo\fthree\f', 2), /页数/);
  assert.deepEqual([...pagesNeedingVision([native, '', 'Broken \uFFFD encoding'], '')], [2, 3]);
});

test('mixed PDF identifies an image table despite an existing text layer, retaining OCR doubts and cleaning temporary pages', async () => {
  const tools = toolsFor([native, native, ''], '2 0 image 1200 800 rgb 3 8 jpeg no 5 0 150 150 100K 10%');
  const progress = [], scanned = [];
  const result = await extractCloudPDF('/safe/document.pdf', config, { ...tools, onProgress: p => progress.push(p), transcribe: async pdf => {
    scanned.push(pdf.toString());
    return scanned.length === 1 ? { text: 'HKDSE best four: [无法辨认]', blank: false, uncertainties: [{ quote: '[无法辨认]', reason: '最低分不清' }], model: config.model } : { text: '', blank: true, uncertainties: [] };
  } });
  assert.deepEqual(result.locator.visionPages, [2, 3]); assert.equal(progress.length, 2);
  assert.match(scanned[0], /page 2/); assert.match(result.text, /<!-- page 3 of 3 -->/);
  assert.ok(result.text.slice(result.text.indexOf('<!-- page 2')).includes(native));
  assert.deepEqual(result.warnings, [{ page: '2', quote: '[无法辨认]', reason: '最低分不清' }]);
  for (const file of tools.files) await assert.rejects(access(file), { code: 'ENOENT' });
});

test('scan without model configuration pauses before creating partial results', async () => {
  const tools = toolsFor([native, '']);
  await assert.rejects(extractCloudPDF('/safe/document.pdf', {}, tools), { code: 'configuration_required' });
  assert.equal(tools.files.length, 0);
});

test('failure on a later scan never returns partial text and removes owned temporary pages', async () => {
  const tools = toolsFor(['', '']); let calls = 0;
  await assert.rejects(extractCloudPDF('/safe/document.pdf', config, { ...tools, transcribe: async () => {
    if (++calls === 2) throw new Error('interrupted');
    return { text: native, blank: false, uncertainties: [] };
  } }), /interrupted/);
  for (const file of tools.files) await assert.rejects(access(file), { code: 'ENOENT' });
});

test('OpenAI PDF OCR preserves selected model, sends only this page and requires complete structured output', async () => {
  let sent;
  const expected = { text: 'Applicants must have twelve years of education.', blank: false, uncertainties: [] };
  const output = await transcribePDFPage(Buffer.from('%PDF-1.7 test'), config, { fetchImpl: async (url, options) => { sent = { url, options }; return success(expected); } });
  const body = JSON.parse(sent.options.body);
  assert.equal(sent.url, 'https://api.openai.com/v1/responses'); assert.equal(body.model, config.model); assert.equal(body.store, false); assert.equal(body.stream, true);
  assert.equal(body.text.format.strict, true); assert.match(body.input[0].content[0].file_data, /^data:application\/pdf;base64,/);
  assert.doesNotMatch(sent.options.body, /test-secret|student|sgu_session/); assert.equal(output.text, expected.text);
  for (const payload of [
    { status: 'incomplete', output: [] },
    { status: 'completed', output: [{ content: [{ type: 'refusal' }] }] },
  ]) await assert.rejects(transcribePDFPage(Buffer.from('pdf'), config, { fetchImpl: async () => Response.json(payload) }));
  for (const page of [{}, { text: '', blank: false, uncertainties: [] }, { text: native, blank: true, uncertainties: [] }])
    await assert.rejects(transcribePDFPage(Buffer.from('pdf'), config, { fetchImpl: async () => success(page) }));
  await assert.rejects(transcribePDFPage(Buffer.from('pdf'), config, { fetchImpl: async () => Response.json({ secret: 'do-not-echo' }, { status: 401 }) }), error => /密钥/.test(error.message) && !/do-not-echo/.test(error.message));
});

test('process runner preserves UTF-8 and rejects oversized, failed and stalled extraction', async () => {
  assert.equal(await runPDFTool(process.execPath, ['-e', 'process.stdout.write("中文・日本語")']), '中文・日本語');
  await assert.rejects(runPDFTool(process.execPath, ['-e', 'process.stdout.write("a".repeat(1000))'], { maxBytes: 100 }), /截断/);
  await assert.rejects(runPDFTool(process.execPath, ['-e', 'process.exit(2)']), /无法读取/);
  await assert.rejects(runPDFTool(process.execPath, ['-e', 'setTimeout(()=>{},30000)'], { timeout: 150 }), /超时/);
});
