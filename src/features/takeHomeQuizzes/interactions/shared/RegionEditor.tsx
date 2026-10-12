import { Circle, Hexagon, ImagePlus, MousePointer2, Square, X } from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_LABEL, uploadFile } from "@/api/files";
import { AuthenticatedRichImage } from "@/components/richText/AuthenticatedRichImage";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  MAX_POLYGON_POINTS,
  MIN_POLYGON_POINTS,
  MIN_SIZE,
  contains,
  normalizeShape,
  percent,
  pointOn,
  translateShape,
  type NormalizedPoint,
  type Shape,
  type ShapeKind,
} from "./geometry";
import { NormalizedImageStage } from "./NormalizedImageStage";
import { RegionBadge } from "./RegionBadge";
import { ShapeOverlay } from "./ShapeOverlay";

/** Above this an author is warned - students often take quizzes on mobile data. */
export const LIGHT_IMAGE_BYTES = 300 * 1024;
const NUDGE = 0.01;
const BIG_NUDGE = 0.05;
/** How close (normalized) a tap must be to a polygon's first corner to close it. */
const CLOSE_DISTANCE = 0.03;

type Tool = "SELECT" | ShapeKind;

const TOOLS: Record<ShapeKind, { label: string; icon: typeof Square }> = {
  RECT: { label: "Rectangle", icon: Square },
  CIRCLE: { label: "Circle", icon: Circle },
  POLYGON: { label: "Free shape", icon: Hexagon },
};

type Drag =
  | { mode: "draw"; origin: NormalizedPoint; kind: "RECT" | "CIRCLE" }
  | { mode: "move"; id: string; origin: NormalizedPoint; original: Shape }
  | { mode: "resize"; id: string }
  | { mode: "vertex"; id: string; index: number };

export interface RegionEditorProps<R extends { id: string; shape: Shape }> {
  imageFileId: string | null;
  imageAspect: number;
  onImageChange(fileId: string, aspect: number): void;
  regions: R[];
  onRegionsChange(regions: R[]): void;
  /** A new region around a freshly drawn shape. */
  createRegion(shape: Shape): R;
  allowedKinds: ShapeKind[];
  maxRegions: number;
  /** "Zone 3", "Region 3" - the name a region goes by in the list and to assistive tech. */
  regionName(index: number): string;
  /** The type's own controls for one region - accepted labels, the target switch... */
  renderRegionPanel(region: R, index: number): ReactNode;
  disabled: boolean;
}

/**
 * Draws regions on an uploaded image (interaction-quiz.md §8) - shared by `DIAGRAM_LABEL` (zones)
 * and `HOTSPOT` (regions). Drag on the image to draw a rectangle or circle, or tap corner by corner
 * for a free shape; with the select tool, drag a region to move it and its handle (or corners) to
 * reshape it. With the keyboard, pick a region from the list, then the arrow keys move it (Shift for
 * bigger steps) and Delete removes it. Every coordinate is normalized, so nothing depends on how
 * large the image is drawn.
 */
