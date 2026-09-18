import { ChevronDown } from "lucide-react";
import type { ComponentType, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  icon?: ComponentType<{ className?: string }>;
  /** "danger" tints the item red - for destructive actions (e.g. Delete). */
  variant?: "default" | "danger";
  /** Draws a hairline rule above this item, grouping it apart from the one before it. */
  separated?: boolean;
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Trigger's visible text. Defaults to "Actions". */
  label?: string;
  /**
   * Accessible name for the trigger, for when several menus on one page would
   * otherwise share the identical name "Actions" (e.g. one per table row).
   * Should contain `label` as a substring (WCAG 2.5.3 label-in-name).
   */
  ariaLabel?: string;
}

/**
 * A row-actions dropdown, collapsing what would otherwise be several inline
 * buttons in a table cell (see LearningResourcesPage for the first adopter).
 * Combines two existing precedents rather than inventing a third: the
 * trigger/panel/menuitem semantics and Escape-closes-and-returns-focus
 * behavior mirror layouts/UserMenu.tsx, while the portal + viewport-aware
 * positioning mirrors components/ui/DateInput.tsx.
 *
 * The portal is load-bearing, not cosmetic: Table.tsx wraps every table in
 * an `overflow-x-auto` div, which would clip an absolutely-positioned panel
 * and spawn a scrollbar. Portalling to `document.body` and positioning with
 * `fixed` avoids that entirely, at the cost of needing to track the
 * trigger's position by hand (computePosition below).
 *
 * Unlike UserMenu (two items, no arrow-key support needed), this supports
 * roving focus - the WAI-ARIA menu pattern expects it once a component opts
 * into role="menu"/role="menuitem", and a row here can carry up to six items.
 *
 * Selecting an item closes the menu *before* calling `onSelect` - order
 * matters, since Modal captures `document.activeElement` when it opens and
 * restores focus to it on close. Closing first means a menu item that opens
 * a modal returns focus to this trigger, not to a menu item that no longer
 * exists in the DOM.
 */
export function ActionMenu({ items, label = "Actions", ariaLabel }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function firstEnabledIndex(): number | null {
    const index = items.findIndex((item) => !item.disabled);
    return index === -1 ? null : index;
  }

  function lastEnabledIndex(): number | null {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (!items[index].disabled) return index;
    }
    return null;
  }

  function move(current: number | null, direction: 1 | -1): number | null {
    const count = items.length;
    if (count === 0) return null;
    let index = current === null ? (direction === 1 ? 0 : count - 1) : (current + direction + count) % count;
    for (let step = 0; step < count; step += 1) {
      if (!items[index].disabled) return index;
      index = (index + direction + count) % count;
    }
    return current;
  }

  function openMenu(startIndex: number | null) {
    setPosition(null);
    setOpen(true);
    setActiveIndex(startIndex);
  }

  function close() {
    setOpen(false);
    setActiveIndex(null);
    triggerRef.current?.focus();
  }

  function choose(item: ActionMenuItem) {
    if (item.disabled) return;
    close();
    item.onSelect();
  }

  function handleTriggerClick() {
    if (open) {
      close();
    } else {
      openMenu(null);
    }
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(firstEnabledIndex());
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(lastEnabledIndex());
    }
  }

  // Portal events still bubble through the *React* tree (not the DOM tree),
  // so stopPropagation here keeps an ActionMenu opened from inside a Modal
  // from also triggering the Modal's own Escape-closes handling.
  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((current) => move(current, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((current) => move(current, -1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(firstEnabledIndex());
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(lastEnabledIndex());
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  }

  function computePosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelEl = panelRef.current;
    const panelHeight = panelEl?.offsetHeight ?? 0;
    const panelWidth = panelEl?.offsetWidth ?? 224;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = panelHeight > 0 && spaceBelow < panelHeight + 8 && rect.top > panelHeight + 8;
    const top = openUp ? rect.top - panelHeight - 4 : rect.bottom + 4;
    const preferredLeft = rect.right - panelWidth;
    const maxLeft = window.innerWidth - panelWidth - 8;
    const left = Math.min(Math.max(preferredLeft, 8), Math.max(maxLeft, 8));
    setPosition({ top, left });
  }

  // Two-pass placement, same as DateInput: the panel mounts off-screen
  // (visibility: hidden below) so its real height/width are measurable,
  // then this effect - running before paint - moves it to its final,
  // possibly-flipped position.
  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function reposition() {
      computePosition();
    }
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Focuses the active item, or the panel itself when opened by click with
  // nothing yet active - the same "panel takes DOM focus so its own
  // onKeyDown sees Escape" trick UserMenu uses.
  useEffect(() => {
    if (!open) return;
    if (activeIndex === null) {
      panelRef.current?.focus();
    } else {
      itemRefs.current[activeIndex]?.focus();
    }
  }, [open, activeIndex]);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex items-center gap-1.5 rounded-control border border-slate-300 bg-white px-3 py-1.5
          text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 mobile:min-h-11"
      >
        {label}
        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={ariaLabel ?? label}
            tabIndex={-1}
            onKeyDown={handlePanelKeyDown}
            className="fixed z-[60] w-56 max-w-[calc(100vw-1rem)] rounded-panel border border-slate-200 bg-white
              py-1 shadow-lg outline-none"
            style={{
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              visibility: position ? "visible" : "hidden",
            }}
          >
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={item.disabled}
                  onClick={() => choose(item)}
                  className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm mobile:min-h-11
                    disabled:pointer-events-none disabled:opacity-50
                    ${item.separated ? "mt-1 border-t border-slate-100 pt-2" : ""}
                    ${item.variant === "danger" ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-100"}`}
                >
                  {Icon && (
                    <Icon
                      className={`h-4 w-4 shrink-0 ${item.variant === "danger" ? "text-red-500" : "text-slate-400"}`}
                    />
                  )}
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
