// Next dev may use localhost internally even for requests to 127.0.0.1.
// Keep redirects on the browser's incoming host so host-only cookies survive.
export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host) url.host = host;
  return url.origin;
}
