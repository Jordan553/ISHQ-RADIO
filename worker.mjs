/**
 * Cloudflare Worker entry — used by `npx wrangler deploy` (git-connected
 * Workers & Pages projects). Serves the relay routes, then falls back to
 * the static assets (dist/) with SPA handling.
 *
 * Env vars to set in the dashboard (Settings → Variables and Secrets):
 * ISHQ_DRIVE_KEY, ISHQ_JORDAN_FOLDER
 */
import { handleRelay } from './server/relay.mjs';

export default {
  async fetch(request, env) {
    const resp = await handleRelay(request, env);
    if (resp) return resp;
    return env.ASSETS.fetch(request);
  }
};
