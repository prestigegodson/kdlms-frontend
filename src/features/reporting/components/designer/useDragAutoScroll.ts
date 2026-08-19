import { useEffect } from "react";

/** Pixels from the top/bottom viewport edge that trigger scrolling - the top threshold clears `PortalShell`'s 64px sticky header. */
const EDGE_PX = 96;
/** Fastest scroll speed, reached right at the edge; ramps down to 0 at `EDGE_PX` away. */
const MAX_SPEED_PX = 18;
/** No `dragover` seen for this long -> assume the drag ended without a `dragend`/`drop` reaching us, and stop. */
const WATCHDOG_MS = 200;

/**
 * Scrolls the page while a native HTML5 drag sits near the top or bottom
 * viewport edge - `TemplateDesignerPage`'s canvas can be taller than the
 * viewport (see the designer's module comment on the scroll model), and
 * native drag-and-drop has no built-in edge-autoscroll of its own.
 * <p>
 * Listens on `document` rather than any one drop target, since `dragover`
 * bubbles there regardless of what's directly under the pointer - including
 * the gaps between `DropZone` strips. Deliberately never calls
 * `preventDefault()` on `dragover`, which would turn every point on the
 * page into a drop target.
 */
export function useDragAutoScroll(): void {
  useEffect(() => {
    let pointerY: number | null = null;
    let rafId: number | null = null;
    let lastDragOverAt = 0;

    function tick() {
      rafId = null;
      if (pointerY === null) return;
      if (performance.now() - lastDragOverAt > WATCHDOG_MS) {
        pointerY = null;
        return;
      }

      const viewportHeight = window.innerHeight;
      let speed = 0;
      if (pointerY < EDGE_PX) {
        speed = -MAX_SPEED_PX * (1 - pointerY / EDGE_PX);
      } else if (pointerY > viewportHeight - EDGE_PX) {
        speed = MAX_SPEED_PX * (1 - (viewportHeight - pointerY) / EDGE_PX);
      }

      if (speed !== 0) {
        window.scrollBy(0, speed);
        rafId = requestAnimationFrame(tick);
      }
    }

    function handleDragOver(event: DragEvent) {
      pointerY = event.clientY;
      lastDragOverAt = performance.now();
      if (rafId === null) rafId = requestAnimationFrame(tick);
    }

    function stop() {
      pointerY = null;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("dragend", stop);
    document.addEventListener("drop", stop);
    return () => {
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("dragend", stop);
      document.removeEventListener("drop", stop);
      stop();
    };
  }, []);
}
