import { BookOpen, ChevronDown, ListChecks, Maximize2 } from "lucide-react";
import { type ReactNode, useId, useLayoutEffect, useRef } from "react";
import type { PublicStimulusView } from "@/api/publicTakeHomeQuiz";
import { RichContent } from "@/components/richText/RichContent";

interface StimulusPanelProps {
  stimulus: PublicStimulusView;
  /** "Passage 1" - shown when the stimulus has no title of its own. */
  name: string;
  /** "Questions 3-7". */
  rangeLabel: string;
  collapsed: boolean;
  onToggle: () => void;
  renderImage: (fileId: string, alt: string) => ReactNode;
  /**
   * `"player"` caps a passage's height below `lg` (the question stays in reach) and becomes the
   * sticky left column of the split view from `lg` up; `"review"` is a plain in-flow card.
   */
  mode?: "player" | "review";
  /** Opens the full-screen reader (below `lg` only) - omitted where there is none, e.g. the review. */
  onExpand?: () => void;
  /** Remembers the reading position across questions of other passages - keyed by stimulus id. */
  scrollPositions?: Map<string, number>;
}

/**
 * A shared reading passage or group instruction shown with its linked questions (quiz-module.md
 * Phase 20L) - collapsible everywhere with a real `aria-expanded` toggle. A `PASSAGE` reads like an
 * IELTS passage: titled, optionally lettered by paragraph, beside the question on a wide screen. An
 * `INSTRUCTION` is a compact callout above the question.
 */
export function StimulusPanel({
  stimulus,
  name,
  rangeLabel,
  collapsed,
  onToggle,
  renderImage,
  mode = "player",
  onExpand,
  scrollPositions,
}: StimulusPanelProps) {
  const bodyId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const passage = stimulus.kind === "PASSAGE";
  const Icon = passage ? BookOpen : ListChecks;
  const heading = stimulus.title?.trim() || name;
  const player = mode === "player";

  // Coming back to a passage (or re-opening it) restores where the student had read to.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || !scrollPositions || collapsed) return;
    element.scrollTop = scrollPositions.get(stimulus.id) ?? 0;
  }, [stimulus.id, scrollPositions, collapsed]);

  const bodyClasses = passage
    ? player
      ? "max-h-[50dvh] overflow-y-auto overscroll-contain lg:max-h-[calc(100dvh-7rem)]"
      : ""
    : "";

  return (
    <section
      aria-label={`${heading}, ${rangeLabel}`}
      className={`rounded-card border ${
        passage ? "border-slate-200 bg-white" : "border-brand-200 border-l-4 border-l-brand-500 bg-brand-50"
      }`}
    >
      <div className="flex items-start gap-2 p-3 sm:px-4">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex min-h-11 min-w-0 flex-1 items-start gap-2 rounded-control text-left focus-visible:outline-2"
        >
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block break-words font-display text-base font-semibold text-slate-900">{heading}</span>
            <span className="block text-xs font-medium text-slate-500">
              {rangeLabel} {"·"} {collapsed ? `Show ${passage ? "passage" : "instructions"}` : "Hide"}
            </span>
          </span>
          <ChevronDown
            className={`mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform ${collapsed ? "" : "rotate-180"}`}
            aria-hidden="true"
          />
        </button>
        {onExpand && passage && (
          <button
            type="button"
            onClick={onExpand}
            aria-label={`Read ${heading} full screen`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <div
        id={bodyId}
        ref={scrollRef}
        tabIndex={passage && player && !collapsed ? 0 : undefined}
        aria-label={passage && player ? `${heading} text` : undefined}
        onScroll={scrollPositions ? (event) => scrollPositions.set(stimulus.id, event.currentTarget.scrollTop) : undefined}
        className={collapsed ? "hidden" : `border-t border-slate-100 px-3 pb-4 pt-3 sm:px-4 ${bodyClasses}`}
      >
        <StimulusBody stimulus={stimulus} renderImage={renderImage} />
      </div>
    </section>
  );
}

/** A stimulus's text at reading size - shared with the full-screen reader. */
export function StimulusBody({
  stimulus,
  renderImage,
}: {
  stimulus: PublicStimulusView;
  renderImage: (fileId: string, alt: string) => ReactNode;
}) {
  return (
    <RichContent
      html={stimulus.body}
      renderImage={renderImage}
      paragraphLabels={stimulus.kind === "PASSAGE" && stimulus.paragraphLabels}
      className="space-y-3 break-words text-base leading-relaxed text-slate-800"
    />
  );
}
