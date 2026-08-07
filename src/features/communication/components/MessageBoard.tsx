import { MessageSquarePlus } from "lucide-react";
import type { ClassThreadBoardView } from "@/api/communication";
import { Button } from "@/components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { CategoryBadge } from "@/features/communication/components/CategoryBadge";

interface MessageBoardProps {
  board: ClassThreadBoardView;
  onOpenThread: (threadId: string) => void;
  /** Omit to hide the per-row quick-log action entirely (the read-only admin view). */
  onComposeFor?: (studentId: string) => void;
}

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" });

/**
 * The roster board: one row per actively enrolled student for the chosen
 * day, whether or not a note was logged - mirrors AttendanceRegisterGrid's
 * shape. Unread is signalled with a brand-500 dot plus a bolder label
 * (never amber, which is reserved for the page's one CTA - see
 * style_guide.md's 60/30/10 balance). Shared by the teacher board and the
 * admin's read-only overview; `onComposeFor` being omitted is what makes
 * the admin view read-only, not a role check inside this component.
 */
export function MessageBoard({ board, onOpenThread, onComposeFor }: MessageBoardProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Student</TableHeaderCell>
          <TableHeaderCell>Category</TableHeaderCell>
          <TableHeaderCell>Last activity</TableHeaderCell>
          <TableHeaderCell>Replies</TableHeaderCell>
          <TableHeaderCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {board.rows.map((row) => (
          <TableRow key={row.studentId}>
            <TableCell label="Student">
              <div className="flex items-center gap-2">
                {row.unread && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />
                )}
                <div>
                  <p className={row.unread ? "font-semibold text-slate-900" : "text-slate-700"}>
                    {row.studentName}
                  </p>
                  <p className="text-xs text-slate-400">{row.admissionNumber}</p>
                </div>
              </div>
            </TableCell>
            <TableCell label="Category">{row.category ? <CategoryBadge category={row.category} /> : "—"}</TableCell>
            <TableCell label="Last activity">
              {row.lastMessageAt ? TIME_FORMATTER.format(new Date(row.lastMessageAt)) : "Not logged today"}
            </TableCell>
            <TableCell label="Replies" numeric>
              {row.threadId ? row.replyCount : "—"}
            </TableCell>
            <TableCell label="">
              <div className="flex justify-end gap-2 sm:justify-start">
                {row.threadId ? (
                  <Button size="sm" variant="secondary" onClick={() => onOpenThread(row.threadId as string)}>
                    View
                  </Button>
                ) : (
                  onComposeFor && (
                    <Button size="sm" variant="ghost" onClick={() => onComposeFor(row.studentId)}>
                      <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
                      Log note
                    </Button>
                  )
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
