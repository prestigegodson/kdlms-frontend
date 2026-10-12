import { ImageOff } from "lucide-react";
import type { HTMLAttributes, ReactNode, Ref } from "react";
import type { RenderImage } from "../types";

interface NormalizedImageStageProps extends HTMLAttributes<HTMLDivElement> {
  fileId: string | null;
  /** The image's natural width over its height - reserves its space before it loads. */
  aspect: number;
  alt: string;
  renderImage?: RenderImage;
  ref?: Ref<HTMLDivElement>;
  /** The overlay - positioned with percentages, which are the image's own normalized coordinates. */
  children?: ReactNode;
}

/**
 * An image drawn at the width available with its own aspect ratio, and an overlay on top whose
 * percentages are the image's normalized 0..1 coordinates (interaction-quiz.md §7). The image comes
 * from the page's own `renderImage` - the token, portal, learner or staff transport - and is
 * stretched to the stage by a direct-child selector, so each transport's own `max-h-*` sizing never
 * applies here and nothing inside the overlay is touched.
 */
export function NormalizedImageStage({
  fileId,
  aspect,
  alt,
  renderImage,
  ref,
  className = "",
  style,
  children,
  onDragStart,
  ...props
}: NormalizedImageStageProps) {
  return (
    <div
      ref={ref}
      className={`relative w-full max-w-3xl select-none overflow-hidden rounded-control border border-slate-200 bg-slate-50 ${className}`}
      style={{ aspectRatio: aspect > 0 ? aspect : 1, ...style }}
      onDragStart={(event) => {
        // A browser drags an <img> natively, which cancels the stage's own pointer drag.
        event.preventDefault();
        onDragStart?.(event);
      }}
      {...props}
    >
      <div className="absolute inset-0 [&>img]:pointer-events-none [&>img]:[-webkit-user-drag:none] [&>img]:absolute [&>img]:inset-0 [&>img]:m-0 [&>img]:h-full [&>img]:max-h-none [&>img]:w-full [&>img]:max-w-none [&>img]:rounded-none [&>img]:border-0 [&>img]:object-fill">
        {fileId && renderImage ? (
          renderImage(fileId, alt)
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <ImageOff className="h-8 w-8" aria-hidden="true" />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
