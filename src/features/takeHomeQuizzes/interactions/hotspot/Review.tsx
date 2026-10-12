import { Check, X } from "lucide-react";
import { RichContent } from "@/components/richText/RichContent";
import { contains, percent } from "../shared/geometry";
import { NormalizedImageStage } from "../shared/NormalizedImageStage";
import { RegionBadge } from "../shared/RegionBadge";
import { ShapeOverlay } from "../shared/ShapeOverlay";
import type { PartFeedback, RenderImage } from "../types";
import { normalizeHotspotPins } from "./score";
import type { HotspotConfig, HotspotResponse } from "./types";

interface HotspotReviewProps {
  config: HotspotConfig;
  response: HotspotResponse | null;
  parts: PartFeedback[];
  renderImage?: RenderImage;
  perspective: "staff" | "self";
}

/**
 * The image with every target outlined - green when a pin found it, amber and dashed when missed -
 * and the student's pins, red when they hit no target. Below, each target marked from the frozen
 * feedback, and each stray pin with the region it landed on when that region has a name. The strays
 * are worked out here for display only; the score was frozen at submit.
 */
export function HotspotReview({ config, response, parts, renderImage, perspective }: HotspotReviewProps) {
  const byTarget = new Map(parts.map((part) => [part.partId, part]));
  const targets = config.regions.filter((region) => region.target);
  const pins = normalizeHotspotPins(config, response);
  const onTarget = (pin: (typeof pins)[number]) =>
    targets.some((target) => contains(target.shape, pin, config.imageAspect));
  const strays = pins.map((pin, index) => ({ pin, index })).filter(({ pin }) => !onTarget(pin));
  const who = perspective === "self" ? "Your" : "The student's";

  return (
    <div className="space-y-3 text-sm">
      <NormalizedImageStage
        fileId={config.imageFileId}
        aspect={config.imageAspect}
        alt="The image with its targets"
        renderImage={renderImage}
      >
        <ShapeOverlay
          aspect={config.imageAspect}
          shapes={config.regions.map((region) => ({
            key: region.id,
            shape: region.shape,
            tone: !region.target ? "neutral" : byTarget.get(region.id)?.correct ? "correct" : "missed",
            dashed: !region.target || !byTarget.get(region.id)?.correct,
          }))}
        />
        {targets.map((target, index) => (
          <RegionBadge key={target.id} shape={target.shape} aspect={config.imageAspect} number={index + 1} />
        ))}
        {pins.map((pin, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow ${
              onTarget(pin) ? "bg-green-600" : "bg-red-600"
            }`}
            style={{ left: percent(pin.x), top: percent(pin.y) }}
          >
            {index + 1}
          </span>
        ))}
      </NormalizedImageStage>
      <ul className="space-y-1">
        {targets.map((target, index) => {
          const part = byTarget.get(target.id);
          const correct = part?.correct === true;
          return (
            <li
              key={target.id}
              className={`flex items-start gap-2 rounded-control border px-3 py-1.5 ${
                correct ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
              }`}
            >
              {correct ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="Correct" />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Wrong" />
              )}
              <span className="font-semibold text-slate-700">Target {index + 1}</span>
              {target.label && <RichContent html={target.label} renderImage={renderImage} className="min-w-0" />}
              <span className="text-slate-500">
                {correct ? `found by pin ${Number(part?.givenRef) + 1}` : "missed"}
              </span>
            </li>
          );
        })}
        {strays.map(({ pin, index }) => {
          const landedOn = config.regions.find(
            (region) => !region.target && region.label && contains(region.shape, pin, config.imageAspect),
          );
          return (
            <li key={`stray-${index}`} className="flex items-start gap-2 rounded-control border border-red-300 bg-red-50 px-3 py-1.5">
              <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Wrong" />
              <span className="text-slate-700">
                {who} pin {index + 1} is not on a target{landedOn ? " - it's on" : "."}
              </span>
              {landedOn?.label && <RichContent html={landedOn.label} renderImage={renderImage} className="min-w-0" />}
            </li>
          );
        })}
      </ul>
      {strays.length > 0 && (
        <p className="text-xs text-slate-500">Each pin that misses every target cancels one found target.</p>
      )}
    </div>
  );
}
