import { MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

interface ChatLayoutProps {
  list: ReactNode;
  /** The open conversation, a skeleton while it loads, or `null` when none is chosen. */
  conversation: ReactNode | null;
  /** Whether a conversation is chosen - on small screens it then replaces the list. */
  open: boolean;
  /** The prompt in the right pane while nothing is chosen (large screens only). */
  placeholder: string;
}

/**
 * The two-pane messages card: conversations on the left, the open one on the right, each scrolling
 * on its own inside a card that fills the viewport under the shell's header. Below `lg` it behaves
 * like a phone chat app - the list, or the open conversation, never both.
 */
export function ChatLayout({ list, conversation, open, placeholder }: ChatLayoutProps) {
  return (
    <div className="flex h-[calc(100dvh-7rem-var(--spacing-tabbar-safe))] min-h-[28rem] overflow-hidden rounded-card border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-7rem)]">
      <div className={`w-full min-w-0 border-slate-200 lg:block lg:w-[22rem] lg:shrink-0 lg:border-r ${open ? "hidden" : ""}`}>
        {list}
      </div>
      <div className={`min-w-0 flex-1 lg:block ${open ? "" : "hidden"}`}>
        {conversation ?? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50/60 p-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
              <MessageSquare className="h-7 w-7 text-brand-500" aria-hidden="true" />
            </span>
            <p className="max-w-xs text-sm text-slate-500">{placeholder}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Placeholder rows while a conversation list loads. */
export function ListSkeleton() {
  return (
    <div className="space-y-1 p-2" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex items-center gap-3 px-2 py-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder bubbles while a conversation loads. */
export function ConversationSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-5" aria-hidden="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-12 w-2/3 rounded-2xl" />
      <Skeleton className="ml-auto h-16 w-1/2 rounded-2xl" />
      <Skeleton className="h-10 w-1/2 rounded-2xl" />
    </div>
  );
}
