/**
 * Resolves a school's login-page subdomain (e.g. `"greenwood"` for
 * `greenwood.kdlms.com`) from the browser's own hostname - the backend
 * can't read this off the request `Host` header itself, since the deployed
 * frontend calls a separate `api.kdlms.com` origin (and Vite's dev proxy
 * rewrites `Host` too), so this is passed explicitly on every call that
 * needs it (`api/auth.ts`'s `login`, `api/publicBranding.ts`).
 *
 * Recognizes two shapes:
 *  - `greenwood.kdlms.com` (>= 3 labels) - the production shape.
 *  - `greenwood.localhost` (2 labels ending in `localhost`) - the local dev
 *    shape, since Chrome/Firefox resolve any `*.localhost` host natively and
 *    `npm run dev` is already `vite --host`.
 *
 * Returns `null` for the platform's own host (a bare `localhost`, an IP
 * literal, a 2-label apex like `kdlms.com`, or a reserved label - see
 * `RESERVED`, mirroring the backend's `SchoolSubdomain`) - falls back to
 * `VITE_DEV_SUBDOMAIN` when set, for a developer who'd rather not use
 * `*.localhost`.
 */

// Mirrors backend school.domain.SchoolSubdomain.RESERVED - platform hosts a
// school must never be able to shadow.
const RESERVED = new Set(["app", "www", "api", "admin", "mail", "static", "assets", "cdn", "status"]);

export function resolveSchoolSubdomain(hostname: string = window.location.hostname): string | null {
  const label = extractLabel(hostname);
  if (!label || RESERVED.has(label)) {
    return devFallback();
  }
  return label;
}

function extractLabel(hostname: string): string | null {
  const lower = hostname.toLowerCase();
  // An IP literal (IPv4 - "192.168.1.1", or bracketed IPv6 - "[::1]") is
  // never a subdomain host.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower) || lower.startsWith("[")) {
    return null;
  }

  const labels = lower.split(".");
  if (labels.length >= 3) {
    // greenwood.kdlms.com -> "greenwood"; a bare 2-label apex (kdlms.com)
    // or the loopback (localhost) fall through to the checks below.
    return labels[0];
  }
  if (labels.length === 2 && labels[1] === "localhost") {
    // greenwood.localhost -> "greenwood"
    return labels[0];
  }
  return null;
}

function devFallback(): string | null {
  const fallback = import.meta.env.VITE_DEV_SUBDOMAIN;
  return fallback && fallback.trim() !== "" ? fallback.trim().toLowerCase() : null;
}

/**
 * The platform's own login URL, for a "wrong school" error's escape hatch
 * (`features/auth/LoginPage.tsx`) - strips the current host's school
 * subdomain back off, landing on `app.<root>` (or bare `localhost` in the
 * `*.localhost` dev shape). Falls back to the current origin unchanged if
 * the host doesn't look like a school subdomain at all.
 */
export function platformLoginUrl(location: Location = window.location): string {
  const labels = location.hostname.toLowerCase().split(".");
  let rootHost: string;
  if (labels.length >= 3) {
    rootHost = ["app", ...labels.slice(1)].join(".");
  } else if (labels.length === 2 && labels[1] === "localhost") {
    rootHost = "localhost";
  } else {
    rootHost = location.hostname;
  }
  const port = location.port ? `:${location.port}` : "";
  return `${location.protocol}//${rootHost}${port}/login`;
}