export function RegionEditor<R extends { id: string; shape: Shape }>({
  imageFileId,
  imageAspect,
  onImageChange,
  regions,
  onRegionsChange,
  createRegion,
  allowedKinds,
  maxRegions,
  regionName,
  renderRegionPanel,
  disabled,
}: RegionEditorProps<R>) {
  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<Tool>(allowedKinds[0] ?? "SELECT");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [corners, setCorners] = useState<NormalizedPoint[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heavyImage, setHeavyImage] = useState<number | null>(null);

  const full = regions.length >= maxRegions;
  const selectedIndex = regions.findIndex((region) => region.id === selectedId);
  const selected = selectedIndex >= 0 ? regions[selectedIndex] : null;

  function updateShape(id: string, shape: Shape) {
    onRegionsChange(regions.map((region) => (region.id === id ? { ...region, shape } : region)));
  }

  function addRegion(shape: Shape) {
    if (full) {
      return;
    }
    const region = createRegion(normalizeShape(shape));
    onRegionsChange([...regions, region]);
    setSelectedId(region.id);
  }

  function removeRegion(id: string) {
    onRegionsChange(regions.filter((region) => region.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  }

  function finishPolygon() {
    if (corners.length >= MIN_POLYGON_POINTS) {
      addRegion({ kind: "POLYGON", points: corners });
    }
    setCorners([]);
  }

  function pointer(event: PointerEvent): NormalizedPoint | null {
    return stageRef.current ? pointOn(stageRef.current, event.clientX, event.clientY) : null;
  }

  function capture(event: PointerEvent) {
    stageRef.current?.setPointerCapture?.(event.pointerId);
  }

  function onPointerDown(event: PointerEvent) {
    if (disabled || !imageFileId) {
      return;
    }
    const point = pointer(event);
    if (!point) {
      return;
    }
    if (tool === "RECT" || tool === "CIRCLE") {
      if (!full) {
        capture(event);
        setDrag({ mode: "draw", origin: point, kind: tool });
      }
      return;
    }
    if (tool === "POLYGON") {
      if (full) {
        return;
      }
      const first = corners[0];
      if (corners.length >= MIN_POLYGON_POINTS && first && Math.hypot(point.x - first.x, point.y - first.y) <= CLOSE_DISTANCE) {
        finishPolygon();
      } else if (corners.length < MAX_POLYGON_POINTS) {
        setCorners([...corners, point]);
      }
      return;
    }
    const hit = [...regions].reverse().find((region) => contains(region.shape, point, imageAspect));
    setSelectedId(hit?.id ?? null);
    if (hit) {
      capture(event);
      setDrag({ mode: "move", id: hit.id, origin: point, original: hit.shape });
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag) {
      return;
    }
    const point = pointer(event);
    if (!point) {
      return;
    }
    switch (drag.mode) {
      case "draw":
        setDraft(drawnShape(drag.kind, drag.origin, point, imageAspect));
        return;
      case "move":
        updateShape(drag.id, translateShape(drag.original, point.x - drag.origin.x, point.y - drag.origin.y));
        return;
      case "resize": {
        const shape = regions.find((region) => region.id === drag.id)?.shape;
        if (shape?.kind === "RECT") {
          updateShape(drag.id, normalizeShape({ ...shape, w: point.x - shape.x, h: point.y - shape.y }));
        } else if (shape?.kind === "CIRCLE") {
          updateShape(drag.id, normalizeShape({ ...shape, r: radius({ x: shape.cx, y: shape.cy }, point, imageAspect) }));
        }
        return;
      }
      case "vertex": {
        const shape = regions.find((region) => region.id === drag.id)?.shape;
        if (shape?.kind === "POLYGON") {
          updateShape(drag.id, {
            kind: "POLYGON",
            points: shape.points.map((corner, index) => (index === drag.index ? point : corner)),
          });
        }
      }
    }
  }

  function onPointerUp() {
    if (drag?.mode === "draw" && draft && bigEnough(draft)) {
      addRegion(draft);
    }
    setDraft(null);
    setDrag(null);
  }

  function startHandleDrag(event: PointerEvent, next: Drag) {
    if (disabled) {
      return;
    }
    event.stopPropagation();
    capture(event);
    setDrag(next);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (disabled) {
      return;
    }
    if (event.key === "Escape") {
      setCorners([]);
      setSelectedId(null);
      return;
    }
    if (event.key === "Enter" && corners.length > 0) {
      event.preventDefault();
      finishPolygon();
      return;
    }
    if (!selected) {
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeRegion(selected.id);
      return;
    }
    const step = event.shiftKey ? BIG_NUDGE : NUDGE;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      updateShape(selected.id, translateShape(selected.shape, move[0], move[1]));
    }
  }

  async function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      setError(`Image is larger than ${MAX_IMAGE_UPLOAD_LABEL}. Please choose a smaller file.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const aspect = await measureAspect(file);
      const stored = await uploadFile(file);
      setHeavyImage(file.size > LIGHT_IMAGE_BYTES ? file.size : null);
      onImageChange(stored.fileId, aspect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload the image.");
    } finally {
      setUploading(false);
    }
  }

  const overlay = [
    ...regions.map((region) => ({
      key: region.id,
      shape: region.shape,
      tone: region.id === selectedId ? ("selected" as const) : ("neutral" as const),
    })),
    ...(draft ? [{ key: "draft", shape: draft, tone: "selected" as const, dashed: true }] : []),
    ...(corners.length >= 2
      ? [{ key: "corners", shape: { kind: "POLYGON" as const, points: corners }, tone: "selected" as const, dashed: true }]
      : []),
  ];

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          aria-label="Image file"
          onChange={onFileSelected}
        />
        {!disabled && (
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Spinner /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
            {imageFileId ? "Replace image" : "Upload image"}
          </Button>
        )}
        {imageFileId && !disabled && (
          <div role="toolbar" aria-label="Drawing tools" className="flex flex-wrap gap-1">
            <ToolButton active={tool === "SELECT"} onClick={() => setTool("SELECT")} icon={MousePointer2}>
              Select and move
            </ToolButton>
            {allowedKinds.map((kind) => (
              <ToolButton
                key={kind}
                active={tool === kind}
                onClick={() => {
                  setCorners([]);
                  setTool(kind);
                }}
                icon={TOOLS[kind].icon}
                disabled={full}
              >
                {TOOLS[kind].label}
              </ToolButton>
            ))}
          </div>
        )}
      </div>
      {heavyImage !== null && (
        <Alert variant="warning">
          This image is {Math.round(heavyImage / 1024)} KB. Students on mobile data will wait for it - under 300 KB is best.
        </Alert>
      )}
      {imageFileId ? (
        <>
          <NormalizedImageStage
            ref={stageRef}
            fileId={imageFileId}
            aspect={imageAspect}
            alt="The question's image"
            renderImage={(fileId, alt) => <AuthenticatedRichImage fileId={fileId} alt={alt} />}
            className={`touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
              disabled ? "" : tool === "SELECT" ? "cursor-pointer" : "cursor-crosshair"
            }`}
            tabIndex={disabled ? -1 : 0}
            role="group"
            aria-label="Drawing area. Pick a region from the list, then use the arrow keys to move it and Delete to remove it."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
          >
            <ShapeOverlay shapes={overlay} aspect={imageAspect} />
            {regions.map((region, index) => (
              <RegionBadge key={region.id} shape={region.shape} aspect={imageAspect} number={index + 1} />
            ))}
            {selected && tool === "SELECT" && !disabled && (
              <Handles
                shape={selected.shape}
                onStart={(event, index) =>
                  startHandleDrag(event, index === null ? { mode: "resize", id: selected.id } : { mode: "vertex", id: selected.id, index })
                }
              />
            )}
          </NormalizedImageStage>
          {tool === "POLYGON" && !disabled && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>
                {corners.length === 0
                  ? "Tap the image corner by corner, then finish the shape."
                  : `${corners.length} corner${corners.length === 1 ? "" : "s"} placed.`}
              </span>
              <Button type="button" size="sm" onClick={finishPolygon} disabled={corners.length < MIN_POLYGON_POINTS}>
                Finish shape
              </Button>
              {corners.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setCorners([])}>
                  Cancel
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-500">Upload an image to draw on.</p>
      )}

      {regions.length > 0 && (
        <ol className="space-y-2">
          {regions.map((region, index) => (
            <li
              key={region.id}
              className={`rounded-control border p-2 ${region.id === selectedId ? "border-brand-400 bg-brand-50" : "border-slate-200"}`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={region.id === selectedId}
                  onClick={() => {
                    setSelectedId(region.id);
                    setTool("SELECT");
                    stageRef.current?.focus();
                  }}
                  className="min-h-11 flex-1 text-left text-sm font-semibold text-slate-800"
                >
                  {regionName(index)}
                </button>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${regionName(index).toLowerCase()}`}
                    onClick={() => removeRegion(region.id)}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
              {renderRegionPanel(region, index)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  icon: Icon,
  disabled,
  children,
}: {
  active: boolean;
  onClick(): void;
  icon: typeof Square;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "primary" : "secondary"}
      size="sm"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </Button>
  );
}

