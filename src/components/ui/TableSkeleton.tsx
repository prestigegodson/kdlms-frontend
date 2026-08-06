import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/Table";

interface TableSkeletonProps {
  /** Number of placeholder rows. */
  rows?: number;
  /** Number of placeholder columns - should match the real table's column count. */
  columns?: number;
}

/**
 * A placeholder table shaped like the real one about to load - use in place
 * of a bare `<Spinner /> Loading…` row for any list page backed by `Table`.
 * Deliberately skips `TableHead` (the real headers render immediately;
 * only row content is unknown yet).
 */
export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <Table>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <TableCell key={columnIndex}>
                <Skeleton className="h-4 w-full max-w-40" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
