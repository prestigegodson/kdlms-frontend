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
  requestHeaders.set("Accept", "application/json");
  if (body && !requestHeaders.has("Content-Type")) {
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

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
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

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
