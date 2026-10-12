import { lazy } from "react";
import { LayoutGrid } from "lucide-react";
import { QUESTION_TYPE_LABELS } from "@/features/takeHomeQuizzes/editableQuestion";
import type { InteractionPlugin } from "../types";
import { CategorizePlayer } from "./Player";
import { CategorizeReview } from "./Review";
import { blankCategorize, toCategorizePlayerView } from "./defaults";
import { scoreCategorize } from "./score";
import type { CategorizeConfig, CategorizePlayerConfig, CategorizeResponse } from "./types";

/** `CATEGORIZE` (interaction-quiz.md §2): sort items into groups; one part per item. */
export const categorizePlugin: InteractionPlugin<CategorizeConfig, CategorizePlayerConfig, CategorizeResponse> = {
  type: "CATEGORIZE",
  label: QUESTION_TYPE_LABELS.CATEGORIZE,
  icon: LayoutGrid,
  blank: blankCategorize,
  toPlayerView: toCategorizePlayerView,
  Author: lazy(() => import("./Author").then((module) => ({ default: module.CategorizeAuthor }))),
  Player: CategorizePlayer,
  Review: CategorizeReview,
  score: scoreCategorize,
};
