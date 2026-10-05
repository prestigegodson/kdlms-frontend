import type { ClassConversationDigest } from "@/api/classMessages";
import { conversationKey } from "@/features/classMessages/conversationKey";

const WHEN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

interface ConversationListProps {
  rows: ClassConversationDigest[];
  selectedKey: string | null;
  onSelect: (row: ClassConversationDigest) => void;
  /** The row's bold line - a learner's name for a creator, the class for a learner or guardian. */
  title: (row: ClassConversationDigest) => string;
  subtitle?: (row: ClassConversationDigest) => string | null;
}

/**
 * A list of class conversations (creators Phase C11) - a creator's class board or a learner's or
 * guardian's inbox. Written-in conversations come first, most recent activity first (the server's
 * order); an unread one carries a dot and a bold title.
 */
export function ConversationList({ rows, selectedKey, onSelect, title, subtitle }: ConversationListProps) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-card border border-slate-200 bg-white">
      {rows.map((row) => {
        const key = conversationKey(row);
        const selected = key === selectedKey;
        const secondary = subtitle?.(row);
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(row)}
              aria-current={selected ? "true" : undefined}
              className={`flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${
                selected ? "bg-brand-50" : ""
              }`}
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${row.unread ? "bg-brand-600" : "bg-transparent"}`}
                aria-label={row.unread ? "Unread" : undefined}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm ${row.unread ? "font-semibold text-slate-900" : "text-slate-800"}`}>
                    {title(row)}
                  </span>
                  {row.lastMessageAt && (
                    <span className="shrink-0 text-xs text-slate-400">{WHEN.format(new Date(row.lastMessageAt))}</span>
                  )}
                </span>
                {secondary && <span className="block truncate text-xs text-slate-500">{secondary}</span>}
                <span className="block truncate text-sm text-slate-500">
                  {row.lastMessagePreview ?? "No messages yet"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
