import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

/** One selectable row - `secondaryLabel` is whatever the caller's optional third column shows (current class, registration state, ...). */
export interface StudentPickerRow {
  id: string;
  name: string;
  admissionNumber: string;
  secondaryLabel?: string;
}

interface StudentPickerProps {
  rows: StudentPickerRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  /** Omit to skip the third column entirely - PromotionPage's promote flow has nothing to show there. */
  secondaryColumnLabel?: string;
}

/**
 * A checkable roster table with a header "select all" toggle - shared by
 * PromotionPage's promote/place flows and ClassDetailPage's selective-subject
 * registration screen. Row shape is generic (id/name/admissionNumber) rather
 * than tied to `StudentView`, since the registration screen's rows come from
 * `SubjectRegistrationView.students` instead.
 */
export function StudentPicker({
  rows,
  selected,
  onToggle,
  onSelectAll,
  onSelectNone,
  secondaryColumnLabel,
}: StudentPickerProps) {
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  return (
    <Card className="p-0">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>
              <Checkbox
                checked={allSelected}
                onChange={() => (allSelected ? onSelectNone() : onSelectAll())}
                aria-label="Select all"
              />
            </TableHeaderCell>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Admission no.</TableHeaderCell>
            {secondaryColumnLabel && <TableHeaderCell>{secondaryColumnLabel}</TableHeaderCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell label="Select">
                <Checkbox
                  checked={selected.has(row.id)}
                  onChange={() => onToggle(row.id)}
                  aria-label={`Select ${row.name}`}
                />
              </TableCell>
              <TableCell label="Name" className="font-medium text-slate-900">
                {row.name}
              </TableCell>
              <TableCell label="Admission no.">{row.admissionNumber}</TableCell>
              {secondaryColumnLabel && (
                <TableCell label={secondaryColumnLabel}>{row.secondaryLabel ?? "—"}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
