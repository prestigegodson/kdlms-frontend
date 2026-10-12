import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { useAnnouncer } from "./announcer";

export interface TapToPlaceOptions {
  /** Places `itemId` on `targetId` - the same callback `DragLayer` calls on a drop. */
  onPlace(itemId: string, targetId: string): void;
  /** A human name for an item or target id, for announcements ("Copper", "Metals"). */
  describe(id: string): string;
  disabled?: boolean;
}

export interface TapToPlace {
  /** The item currently picked up, if any. */
  selected: string | null;
  cancel(): void;
  itemProps(itemId: string): {
    role: "button";
    tabIndex: number;
    "aria-pressed": boolean;
    "aria-disabled": boolean | undefined;
    onClick(): void;
    onKeyDown(event: KeyboardEvent): void;
  };
  targetProps(targetId: string): {
    role: "button";
    tabIndex: number;
    "aria-disabled": boolean | undefined;
    onClick(): void;
    onKeyDown(event: KeyboardEvent): void;
  };
}

/**
 * The non-drag way to answer an interactive question (interaction-quiz.md §7): tap (or Enter/Space)
 * an item to pick it up, then tap a target to place it. Tapping the picked item again, or pressing
 * Escape, cancels. Every step is announced. Works with touch, mouse and keyboard alike, so no answer
 * ever depends on dragging.
 */
export function useTapToPlace({
  onPlace,
  describe,
  disabled = false,
}: TapToPlaceOptions): TapToPlace {
  const announce = useAnnouncer();
  const [selected, setSelected] = useState<string | null>(null);

  const cancel = useCallback(() => {
    setSelected((current) => {
      if (current !== null) {
        announce(`${describe(current)} put back.`);
      }
      return null;
    });
  }, [announce, describe]);

  useEffect(() => {
    if (selected === null) {
      return;
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        cancel();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, cancel]);

  const pick = useCallback(
    (itemId: string) => {
      if (disabled) {
        return;
      }
      if (selected === itemId) {
        cancel();
        return;
      }
      setSelected(itemId);
      announce(
        `${describe(itemId)} picked up. Choose where to place it, or press Escape to cancel.`,
      );
    },
    [announce, cancel, describe, disabled, selected],
  );

  const place = useCallback(
    (targetId: string) => {
      if (disabled || selected === null) {
        return;
      }
      onPlace(selected, targetId);
      announce(`${describe(selected)} placed in ${describe(targetId)}.`);
      setSelected(null);
    },
    [announce, describe, disabled, onPlace, selected],
  );

  const activateOn = (action: () => void) => (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };

  return {
    selected,
    cancel,
    itemProps: (itemId) => ({
      role: "button",
      tabIndex: disabled ? -1 : 0,
      "aria-pressed": selected === itemId,
      "aria-disabled": disabled || undefined,
      onClick: () => pick(itemId),
      onKeyDown: activateOn(() => pick(itemId)),
    }),
    targetProps: (targetId) => ({
      role: "button",
      tabIndex: disabled ? -1 : 0,
      "aria-disabled": disabled || undefined,
      onClick: () => place(targetId),
      onKeyDown: activateOn(() => place(targetId)),
    }),
  };
}
