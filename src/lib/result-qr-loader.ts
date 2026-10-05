let pending: Promise<typeof import("qrcode.react")> | undefined;

// Loaded only when the invitation/share dialog is used. This module contains
// no QR implementation and never creates a request on import alone.
export function preloadResultQrCode() {
  return pending ??= import("qrcode.react").catch(error => {
    pending = undefined;
    throw error;
  });
}