function Handles({
  shape,
  onStart,
}: {
  shape: Shape;
  onStart(event: PointerEvent, index: number | null): void;
}) {
  const points: { at: NormalizedPoint; index: number | null }[] =
    shape.kind === "RECT"
      ? [{ at: { x: shape.x + shape.w, y: shape.y + shape.h }, index: null }]
      : shape.kind === "CIRCLE"
        ? [{ at: { x: shape.cx + shape.r, y: shape.cy }, index: null }]
        : shape.points.map((at, index) => ({ at, index }));
  return (
    <>
      {points.map(({ at, index }) => (
        <span
          key={index ?? "resize"}
          aria-hidden="true"
          onPointerDown={(event) => onStart(event, index)}
          className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center"
          style={{ left: percent(at.x), top: percent(at.y) }}
        >
          <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-600 shadow" />
        </span>
      ))}
    </>
  );
}

function drawnShape(kind: "RECT" | "CIRCLE", origin: NormalizedPoint, point: NormalizedPoint, aspect: number): Shape {
  if (kind === "CIRCLE") {
    return { kind: "CIRCLE", cx: origin.x, cy: origin.y, r: radius(origin, point, aspect) };
  }
  return {
    kind: "RECT",
    x: Math.min(origin.x, point.x),
    y: Math.min(origin.y, point.y),
    w: Math.abs(point.x - origin.x),
    h: Math.abs(point.y - origin.y),
  };
}

/** A circle's radius from its centre to `point`, in fractions of the image's width. */
function radius(center: NormalizedPoint, point: NormalizedPoint, aspect: number): number {
  return Math.hypot(point.x - center.x, (point.y - center.y) / (aspect > 0 ? aspect : 1));
}

/** A stray click while drawing is ignored rather than leaving a speck of a region. */
function bigEnough(shape: Shape): boolean {
  if (shape.kind === "RECT") {
    return shape.w >= 2 * MIN_SIZE && shape.h >= 2 * MIN_SIZE;
  }
  return shape.kind === "CIRCLE" ? shape.r >= 2 * MIN_SIZE : true;
}

/** The image's natural width over its height, read before it is uploaded. */
function measureAspect(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 1);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't an image this browser can read."));
    };
    image.src = url;
  });
}
