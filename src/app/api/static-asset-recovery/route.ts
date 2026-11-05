import { MISSING_STATIC_ASSET_BOOTSTRAP, STATIC_ASSET_RECOVERY_HEADERS as headers } from "@/lib/static-asset-recovery.mjs";

// Only missing JS reaches this handler via a fallback rewrite. Existing assets win.
// This fixed response performs no fetch, authentication, payment or database operations.
export function GET() {
  return new Response(MISSING_STATIC_ASSET_BOOTSTRAP, { headers });
}

// Keep compatibility with recovery probes embedded in already-cached older HTML.
export function HEAD() {
  return new Response(null, { status: 404, headers });
}
