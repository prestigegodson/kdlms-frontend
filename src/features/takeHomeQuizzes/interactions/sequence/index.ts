import { lazy } from "react";
import { ListOrdered } from "lucide-react";
import { QUESTION_TYPE_LABELS } from "@/features/takeHomeQuizzes/editableQuestion";
import type { InteractionPlugin } from "../types";
import { blankSequence, toSequencePlayerView } from "./defaults";
import { SequencePlayer } from "./Player";
import { SequenceReview } from "./Review";
import { scoreSequence } from "./score";
import type { SequenceConfig, SequencePlayerConfig, SequenceResponse } from "./types";

/** `SEQUENCE` (interaction-quiz.md §2): order the items; one part per adjacent pair. */
export const sequencePlugin: InteractionPlugin<SequenceConfig, SequencePlayerConfig, SequenceResponse> = {
  type: "SEQUENCE",
  label: QUESTION_TYPE_LABELS.SEQUENCE,
  icon: ListOrdered,
  blank: blankSequence,
  toPlayerView: toSequencePlayerView,
  Author: lazy(() => import("./Author").then((module) => ({ default: module.SequenceAuthor }))),
  Player: SequencePlayer,
  Review: SequenceReview,
  score: scoreSequence,
};
