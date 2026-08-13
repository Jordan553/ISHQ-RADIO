/**
 * Cloudflare Pages catch-all function — runs on every request that
 * doesn't match a static asset (the built dist/ is served by Pages
 * itself). Relay routes are handled here; everything else 404s.
 *
 * Env vars to set in the Pages dashboard (Settings → Environment
 * variables): ISHQ_DRIVE_KEY, ISHQ_JORDAN_FOLDER
 */
import { handleRelay } from '../server/relay.mjs';

export async function onRequest(context) {
  const resp = await handleRelay(context.request, context.env);
  if (resp) return resp;
  return context.next();
}
