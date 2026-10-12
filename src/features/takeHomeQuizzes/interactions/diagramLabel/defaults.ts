import { BLANK_LABEL } from "../shared/labels";
import { shuffleAwayFromOrder } from "../shared/shuffle";
import type { Shape } from "../shared/geometry";
import type { DiagramLabel, DiagramLabelConfig, DiagramLabelPlayerConfig, DiagramZone } from "./types";

export function blankDiagramLabel(): DiagramLabel {
  return { id: crypto.randomUUID(), html: BLANK_LABEL };
}

export function diagramZoneFor(shape: Shape): DiagramZone {
  if (shape.kind !== "RECT") {
    throw new Error("A diagram zone is always a rectangle.");
  }
  return { id: crypto.randomUUID(), shape, acceptedLabelIds: [] };
}

/** Two labels and no image or zones yet - the author uploads a diagram and draws a zone per label. */
export function blankDiagramLabelConfig(): DiagramLabelConfig {
  return {
    schemaVersion: 1,
    imageFileId: null,
    imageAspect: 1,
    zones: [],
    labels: [blankDiagramLabel(), blankDiagramLabel()],
    reuseLabels: false,
  };
}

/** Every zone's accepted labels dropped and the labels shuffled - what the server would send a student. */
export function toDiagramLabelPlayerView(config: DiagramLabelConfig): DiagramLabelPlayerConfig {
  return {
    imageFileId: config.imageFileId,
    imageAspect: config.imageAspect,
    zones: config.zones.map(({ id, shape }) => ({ id, shape })),
    labels: shuffleAwayFromOrder(config.labels.map(({ id, html }) => ({ id, html }))),
    reuseLabels: config.reuseLabels,
  };
}
