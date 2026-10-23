function normalizeOrigin(value, setting) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    return url.origin;
  } catch {
    throw new Error(`${setting} must contain only an HTTP(S) origin (scheme, hostname and optional port)`);
  }
}

// The public origin comes from server configuration, never from client-supplied
// Forwarded/X-Forwarded-* headers. Railway terminates HTTPS before our HTTP server.
export function createRequestOrigin(env = process.env) {
  const explicit = env.APP_ORIGIN?.trim();
  if (explicit) {
    const origin = normalizeOrigin(explicit, 'APP_ORIGIN');
    return () => origin;
  }
  const railwayDomain = env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) {
    if (/[\s/\\?#@:]/.test(railwayDomain)) throw new Error('RAILWAY_PUBLIC_DOMAIN must contain only a hostname');
    const origin = normalizeOrigin(`https://${railwayDomain}`, 'RAILWAY_PUBLIC_DOMAIN');
    return () => origin;
  }
  return req => {
    const host = req.headers.host;
    if (typeof host !== 'string' || !host || /[\s/\\?#@]/.test(host)) return null;
    try { return normalizeOrigin(`${req.socket.encrypted ? 'https' : 'http'}://${host}`, 'Host'); }
    catch { return null; }
  };
}
