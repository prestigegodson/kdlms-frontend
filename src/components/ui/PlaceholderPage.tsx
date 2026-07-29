/** Stand-in for routed pages not yet built; keeps the router honest about what each portal will contain. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">This screen is not built yet.</p>
    </div>
  );
}
