import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from "react";
import type { InteractiveItem, InteractiveItemType, InteractiveVideoDocument, InteractiveVideoProblem } from "@/api/learning";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ITEM_TYPES, itemTitle, itemTypeLabel, newItem, newItemId } from "../defaults";
import { activeItems, formatTimecode, isInteractive, outOfRangeIds } from "../engine";
import type { RenderImage } from "../player/ItemBody";
import { InteractiveVideoPlayer, type InteractiveVideoSource } from "../player/InteractiveVideoPlayer";
import { HtmlVideoSource, YouTubeVideoSource, type VideoController, type VideoSourceEvents } from "../player/videoSources";
import { ItemForm } from "./ItemForm";

const OUT_OF_RANGE_MESSAGE = "Ends after the video does - move it inside the video.";

/**
 * The interactive video authoring surface (H5P's "Interactive Video" editor): drag an item type
 * from the toolbar onto the video where it should appear - it starts at the current time - then
 * move and resize it on the stage, set its times on the scrubber/timeline, and its options in the
 * side panel. Nothing here talks to the server: `onDone` hands the document back to the resource
 * form, which saves it with the rest of the resource.
 *
 * Items past the end of the video (a shorter replacement video, say) are kept and flagged rather
 * than moved - publishing stays blocked server-side until they're fixed. `serverProblems` are the
 * last save's publish problems; each item's own disappear once it's edited here.
 */
