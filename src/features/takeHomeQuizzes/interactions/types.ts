import type { ComponentType, FC, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { PartFeedback, QuestionType, ScoringMode } from "@/api/takeHomeQuizzes";

export type { PartFeedback, ScoringMode };

/**
 * The frontend half of the interactive-question plugin seam (interaction-quiz.md §4.2). Each
 * interactive type ships one `InteractionPlugin` in its own folder and registers it in
 * `registry.ts`; the editor, the runner and every review screen read the registry rather than
 * switching on the question type.
 */

export interface ScoreResult {
  awarded: number;
  max: number;
  partial: boolean;
  parts: PartFeedback[];
}

/** Renders an embedded `data-file-id` image - the transport's own endpoint on the taking pages. */
export type RenderImage = (fileId: string, alt: string) => ReactNode;

/**
 * One interactive type. `C` is its authored config (answer included), `P` the answer-free player
 * view the server sends a student, `R` a student's response. `score` and `toPlayerView` exist only
 * for the author's "Try it" preview - the server is authoritative for both, and the golden fixtures
 * keep the two scorers equal.
 */
export interface InteractionPlugin<C, P, R> {
  type: QuestionType;
  label: string;
  icon: LucideIcon;
  blank(): C;
  /** A shuffled, answer-free view of `config` - the client twin of the server's player view. */
  toPlayerView(config: C): P;
  /**
   * Lazy-loaded (`React.lazy`) - it pulls in the TipTap editor, which the taking pages, the anonymous
   * token page included, must never download. Render it inside a `Suspense`.
   */
  Author: ComponentType<{ value: C; onChange(config: C): void; disabled: boolean; idPrefix: string }>;
  Player: FC<{
    config: P;
    value: R | null;
    onChange(response: R): void;
    disabled: boolean;
    renderImage?: RenderImage;
  }>;
  Review: FC<{
    config: C;
    response: R | null;
    parts: PartFeedback[];
    renderImage?: RenderImage;
    perspective: "staff" | "self";
  }>;
  score(config: C, response: R | null, points: number, mode: ScoringMode): ScoreResult;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the registry holds plugins of every config/response shape
export type AnyInteractionPlugin = InteractionPlugin<any, any, any>;
