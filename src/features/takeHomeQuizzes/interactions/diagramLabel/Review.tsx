import { Check, X } from "lucide-react";
import { RichContent } from "@/components/richText/RichContent";
import { NormalizedImageStage } from "../shared/NormalizedImageStage";
import { RegionBadge } from "../shared/RegionBadge";
import { ShapeOverlay } from "../shared/ShapeOverlay";
import type { PartFeedback, RenderImage } from "../types";
import type { DiagramLabelConfig, DiagramLabelResponse } from "./types";

interface DiagramLabelReviewProps {
  config: DiagramLabelConfig;
  response: DiagramLabelResponse | null;
  parts: PartFeedback[];
  renderImage?: RenderImage;
  perspective: "staff" | "self";
}

/**
 * The diagram with each zone marked from the frozen feedback, then every zone with the label given
 * and - for a wrong or empty one - the label that was right.
 */
export function DiagramLabelReview({ config, parts, renderImage, perspective }: DiagramLabelReviewProps) {
  const labels = new Map(config.labels.map((label) => [label.id, label.html]));
  const byZone = new Map(parts.map((part) => [part.partId, part]));
  const givenLabel = perspective === "self" ? "You put" : "Student put";

  return (
    <div className="space-y-3 text-sm">
      <NormalizedImageStage
        fileId={config.imageFileId}
        aspect={config.imageAspect}
        alt="The labelled diagram"
        renderImage={renderImage}
      >
        <ShapeOverlay
          aspect={config.imageAspect}
          shapes={config.zones.map((zone) => ({
            key: zone.id,
            shape: zone.shape,
            tone: byZone.get(zone.id)?.correct ? "correct" : "wrong",
          }))}
        />
        {config.zones.map((zone, index) => (
          <RegionBadge key={zone.id} shape={zone.shape} aspect={config.imageAspect} number={index + 1} />
        ))}
      </NormalizedImageStage>
      <ol className="space-y-1">
        {config.zones.map((zone, index) => {
          const part = byZone.get(zone.id);
          const correct = part?.correct === true;
          const given = part?.givenRef ? labels.get(part.givenRef) : undefined;
          const expected = zone.acceptedLabelIds.map((id) => labels.get(id)).filter((html) => html !== undefined);
          return (
            <li
              key={zone.id}
              className={`grid gap-1 rounded-control border px-3 py-1.5 sm:grid-cols-[auto_auto_1fr_1fr] sm:items-start sm:gap-3 ${
                correct ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
              }`}
            >
              {correct ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="Correct" />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Wrong" />
              )}
              <span className="font-semibold text-slate-700">Zone {index + 1}</span>
              <div className="min-w-0">
                {given ? (
                  <>
                    <span className="text-slate-500">{givenLabel}: </span>
                    <RichContent html={given} renderImage={renderImage} className="inline-block" />
                  </>
                ) : (
                  <span className="text-slate-400">Not labelled</span>
                )}
              </div>
              {!correct && expected.length > 0 && (
                <div className="min-w-0">
                  <span className="text-slate-500">Correct: </span>
                  {expected.map((html, i) => (
                    <span key={i}>
                      {i > 0 && <span className="text-slate-500"> or </span>}
                      <RichContent html={html} renderImage={renderImage} className="inline-block" />
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
