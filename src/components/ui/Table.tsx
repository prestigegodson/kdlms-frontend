import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * A register-style table: hairline row rules (no vertical rules), a calm
 * row hover, and tabular figures on numeric columns (see the `numeric`
 * prop on TableHeaderCell/TableCell). Below the `md` breakpoint it
 * collapses into stacked record cards, driven by each TableCell's `label`
 * prop - see the `.responsive-table` rules in index.css.
 */
export function Table({ className = "", ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={`responsive-table min-w-full ${className}`} {...props} />
    </div>
  );
}

export function TableHead({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`border-b border-slate-200 bg-slate-50 ${className}`} {...props} />;
}

export function TableBody({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-slate-100 bg-white ${className}`} {...props} />;
}

export function TableRow({ className = "", ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`transition-colors hover:bg-slate-50 ${className}`} {...props} />;
}

interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Right-aligns the header and switches its cell to tabular figures - use for score/count/amount columns. */
  numeric?: boolean;
}

export function TableHeaderCell({ numeric = false, className = "", ...props }: TableHeaderCellProps) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        numeric ? "text-right" : "text-left"
      } ${className}`}
      {...props}
    />
  );
}

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  /** Row label shown before this cell's value once the table collapses to stacked cards below `md` (see index.css) - pass the matching column header's text. */
  label?: string;
  numeric?: boolean;
}

export function TableCell({ label, numeric = false, className = "", ...props }: TableCellProps) {
  return (
    <td
      data-label={label}
      className={`px-4 py-3 text-sm text-slate-700 ${numeric ? "text-right tabular-nums" : ""} ${className}`}
      {...props}
    />
  );
}
