/**
 * Node adapter for the runtime-agnostic relay — used by server.mjs
 * (production) and vite.config.js (dev middleware). Keeps relay.mjs
 * free of node:* imports so it also runs on Cloudflare Pages Functions.
 */
import { Readable } from 'node:stream';
import { handleRelay } from './relay.mjs';

/** Convert an IncomingMessage into a Request, run the relay, pipe the
 *  Response back. Returns true when the relay handled the request. */
export async function nodeRelay(req, res, env) {
  try {
    const request = new Request('http://localhost' + req.url, {
      method: req.method || 'GET',
      headers: req.headers
    });
    const resp = await handleRelay(request, env || process.env);
    if (!resp) return false;
    res.writeHead(resp.status, Object.fromEntries(resp.headers.entries()));
    if (resp.body) Readable.fromWeb(resp.body).pipe(res);
    else res.end();
    return true;
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(String(e.message || 'relay error'));
    } else {
      res.end();
    }
    return true;
  }
}
