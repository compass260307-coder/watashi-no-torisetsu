import { MISSING_STATIC_ASSET_BOOTSTRAP } from "@/lib/static-asset-recovery.mjs";

const headers = {
  "Content-Type": "application/javascript; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

// Only missing JS reaches this handler via a fallback rewrite. Existing assets win.
// This fixed response performs no fetch, authentication, payment or database operations.
export function GET() {
  return new Response(MISSING_STATIC_ASSET_BOOTSTRAP, { headers });
}

// Keep compatibility with recovery probes embedded in already-cached older HTML.
export function HEAD() {
  return new Response(null, { status: 404, headers });
}
