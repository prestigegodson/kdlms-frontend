/** The brand-filled "new" pill - the same treatment as PortalShell's nav badge, so "new" reads the same everywhere. */
export function ResourceNewPill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-2 text-xs font-medium text-white">
      {label}
    </span>
  );
}
