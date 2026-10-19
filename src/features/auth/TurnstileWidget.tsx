import { useEffect, useRef, useState } from "react";
import { getAuthConfig } from "@/api/auth";
import { Alert } from "@/components/ui/Alert";

/** The slice of Cloudflare Turnstile (https://challenges.cloudflare.com/turnstile/v0/api.js) this app uses. */
interface Turnstile {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string | undefined;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileScript: Promise<Turnstile> | null = null;

/** Loads the Turnstile script once per page, however many widgets ask for it. */
function loadTurnstile(): Promise<Turnstile> {
  const existing = window.turnstile;
  if (existing) {
    return Promise.resolve(existing);
  }
  turnstileScript ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        reject(new Error("Turnstile did not initialise."));
      }
    };
    script.onerror = () => {
      turnstileScript = null;
      reject(new Error("Turnstile failed to load."));
    };
    document.head.appendChild(script);
  });
  return turnstileScript;
}

interface TurnstileWidgetProps {
  /** Called with a fresh token once the visitor passes, and with null when it expires or errors. */
  onToken: (token: string | null) => void;
  /** Called once the backend has said whether the check is on (`captchaSiteKey` non-null). */
  onAvailable: (available: boolean) => void;
}

/**
 * Cloudflare Turnstile's "verify you're human" check on a public form. Renders nothing while the
 * backend reports it off (`captchaSiteKey: null` from `GET /api/v1/public/auth/config`). A token is
 * single-use, so a page remounts this (a new `key`) after every failed submit to get a fresh one.
 */
export function TurnstileWidget({ onToken, onAvailable }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const onAvailableRef = useRef(onAvailable);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
    onAvailableRef.current = onAvailable;
  }, [onToken, onAvailable]);

  useEffect(() => {
    let cancelled = false;
    // Promise.resolve().then(...) so a synchronous throw - or an auto-mocked module returning
    // undefined in a test - degrades to "no CAPTCHA" rather than an uncaught error.
    Promise.resolve()
      .then(() => getAuthConfig())
      .then((config) => {
        if (!cancelled) {
          const key = config?.captchaSiteKey ?? null;
          setSiteKey(key);
          onAvailableRef.current(key !== null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          onAvailableRef.current(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!siteKey) {
      return;
    }
    let cancelled = false;
    let widgetId: string | undefined;
    let turnstile: Turnstile | undefined;
    loadTurnstile()
      .then((loaded) => {
        const container = containerRef.current;
        if (cancelled || !container) {
          return;
        }
        turnstile = loaded;
        widgetId = loaded.render(container, {
          sitekey: siteKey,
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
      if (turnstile && widgetId) {
        turnstile.remove(widgetId);
      }
    };
  }, [siteKey]);

  if (!siteKey) {
    return null;
  }

  if (failed) {
    return (
      <Alert variant="error">
        We couldn't load the human-verification check. Please allow challenges.cloudflare.com and
        reload the page.
      </Alert>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex min-h-[65px] w-full justify-center"
      data-testid="turnstile"
    />
  );
}
