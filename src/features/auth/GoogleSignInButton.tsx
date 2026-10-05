import { type ReactNode, useEffect, useRef, useState } from "react";
import { getAuthConfig } from "@/api/auth";

/** The slice of Google Identity Services (https://accounts.google.com/gsi/client) this app uses. */
interface GoogleAccountsId {
  initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
  renderButton: (
    parent: HTMLElement,
    options: { theme?: string; size?: string; text?: string; shape?: string; width?: number; logo_alignment?: string },
  ) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";

let gsiScript: Promise<GoogleAccountsId> | null = null;

/** Loads the Google Identity Services script once per page, however many buttons ask for it. */
function loadGoogleIdentityServices(): Promise<GoogleAccountsId> {
  const existing = window.google?.accounts?.id;
  if (existing) {
    return Promise.resolve(existing);
  }
  gsiScript ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) {
        resolve(id);
      } else {
        reject(new Error("Google Identity Services did not initialise."));
      }
    };
    script.onerror = () => {
      gsiScript = null;
      reject(new Error("Google Identity Services failed to load."));
    };
    document.head.appendChild(script);
  });
  return gsiScript;
}

interface GoogleSignInButtonProps {
  /** Only changes the button's own wording - "Sign in with Google" or "Sign up with Google". */
  mode: "signin" | "signup";
  /** Called with the Google ID token once the user picks an account; the page exchanges it for a session. */
  onCredential: (idToken: string) => void;
  /** Rendered after the button (e.g. an "or" divider) - only when the button itself is shown. */
  after?: ReactNode;
}

/**
 * "Sign in with Google" (creators.md §4). Renders nothing at all while the backend reports Google
 * sign-in off (`googleClientId: null` from `GET /api/v1/public/auth/config`), or if Google's
 * script can't load - the password form stays the way in either way.
 */
export function GoogleSignInButton({ mode, onCredential, after }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [clientId, setClientId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;
    // Promise.resolve().then(...) so a synchronous throw - or an auto-mocked module returning
    // undefined in a test - degrades to "no Google button" rather than an uncaught error.
    Promise.resolve()
      .then(() => getAuthConfig())
      .then((config) => {
        if (!cancelled) {
          setClientId(config?.googleClientId ?? null);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId) {
      return;
    }
    let cancelled = false;
    loadGoogleIdentityServices()
      .then((gsi) => {
        const container = containerRef.current;
        if (cancelled || !container) {
          return;
        }
        gsi.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) {
              callbackRef.current(response.credential);
            }
          },
        });
        container.replaceChildren();
        gsi.renderButton(container, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: mode === "signup" ? "signup_with" : "signin_with",
          logo_alignment: "center",
          width: Math.min(container.clientWidth || 320, 400),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, mode]);

  if (!clientId || failed) {
    return null;
  }

  return (
    <>
      <div ref={containerRef} className="flex min-h-10 w-full justify-center" data-testid="google-signin" />
      {after}
    </>
  );
}

/** The "or" rule between the Google button and a password form. */
export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
      <span className="h-px flex-1 bg-slate-200" />
      or
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
