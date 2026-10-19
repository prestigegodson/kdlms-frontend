/*
 * Runtime APIs core-js doesn't cover (plugin-legacy handles the rest - see
 * vite.config.ts). Imported first in main.tsx so it runs before any module
 * that uses them.
 */

// crypto.randomUUID needs Chrome 92 / Safari 15.4, and even on newer browsers
// it's missing outside a secure context (e.g. the app opened over plain HTTP
// on a school LAN). An RFC 4122 v4 UUID from getRandomValues, which old
// tablets do have.
if (typeof crypto !== "undefined" && typeof crypto.randomUUID !== "function") {
  crypto.randomUUID = function randomUUID() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as ReturnType<
      Crypto["randomUUID"]
    >;
  };
}
