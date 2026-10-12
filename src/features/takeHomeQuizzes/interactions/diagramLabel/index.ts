import { lazy } from "react";
import { Tags } from "lucide-react";
import { QUESTION_TYPE_LABELS } from "@/features/takeHomeQuizzes/editableQuestion";
import type { InteractionPlugin } from "../types";
import { DiagramLabelPlayer } from "./Player";
import { DiagramLabelReview } from "./Review";
import { blankDiagramLabelConfig, toDiagramLabelPlayerView } from "./defaults";
import { scoreDiagramLabel } from "./score";
import type { DiagramLabelConfig, DiagramLabelPlayerConfig, DiagramLabelResponse } from "./types";

/** `DIAGRAM_LABEL` (interaction-quiz.md §2): drag labels onto zones of an image; one part per zone. */
export const diagramLabelPlugin: InteractionPlugin<DiagramLabelConfig, DiagramLabelPlayerConfig, DiagramLabelResponse> = {
  type: "DIAGRAM_LABEL",
  label: QUESTION_TYPE_LABELS.DIAGRAM_LABEL,
  icon: Tags,
  blank: blankDiagramLabelConfig,
  toPlayerView: toDiagramLabelPlayerView,
  Author: lazy(() => import("./Author").then((module) => ({ default: module.DiagramLabelAuthor }))),
  Player: DiagramLabelPlayer,
  Review: DiagramLabelReview,
  score: scoreDiagramLabel,
};
