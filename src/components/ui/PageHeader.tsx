import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * The title + description + primary-actions row repeated at the top of
 * every list/detail page - replaces each page's own `h1` plus `flex
 * items-center justify-between` block so page headers can't drift in size
 * or spacing across pages. Stacks below `sm` so a long title or multiple
 * actions never squeeze each other.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-medium text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
