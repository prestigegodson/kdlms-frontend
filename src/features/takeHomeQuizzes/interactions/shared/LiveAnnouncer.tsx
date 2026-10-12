import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnnouncerContext, type Announce } from "./announcer";

/** Appended on every other message so repeating the same move is announced again. */
const ZERO_WIDTH_SPACE = "​";

/**
 * One polite, visually hidden `aria-live` region for an interactive question - every move, by
 * drag, tap or keyboard, is read out through it ("Copper placed in Metals"). `DragLayer` keeps
 * dnd-kit's own live region silent, so a screen reader hears one voice. Read it with `useAnnouncer`.
 */
export function LiveAnnouncer({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const toggle = useRef(false);

  const announce = useCallback<Announce>((next) => {
    toggle.current = !toggle.current;
    setMessage(toggle.current ? next : next + ZERO_WIDTH_SPACE);
  }, []);

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="live-announcer"
      >
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}
