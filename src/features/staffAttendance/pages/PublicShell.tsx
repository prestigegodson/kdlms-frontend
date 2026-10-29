import type { ReactNode } from "react";

/** The bare full-screen frame the public clock-in pages share - no portal chrome, no login. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
