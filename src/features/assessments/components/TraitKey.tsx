import type { TraitConfigurationView } from "@/api/traits";

interface TraitKeyProps {
  configuration: TraitConfigurationView;
}

/** The behavioural-trait rating scale key(s) - one chip row per enabled category, mirroring `GradeKey`'s shape. Renders nothing when neither category is enabled. */
export function TraitKey({ configuration }: TraitKeyProps) {
  const categories = [
    { key: "affective" as const, label: "Affective disposition", enabled: configuration.affectiveEnabled, category: configuration.affective },
    { key: "psychomotor" as const, label: "Psychomotor skills", enabled: configuration.psychomotorEnabled, category: configuration.psychomotor },
  ].filter((entry) => entry.enabled);

  if (categories.length === 0) return null;

  return (
    <div className="space-y-3">
      {categories.map((entry) => (
        <div key={entry.key}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{entry.label}</h3>
          <div className="mt-1 flex flex-wrap gap-2">
            {[...entry.category.scaleOptions]
              .sort((a, b) => a.rank - b.rank)
              .map((option) => (
                <span
                  key={option.id}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
                >
                  <strong className="text-slate-900">{option.value}</strong>
                  {option.label}
                </span>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
