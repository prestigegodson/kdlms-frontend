import { lazy } from "react";
import { MapPin } from "lucide-react";
import { QUESTION_TYPE_LABELS } from "@/features/takeHomeQuizzes/editableQuestion";
import type { InteractionPlugin } from "../types";
import { HotspotPlayer } from "./Player";
import { HotspotReview } from "./Review";
import { blankHotspot, toHotspotPlayerView } from "./defaults";
import { scoreHotspot } from "./score";
import type { HotspotConfig, HotspotPlayerConfig, HotspotResponse } from "./types";

/** `HOTSPOT` (interaction-quiz.md §2): drop pins on an image; one part per target region. */
export const hotspotPlugin: InteractionPlugin<HotspotConfig, HotspotPlayerConfig, HotspotResponse> = {
  type: "HOTSPOT",
  label: QUESTION_TYPE_LABELS.HOTSPOT,
  icon: MapPin,
  blank: blankHotspot,
  toPlayerView: toHotspotPlayerView,
  Author: lazy(() => import("./Author").then((module) => ({ default: module.HotspotAuthor }))),
  Player: HotspotPlayer,
  Review: HotspotReview,
  score: scoreHotspot,
};
