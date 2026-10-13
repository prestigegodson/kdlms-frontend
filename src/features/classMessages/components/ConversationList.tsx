import type { ClassConversationDigest } from "@/api/classMessages";
import { Avatar } from "@/components/ui/Avatar";
import { listTime } from "@/features/classMessages/components/chatTimeline";
import { conversationKey } from "@/features/classMessages/conversationKey";
import { initialsOfFullName } from "@/utils/initials";

interface ConversationListProps {
  rows: ClassConversationDigest[];
  selectedKey: string | null;
  onSelect: (row: ClassConversationDigest) => void;
  /** The row's bold line - a learner's name for a creator, the class for a learner or guardian. */
  title: (row: ClassConversationDigest) => string;
  subtitle?: (row: ClassConversationDigest) => string | null;
  /** Whether the row's last message is the viewer's own - its preview then reads "You: …". */
  lastIsOwn?: (row: ClassConversationDigest) => boolean;
}

/**
 * A list of class conversations (creators Phase C11) - a creator's class board or a learner's or
 * guardian's inbox - as chat rows: an avatar, the name with the last activity's time, and a one-line
 * preview. An unread one carries a dot and a bold name; the open one is tinted with a brand edge.
 */
export function ConversationList({ rows, selectedKey, onSelect, title, subtitle, lastIsOwn }: ConversationListProps) {
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row) => {
        const key = conversationKey(row);
        const selected = key === selectedKey;
        const name = title(row);
        const secondary = subtitle?.(row);
        const preview = row.lastMessagePreview
          ? `${lastIsOwn?.(row) ? "You: " : ""}${row.lastMessagePreview}`
          : "No messages yet";
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(row)}
              aria-current={selected ? "true" : undefined}
              className={`relative flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                selected ? "bg-brand-50" : "hover:bg-slate-50"
              }`}
            >
              {selected && <span className="absolute inset-y-0 left-0 w-1 bg-brand-500" aria-hidden="true" />}
              <span className="relative">
                <Avatar initials={initialsOfFullName(name)} url={null} />
                {row.unread && (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-brand-500 ring-2 ring-white"
                    aria-label="Unread"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm ${row.unread ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}>
                    {name}
                  </span>
                  {row.lastMessageAt && (
                    <span className={`shrink-0 text-xs ${row.unread ? "font-medium text-brand-600" : "text-slate-400"}`}>
                      {listTime(row.lastMessageAt)}
                    </span>
                  )}
                </span>
                {secondary && <span className="block truncate text-xs text-slate-500">{secondary}</span>}
                <span
                  className={`mt-0.5 block truncate text-sm ${
                    row.unread ? "text-slate-700" : row.lastMessagePreview ? "text-slate-500" : "italic text-slate-400"
                  }`}
                >
                  {preview}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