export function InteractiveVideoEditor({
  initial,
  source,
  title,
  durationSeconds,
  serverProblems = [],
  renderImage,
  onDuration,
  onDone,
  onCancel,
}: {
  initial: InteractiveVideoDocument;
  source: InteractiveVideoSource;
  title: string;
  durationSeconds: number | null;
  serverProblems?: InteractiveVideoProblem[];
  renderImage: RenderImage;
  onDuration: (seconds: number) => void;
  onDone: (document: InteractiveVideoDocument) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<InteractiveItem[]>(initial.items);
  const [selectedId, setSelectedId] = useState<string | null>(initial.items[0]?.id ?? null);
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(durationSeconds);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const controllerRef = useRef<VideoController | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  // When the last toolbar drag ended - the click that follows a drop must not add a second item.
  const lastDragEndRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  const outOfRange = useMemo(() => outOfRangeIds(items, duration), [items, duration]);
  const problemsByItem = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const problem of serverProblems) {
      if (problem.itemId && !edited.has(problem.itemId) && problem.message !== OUT_OF_RANGE_MESSAGE) {
        map.set(problem.itemId, [...(map.get(problem.itemId) ?? []), problem.message]);
      }
    }
    for (const id of outOfRange) {
      map.set(id, [OUT_OF_RANGE_MESSAGE, ...(map.get(id) ?? [])]);
    }
    return map;
  }, [serverProblems, edited, outOfRange]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const onStage = useMemo(() => {
    const visible = activeItems(items, time);
    return selected && !visible.includes(selected) ? [...visible, selected] : visible;
  }, [items, time, selected]);

  const events: VideoSourceEvents = {
    onReady: (controller) => {
      controllerRef.current = controller;
      setReady(true);
    },
    onTime: setTime,
    onDuration: (seconds) => {
      setDuration(seconds);
      onDuration(Math.round(seconds));
    },
    onPlayingChange: setPlaying,
    onEnded: () => setPlaying(false),
    onError: () => setFailed(true),
  };

  function updateItem(id: string, patch: Partial<InteractiveItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setEdited((current) => (current.has(id) ? current : new Set(current).add(id)));
  }

  function addItem(type: InteractiveItemType, x: number, y: number) {
    controllerRef.current?.pause();
    const item = newItem(type, Math.round(time * 10) / 10, x, y);
    setItems((current) => [...current, item]);
    setSelectedId(item.id);
  }

  function seekTo(seconds: number) {
    controllerRef.current?.seek(seconds);
    setTime(seconds);
  }

  function handleDragEnd(event: DragEndEvent) {
    lastDragEndRef.current = Date.now();
    const type = event.active.data.current?.type as InteractiveItemType | undefined;
    const dropped = event.active.rect.current.translated;
    const stage = stageRef.current?.getBoundingClientRect();
    if (!type || event.over?.id !== "iv-stage" || !dropped || !stage) {
      return;
    }
    addItem(type, (dropped.left - stage.left) / stage.width, (dropped.top - stage.top) / stage.height);
  }

  const editedDocument: InteractiveVideoDocument = { schemaVersion: 1, items };
  const length = duration ?? 0;

  return (
    <Modal open onClose={onCancel} title="Interactive video" size="workspace" fullScreenOnMobile>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              Drag an item onto the video where it should appear, or click one to add it in the middle.
              It starts at the current time.
            </p>
            <Button type="button" size="sm" variant="secondary" onClick={() => setPreviewing((value) => !value)}>
              {previewing ? "Back to editing" : "Preview as student"}
            </Button>
          </div>

          {failed && (
            <Alert variant="error">
              The video couldn&apos;t be loaded. Check the YouTube link (the video may be private, removed, or not
              allow embedding) or the uploaded file.
            </Alert>
          )}
          {outOfRange.size > 0 && (
            <Alert variant="warning">
              {outOfRange.size} item{outOfRange.size === 1 ? "" : "s"} fall{outOfRange.size === 1 ? "s" : ""} after the
              end of the video. They&apos;re kept, but the video can&apos;t be published until they&apos;re moved.
            </Alert>
          )}

          {previewing ? (
            <InteractiveVideoPlayer document={editedDocument} source={source} title={title} renderImage={renderImage} />
          ) : (
            <>
              <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Add an item">
                {ITEM_TYPES.map((entry) => (
                  <ToolbarChip
                    key={entry.type}
                    type={entry.type}
                    label={entry.label}
                    hint={entry.hint}
                    onAdd={(type) => {
                      if (Date.now() - lastDragEndRef.current > 300) {
                        addItem(type, 0.35, 0.35);
                      }
                    }}
                  />
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-2">
                  <Stage stageRef={stageRef}>
                    {source.kind === "file" ? (
                      source.url && <HtmlVideoSource url={source.url} title={title} onUrlExpired={source.onUrlExpired} events={events} />
                    ) : (
                      <YouTubeVideoSource videoId={source.videoId} events={events} />
                    )}
                    {/* Shield over the video: a click on empty stage deselects rather than reaching YouTube's iframe. */}
                    <div className="absolute inset-0" onClick={() => setSelectedId(null)} aria-hidden="true" />
                    {onStage.map((item) => (
                      <StageItem
                        key={item.id}
                        item={item}
                        selected={item.id === selectedId}
                        dimmed={!(time >= item.start && time < item.end)}
                        flagged={problemsByItem.has(item.id)}
                        stageRef={stageRef}
                        onSelect={() => setSelectedId(item.id)}
                        onChange={(patch) => updateItem(item.id, patch)}
                      />
                    ))}
                    {!ready && !failed && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/80">
                        Loading video…
                      </div>
                    )}
                  </Stage>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!ready}
                      onClick={() => (playing ? controllerRef.current?.pause() : controllerRef.current?.play())}
                    >
                      {playing ? "Pause" : "Play"}
                    </Button>
                    <span className="text-xs tabular-nums text-slate-600">
                      {formatTimecode(time)} / {formatTimecode(length)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={length || 0}
                      step={0.1}
                      value={Math.min(time, length)}
                      disabled={!ready || !length}
                      aria-label="Video position"
                      onChange={(event) => seekTo(Number(event.target.value))}
                      className="flex-1 accent-amber-500"
                    />
                  </div>

                  <Timeline
                    items={items}
                    length={length}
                    time={time}
                    selectedId={selectedId}
                    flagged={problemsByItem}
                    onSelect={(item) => {
                      setSelectedId(item.id);
                      seekTo(item.start);
                    }}
                  />
                </div>

                <aside className="rounded-card border border-slate-200 p-4 lg:max-h-[70vh] lg:overflow-y-auto">
                  {selected ? (
                    <ItemForm
                      key={selected.id}
                      item={selected}
                      currentTime={Math.round(time * 10) / 10}
                      problems={problemsByItem.get(selected.id) ?? []}
                      renderImage={renderImage}
                      onChange={(patch) => updateItem(selected.id, patch)}
                      onDelete={() => {
                        setItems((current) => current.filter((item) => item.id !== selected.id));
                        setSelectedId(null);
                      }}
                      onDuplicate={() => {
                        const copy: InteractiveItem = {
                          ...selected,
                          id: newItemId(),
                          x: Math.min(selected.x + 0.03, 1 - selected.w),
                          y: Math.min(selected.y + 0.03, 1 - selected.h),
                          content: {
                            ...selected.content,
                            options: selected.content.options?.map((option) => ({ ...option, id: newItemId() })) ?? null,
                          },
                        };
                        setItems((current) => [...current, copy]);
                        setSelectedId(copy.id);
                      }}
                    />
                  ) : (
                    <p className="text-sm text-slate-500">
                      Select an item on the video or in the list to edit it - or drag a new one onto the video.
                    </p>
                  )}
                </aside>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={() => onDone(editedDocument)}>
              Done
            </Button>
          </div>
        </div>
      </DndContext>
    </Modal>
  );
}

function ToolbarChip({
  type,
  label,
  hint,
  onAdd,
}: {
  type: InteractiveItemType;
  label: string;
  hint: string;
  onAdd: (type: InteractiveItemType) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `iv-new-${type}`,
    data: { type },
  });
  const style: CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20, position: "relative" }
    : undefined;
  return (
    <button
      ref={setNodeRef}
      type="button"
      title={hint}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onAdd(type)}
      className={`rounded-control border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-2xs hover:bg-slate-50 mobile:min-h-11 ${
        isDragging ? "opacity-80 shadow-lg" : ""
      }`}
    >
      + {label}
    </button>
  );
}

