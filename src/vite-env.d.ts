/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Dev-only fallback for utils/host.ts's resolveSchoolSubdomain, for a developer who'd rather not use *.localhost. */
  readonly VITE_DEV_SUBDOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Not in lib.dom - Chromium's PWA install prompt. Captured once at module
 * scope in main.tsx (see src/utils/installPrompt.ts) since it can fire
 * before React mounts.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
  appinstalled: Event;
}
