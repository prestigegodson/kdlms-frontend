import type { KeyboardEvent, MouseEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAnnouncer } from "../shared/announcer";
import { clampPoint, percent, pointOn, type NormalizedPoint } from "../shared/geometry";
import { LiveAnnouncer } from "../shared/LiveAnnouncer";
import { NormalizedImageStage } from "../shared/NormalizedImageStage";
import type { RenderImage } from "../types";
import type { HotspotPlayerConfig, HotspotResponse } from "./types";

interface HotspotPlayerProps {
  config: HotspotPlayerConfig;
  value: HotspotResponse | null;
  onChange(response: HotspotResponse): void;
  disabled: boolean;
  renderImage?: RenderImage;
}

const STEP = 0.02;
const BIG_STEP = 0.1;

/**
 * Drops pins on an image (interaction-quiz.md §7): tap or click where the answer is, up to
 * `maxPins`, and tap a pin to take it back. With the keyboard, the arrow keys move a cursor over the
 * image (Shift for bigger steps) and Enter or Space drops a pin there; each pin is also a button
 * that removes it. Every move is announced.
 */
export function HotspotPlayer(props: HotspotPlayerProps) {
  return (
    <LiveAnnouncer>
      <HotspotStage {...props} />
    </LiveAnnouncer>
  );
}

function HotspotStage({ config, value, onChange, disabled, renderImage }: HotspotPlayerProps) {
  const announce = useAnnouncer();
  const pins = (value?.pins ?? []).slice(0, config.maxPins);
  const [cursor, setCursor] = useState<NormalizedPoint>({ x: 0.5, y: 0.5 });
  const [focused, setFocused] = useState(false);
  const full = pins.length >= config.maxPins;

  function drop(point: NormalizedPoint) {
    if (disabled) {
      return;
    }
    if (full) {
      announce(`All ${config.maxPins} pins are placed. Remove one to move it.`);
      return;
    }
    const next = [...pins, clampPoint(point)];
    onChange({ pins: next });
    announce(`Pin ${next.length} placed.`);
  }

  function remove(index: number) {
    if (disabled) {
      return;
    }
    onChange({ pins: pins.filter((_, i) => i !== index) });
    announce(`Pin ${index + 1} removed.`);
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const point = pointOn(event.currentTarget, event.clientX, event.clientY);
    if (point) {
      drop(point);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      drop(cursor);
      return;
    }
    const step = event.shiftKey ? BIG_STEP : STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      const next = clampPoint({ x: cursor.x + move[0], y: cursor.y + move[1] });
      setCursor(next);
      announce(`Cursor ${Math.round(next.x * 100)}% across, ${Math.round(next.y * 100)}% down.`);
    }
  }

  return (
    <div className="space-y-2">
      <NormalizedImageStage
        fileId={config.imageFileId}
        aspect={config.imageAspect}
        alt="The image to place pins on"
        renderImage={renderImage}
        role="application"
        tabIndex={disabled ? -1 : 0}
        aria-label={`Image. Tap where the answer is to place a pin, or use the arrow keys to move the cursor and Enter to place a pin. ${pins.length} of ${config.maxPins} pins placed.`}
        aria-disabled={disabled || undefined}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
          disabled ? "cursor-default" : full ? "cursor-not-allowed" : "cursor-crosshair"
        }`}
      >
        {focused && !disabled && (
          <span
            aria-hidden="true"
            data-testid="hotspot-cursor"
            className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-600 bg-brand-500/20"
            style={{ left: percent(cursor.x), top: percent(cursor.y) }}
          />
        )}
        {pins.map((pin, index) => (
          <button
            key={`${index}-${pin.x}-${pin.y}`}
            type="button"
            aria-label={`Remove pin ${index + 1}`}
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              remove(index);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            style={{ left: percent(pin.x), top: percent(pin.y) }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-red-600 text-xs font-semibold text-white shadow">
              {index + 1}
            </span>
          </button>
        ))}
      </NormalizedImageStage>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span>
          {pins.length} of {config.maxPins} pin{config.maxPins === 1 ? "" : "s"} placed. Tap a pin to remove it.
        </span>
        {pins.length > 0 && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange({ pins: [] });
              announce("All pins removed.");
            }}
          >
            Remove all pins
          </Button>
        )}
      </div>
    </div>
  );
}
