/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Dev-only fallback for utils/host.ts's resolveSchoolSubdomain, for a developer who'd rather not use *.localhost. */
  readonly VITE_DEV_SUBDOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