function Stage({ stageRef, children }: { stageRef: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "iv-stage" });
  return (
    <div
      ref={(node) => {
        stageRef.current = node;
        setNodeRef(node);
      }}
      // 16:9 via padding-top - see InteractiveVideoPlayer's stage.
      style={{ paddingTop: "56.25%" }}
      className={`relative w-full select-none overflow-hidden rounded-card bg-black ${isOver ? "ring-4 ring-amber-400" : ""}`}
    >
      {children}
    </div>
  );
}

type DragMode = "move" | "resize";

function pointOf(event: MouseEvent | TouchEvent): { x: number; y: number } {
  if ("touches" in event) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return { x: touch.clientX, y: touch.clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

/**
 * One item on the editing stage - move it by dragging its body, resize it from the corner handle.
 * Plain mouse and touch listeners rather than pointer events, which iOS 12 lacks.
 */
function StageItem({
  item,
  selected,
  dimmed,
  flagged,
  stageRef,
  onSelect,
  onChange,
}: {
  item: InteractiveItem;
  selected: boolean;
  dimmed: boolean;
  flagged: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onChange: (patch: Partial<InteractiveItem>) => void;
}) {
  function startDrag(mode: DragMode, event: ReactMouseEvent | ReactTouchEvent) {
    event.stopPropagation();
    onSelect();
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) {
      return;
    }
    const origin = pointOf(event.nativeEvent);
    const start = { x: item.x, y: item.y, w: item.w, h: item.h };
    function handleMove(moveEvent: MouseEvent | TouchEvent) {
      if (!stage) return;
      moveEvent.preventDefault();
      const point = pointOf(moveEvent);
      const dx = (point.x - origin.x) / stage.width;
      const dy = (point.y - origin.y) / stage.height;
      if (mode === "move") {
        onChange({
          x: Math.min(Math.max(0, start.x + dx), 1 - start.w),
          y: Math.min(Math.max(0, start.y + dy), 1 - start.h),
        });
      } else {
        onChange({
          w: Math.min(Math.max(0.05, start.w + dx), 1 - start.x),
          h: Math.min(Math.max(0.05, start.h + dy), 1 - start.y),
        });
      }
    }
    function handleEnd() {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
  }

  const button = item.displayAs === "BUTTON" && item.type !== "NAV_HOTSPOT";
  const style: CSSProperties = {
    left: `${item.x * 100}%`,
    top: `${item.y * 100}%`,
    width: button ? undefined : `${item.w * 100}%`,
    height: button ? undefined : `${item.h * 100}%`,
    background: item.style?.transparent ? "transparent" : (item.style?.background ?? undefined),
  };
  const ring = flagged ? "ring-2 ring-red-500" : selected ? "ring-2 ring-amber-400" : "ring-1 ring-white/60";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${itemTypeLabel(item.type)}: ${itemTitle(item)}`}
      aria-pressed={selected}
      style={style}
      onMouseDown={(event) => startDrag("move", event)}
      onTouchStart={(event) => startDrag("move", event)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 0.05 : 0.01;
        const moves: Record<string, Partial<InteractiveItem>> = {
          ArrowLeft: { x: Math.max(0, item.x - step) },
          ArrowRight: { x: Math.min(1 - item.w, item.x + step) },
          ArrowUp: { y: Math.max(0, item.y - step) },
          ArrowDown: { y: Math.min(1 - item.h, item.y + step) },
        };
        if (moves[event.key]) {
          event.preventDefault();
          onChange(moves[event.key]);
        } else if (event.key === "Enter") {
          onSelect();
        }
      }}
      className={`absolute cursor-move overflow-hidden text-xs font-medium ${ring} ${dimmed ? "opacity-50" : ""} ${
        item.type === "NAV_HOTSPOT"
          ? `border-2 border-dashed border-white bg-white/15 text-white ${item.content.shape === "CIRCLE" ? "rounded-full" : "rounded-control"}`
          : button
            ? "rounded-full bg-brand-500 px-3 py-2 text-white shadow-lg"
            : `rounded-control p-2 text-slate-900 shadow-md ${item.style?.background || item.style?.transparent ? "" : "bg-white/95"}`
      }`}
    >
      <span className="pointer-events-none block truncate">
        {button ? "+ " : ""}
        {itemTitle(item)}
      </span>
      {!button && selected && (
        <span
          aria-hidden="true"
          onMouseDown={(event) => startDrag("resize", event)}
          onTouchStart={(event) => startDrag("resize", event)}
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize rounded-tl bg-amber-400"
        />
      )}
    </div>
  );
}

function Timeline({
  items,
  length,
  time,
  selectedId,
  flagged,
  onSelect,
}: {
  items: InteractiveItem[];
  length: number;
  time: number;
  selectedId: string | null;
  flagged: Map<string, string[]>;
  onSelect: (item: InteractiveItem) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No items yet.</p>;
  }
  const sorted = [...items].sort((a, b) => a.start - b.start);
  // The timeline spans the video, or the furthest item when one runs past its end.
  const span = Math.max(length, ...items.map((item) => item.end), 1);
  return (
    <ol className="divide-y divide-slate-100 rounded-card border border-slate-200" aria-label="Items in time order">
      {sorted.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className={`grid w-full grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 mobile:grid-cols-1 mobile:gap-1 ${
              item.id === selectedId ? "bg-amber-50" : ""
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-900">{itemTitle(item)}</span>
              <span className="block text-xs text-slate-500">
                {itemTypeLabel(item.type)}
                {isInteractive(item.type) && item.mandatory !== "NONE" && " · required"}
                {item.pause && " · pauses"}
              </span>
            </span>
            <span className="relative h-2 rounded-full bg-slate-100" aria-hidden="true">
              <span
                className={`absolute inset-y-0 rounded-full ${flagged.has(item.id) ? "bg-red-400" : "bg-brand-400"}`}
                style={{ left: `${(item.start / span) * 100}%`, width: `${Math.max(1, ((item.end - item.start) / span) * 100)}%` }}
              />
              {length > 0 && length < span && (
                <span className="absolute inset-y-[-3px] w-0.5 bg-slate-500" style={{ left: `${(length / span) * 100}%` }} />
              )}
              <span className="absolute inset-y-[-3px] w-0.5 bg-amber-500" style={{ left: `${(Math.min(time, span) / span) * 100}%` }} />
            </span>
            <span className="text-xs tabular-nums text-slate-600">
              {formatTimecode(item.start)}–{formatTimecode(item.end)}
              {flagged.has(item.id) && <span className="ml-2 font-medium text-red-600">Needs attention</span>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
