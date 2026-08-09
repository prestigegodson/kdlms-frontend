import { ChevronRight } from "lucide-react";
import type { HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { useNavigate } from "react-router";

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

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /**
   * Makes the whole row a tap target - navigates here via react-router on
   * click or Enter/Space. Combine with a plain `onClick` for a
   * non-navigating action (both fire, `onClick` first); either one alone is
   * enough to render a trailing `ChevronRight` and `cursor-pointer` per
   * CLAUDE.md's "every clickable thing shows a pointer" rule. Opt-in - a
   * bare `<TableRow>` (the common case today) is unaffected, ready for a
   * later phase to wire real routes in (mobile-plan.md Phases B-E).
   */
  to?: string;
}

/**
 * Shared rendering for both variants below - kept as a plain function
 * (not a hook) so `NavigableTableRow` can be the *only* place that calls
 * `useNavigate`, letting a `to`-less `<TableRow>` (still the overwhelming
 * majority of call sites) render with no Router in the tree at all, exactly
 * like it did before this prop existed. `useNavigate` can't be called
 * conditionally inside one component without breaking the rules of hooks,
 * so the condition lives in *which component renders* instead.
 */
function renderRow(
  interactive: boolean,
  handleClick: ((event: ReactMouseEvent<HTMLTableRowElement>) => void) | undefined,
  className: string,
  children: TableRowProps["children"],
  props: Omit<TableRowProps, "to" | "onClick" | "className" | "children">,
) {
  function handleKeyDown(event: ReactKeyboardEvent<HTMLTableRowElement>) {
    if (!interactive || !handleClick || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }
    event.preventDefault();
    handleClick(event as unknown as ReactMouseEvent<HTMLTableRowElement>);
  }

  return (
    <tr
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={`transition-colors hover:bg-slate-50 ${interactive ? "cursor-pointer" : ""} ${className}`}
      {...props}
    >
      {children}
      {interactive && (
        <td className="w-8 px-2 text-right text-slate-400" aria-hidden="true">
          <ChevronRight className="ml-auto h-4 w-4" aria-hidden="true" />
        </td>
      )}
    </tr>
  );
}

function NavigableTableRow({
  to,
  onClick,
  className = "",
  children,
  ...props
}: TableRowProps & { to: string }) {
  const navigate = useNavigate();

  function handleClick(event: ReactMouseEvent<HTMLTableRowElement>) {
    onClick?.(event);
    navigate(to);
  }

  return renderRow(true, handleClick, className, children, props);
}

export function TableRow({ to, onClick, className = "", children, ...props }: TableRowProps) {
  if (to !== undefined) {
    return (
      <NavigableTableRow to={to} onClick={onClick} className={className} {...props}>
        {children}
      </NavigableTableRow>
    );
  }
  return renderRow(onClick !== undefined, onClick, className, children, props);
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
