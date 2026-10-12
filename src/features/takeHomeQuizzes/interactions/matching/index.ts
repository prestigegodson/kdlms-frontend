import { lazy } from "react";
import { Link2 } from "lucide-react";
import { QUESTION_TYPE_LABELS } from "@/features/takeHomeQuizzes/editableQuestion";
import type { InteractionPlugin } from "../types";
import { blankMatching, toMatchingPlayerView } from "./defaults";
import { MatchingPlayer } from "./Player";
import { MatchingReview } from "./Review";
import { scoreMatching } from "./score";
import type { MatchingConfig, MatchingPlayerConfig, MatchingResponse } from "./types";

/** `MATCHING` (interaction-quiz.md §2): pair each prompt with an answer; one part per prompt. */
export const matchingPlugin: InteractionPlugin<MatchingConfig, MatchingPlayerConfig, MatchingResponse> = {
  type: "MATCHING",
  label: QUESTION_TYPE_LABELS.MATCHING,
  icon: Link2,
  blank: blankMatching,
  toPlayerView: toMatchingPlayerView,
  Author: lazy(() => import("./Author").then((module) => ({ default: module.MatchingAuthor }))),
  Player: MatchingPlayer,
  Review: MatchingReview,
  score: scoreMatching,
};
