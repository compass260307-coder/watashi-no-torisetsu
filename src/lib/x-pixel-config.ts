export type XPixelConfig = {
  id: string;
  configureOnce?: boolean;
  locale?: "ko";
  diagnosis: { eventId: string; legacyEventIds?: readonly string[]; includeParams?: boolean };
  purchase: { eventId: string; currency?: string; includeParams?: boolean };
};

// Add/remove a destination here. Base initialization and both event fan-outs
// are derived from this same list; keep each account's existing event contract.
export const ACTIVE_X_PIXELS: readonly XPixelConfig[] = [
  {
    id: "rgg36",
    diagnosis: { eventId: "tw-rgg36-rgg9b" },
    purchase: { eventId: "tw-rgg36-rgg3b", currency: "JPY", includeParams: true },
  },
  {
    id: "rgob2",
    diagnosis: { eventId: "tw-rgob2-rgobn" },
    purchase: { eventId: "tw-rgob2-rgobj" },
  },
  {
    id: "rgskb",
    diagnosis: { eventId: "tw-rgskb-rgski" },
    purchase: { eventId: "tw-rgskb-rgskd" },
  },
  {
    id: "rgtx5",
    configureOnce: true,
    diagnosis: { eventId: "tw-rgtx5-rgu2v", legacyEventIds: ["tw-rgtx5-rgtxe"] },
    purchase: { eventId: "tw-rgtx5-rgtx9" },
  },
  { id: "rhj3s", diagnosis: { eventId: "tw-rhj3s-rhj43" }, purchase: { eventId: "tw-rhj3s-rhj45" } },
  {
    id: "rh617",
    configureOnce: true,
    locale: "ko",
    diagnosis: { eventId: "tw-rh617-rh619" },
    purchase: { eventId: "tw-rh617-rh61c" },
  },
];

// Define twq synchronously before result-page effects. Preserve the existing
// loader and existing initialization behavior. Locale-scoped pixels also
// initialize on demand before a verified conversion on an unprefixed route.
export const X_PIXEL_SCRIPT = `!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');` +
  ACTIVE_X_PIXELS.map((pixel) => {
    const call = `window.twq('config',${JSON.stringify(pixel.id)});`;
    if (!pixel.configureOnce) return call;
    const guard = JSON.stringify(`__wt_x_${pixel.id}_configured`);
    const init = `if(!window[${guard}]){${call}window[${guard}]=true;}`;
    return pixel.locale ? `if(/^\\/${pixel.locale}(?:\\/|$)/.test(window.location.pathname)){${init}}` : init;
  }).join("");
