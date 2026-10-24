import { createHash } from 'node:crypto';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';

const compress = promisify(gzip);
function acceptsGzip(header) {
  const values = String(header || '').toLowerCase().split(',').map(part => {
    const [name, ...parameters] = part.trim().split(';');
    const quality = parameters.find(p => /^\s*q\s*=/.test(p));
    return [name.trim(), quality === undefined ? 1 : Number(quality.split('=')[1])];
  });
  const explicit = values.find(([name]) => name === 'gzip');
  return (explicit || values.find(([name]) => name === '*'))?.[1] > 0;
}

export async function sendContent(req, res, status, content, headers, { etag = false } = {}) {
  let body = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const out = { ...headers, Vary: 'Accept-Encoding' };
  if (etag) {
    out.ETag = `W/"${createHash('sha256').update(body).digest('hex')}"`;
    const candidates = String(req.headers['if-none-match'] || '').split(',').map(v => v.trim());
    if (['GET', 'HEAD'].includes(req.method) && (candidates.includes(out.ETag) || candidates.includes('*'))) {
      res.writeHead(304, out); res.end(); return;
    }
  }
  if (body.length >= 1024 && /^(?:text\/|application\/(?:json|javascript)|image\/svg\+xml)/i.test(out['Content-Type']) && acceptsGzip(req.headers['accept-encoding'])) {
    try { body = await compress(body, { level: 1 }); out['Content-Encoding'] = 'gzip'; } catch { /* Keep the original response if compression is unavailable. */ }
  }
  out['Content-Length'] = body.length;
  res.writeHead(status, out);
  res.end(req.method === 'HEAD' ? undefined : body);
}

export function sendJson(req, res, status, value, headers = {}) {
  return sendContent(req, res, status, JSON.stringify(value), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
}
