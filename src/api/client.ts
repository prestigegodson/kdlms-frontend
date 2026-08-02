import type { ProblemDetail } from "@/api/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/** Thrown for any non-2xx API response, carrying the parsed problem detail when available. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem?: ProblemDetail;

  constructor(status: number, message: string, problem?: ProblemDetail) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

interface RequestOptions extends RequestInit {
  /** Attach the current access token as an Authorization header. Defaults to true; set false for public endpoints (login, health). */
  authenticated?: boolean;
}

let accessTokenProvider: () => string | null = () => null;

export function setAccessTokenProvider(provider: () => string | null): void {
  accessTokenProvider = provider;
}

/** Attempts a silent token refresh; resolves to whether it succeeded. Wired to the auth store's refreshSession(). */
let refreshHandler: (() => Promise<boolean>) | null = null;

export function setRefreshHandler(handler: () => Promise<boolean>): void {
  refreshHandler = handler;
}

/** Called when a request is unauthorized and refresh failed (or isn't wired up) - typically logs out and redirects to /login. */
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

// Single-flight: N concurrent 401s trigger exactly one refresh call, and
// every one of them awaits that same in-flight promise rather than each
// racing to refresh (and rotate) the token independently.
let refreshInFlight: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  if (!refreshHandler) {
    return Promise.resolve(false);
  }
  if (!refreshInFlight) {
    refreshInFlight = refreshHandler().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function buildHeaders(options: RequestOptions): Headers {
  const { authenticated = true, headers, body } = options;

  const requestHeaders = new Headers(headers);
  // Guarded like Content-Type below, not unconditionally .set() - callers
  // (apiFetchText, apiFetchBlob) need to declare a different Accept, and a
  // .set() here would silently overwrite theirs.
  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }
  // FormData (apiUpload's multipart body) must NOT get a JSON Content-Type -
  // the browser writes its own `multipart/form-data; boundary=...` header,
  // but only when none is set here first.
  if (body && !(body instanceof FormData) && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (authenticated) {
    const token = accessTokenProvider();
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }
  return requestHeaders;
}

function doFetch(path: string, options: RequestOptions): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, { ...options, headers: buildHeaders(options) });
}

/**
 * Shared request core for {@link apiFetch} and {@link apiFetchBlob}: single-flight
 * 401 retry via {@link refreshOnce}, then throws {@link ApiError} on a
 * non-2xx response - both callers just differ in how they parse the body of
 * an ok response.
 */
async function fetchWithAuth(path: string, options: RequestOptions): Promise<Response> {
  const { authenticated = true } = options;
  // Never attempt a refresh for the refresh call itself - that would recurse forever on a truly expired session.
  const isRefreshCall = path.startsWith("/api/v1/auth/refresh");

  let response = await doFetch(path, options);

  if (response.status === 401 && authenticated && !isRefreshCall) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      response = await doFetch(path, options);
    } else {
      unauthorizedHandler?.();
    }
  }

  if (!response.ok) {
    let problem: ProblemDetail | undefined;
    try {
      problem = (await response.json()) as ProblemDetail;
    } catch {
      // Response wasn't JSON (e.g. a non-problem-detail 5xx); fall through with no parsed body.
    }
    throw new ApiError(response.status, problem?.detail ?? response.statusText, problem);
  }
  return response;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetchWithAuth(path, options);

  // A body-less success response isn't always 204 (e.g. a `void` 201 Created
  // handler still sends a zero-length body) - detect "nothing to parse" rather
  // than special-casing one status, so parsing never throws on an empty body.
  // (Optional chaining below tolerates lightweight Response fakes in tests that
  // only implement `.json()`, falling back to the pre-existing behaviour.)
  if (response.status === 204 || response.status === 205 || response.headers?.get?.("Content-Length") === "0") {
    return undefined as T;
  }
  if (typeof response.text === "function") {
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }
  return (await response.json()) as T;
}

/**
 * Sets a default `Accept` on top of whatever the caller already passed,
 * without clobbering an explicit override - mirrors the Content-Type guard
 * in {@link buildHeaders}.
 */
function withDefaultAccept(options: RequestOptions, accept: string): RequestOptions {
  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", accept);
  }
  return { ...options, headers };
}

/**
 * Like {@link apiFetch}, but for a binary response (a report PDF, or a
 * `filestorage` image) rather than JSON - the report-download and
 * image-preview screens pair this with `utils/download.ts`'s `downloadBlob`
 * or an `URL.createObjectURL` `<img>`/`<iframe>` source, since the app's
 * private bucket means a plain `<a href>`/`<img src>` can never carry the
 * Authorization header these endpoints need. Accepts any content type since
 * it varies per file/report rather than being fixed JSON or HTML.
 */
export async function apiFetchBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await fetchWithAuth(path, withDefaultAccept(options, "*/*"));
  return response.blob();
}

/**
 * Like {@link apiFetch}, but for a plain-text/HTML response (a template/report
 * preview) rather than JSON. Also accepts `application/problem+json` - the
 * preview endpoints declare `produces = text/html`, and Spring clears its
 * producible-media-types attribute before rendering an exception, so a real
 * error (404 bad student/term, 422 unresolved template) inside the handler
 * comes back as a problem-detail body; without this in the Accept list that
 * response would itself 406 instead of surfacing the real error.
 */
export async function apiFetchText(path: string, options: RequestOptions = {}): Promise<string> {
  const response = await fetchWithAuth(
    path,
    withDefaultAccept(options, "text/html, application/problem+json"),
  );
  return response.text();
}

/**
 * Multipart upload - deliberately reuses {@link apiFetch}'s auth/refresh/error
 * handling rather than duplicating it; the only difference is the request
 * body. `fields` become additional form fields alongside `file`, for an
 * endpoint that accepts one in the same request.
 */
export function apiUpload<T>(
  path: string,
  file: File,
  fields?: Record<string, string>,
  options: RequestOptions = {},
): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }
  }
  return apiFetch<T>(path, { method: "POST", ...options, body: formData });
}
