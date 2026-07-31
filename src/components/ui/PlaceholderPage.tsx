import { Construction } from "lucide-react";

/** Stand-in for routed pages not yet built; keeps the router honest about what each portal will contain. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="font-display text-3xl font-medium text-slate-900">{title}</h1>
      <div className="mt-6 flex flex-col items-center justify-center rounded-card border border-dashed border-slate-300 px-6 py-16 text-center">
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Construction className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-sm text-slate-500">This screen is not built yet.</p>
      </div>
    </div>
  );
}
