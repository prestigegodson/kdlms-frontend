import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { InteractiveItem, InteractiveVideoDocument } from "@/api/learning";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { itemTitle } from "../defaults";
import {
  activeItems,
  clampSeek,
  crossedPauses,
  formatTimecode,
  gateAt,
  gateHoldTime,
  isComplete,
  isGraded,
  isInteractive,
  resumePoint,
  waiveJumpedOver,
  type ItemOutcome,
  type Outcomes,
} from "../engine";
import { ItemBody, type RenderImage } from "./ItemBody";
import { useElementWidth } from "./useElementWidth";
import { HtmlVideoSource, YouTubeVideoSource, type VideoController, type VideoSourceEvents } from "./videoSources";

/** Below this stage width posters collapse to buttons that open in the dialog - they'd cover the picture otherwise. */
export const COMPACT_STAGE_WIDTH = 640;

export type InteractiveVideoSource =
  | { kind: "file"; url: string | null; error?: boolean; onUrlExpired?: () => void }
  | { kind: "youtube"; videoId: string };

interface DialogState {
  itemId: string;
  /** Whether closing the dialog should start playback again - it was playing, or an item paused it. */
  resumeOnClose: boolean;
}

/**
 * The student's interactive video (H5P-style): the video with its overlay items appearing at
 * their times as buttons or posters, a custom control bar whose seek bar can't skip an unanswered
 * mandatory item, and an in-player dialog for button items - rendered inside the player (never
 * portalled to `document.body`) so it still shows in fullscreen. Every rule lives in `engine.ts`;
 * answers are checked in the browser and kept for this visit only.
 *
 * `onTimeUpdate` feeds the caller's throttled resume-position autosave; `onCompleted` fires when
 * the video reaches its end with every mandatory item passed.
 */
export function InteractiveVideoPlayer({
  document: video,
  source,
  title,
  renderImage,
  initialPositionSeconds,
  onTimeUpdate,
  onCompleted,
}: {
  document: InteractiveVideoDocument;
  source: InteractiveVideoSource;
  title: string;
  renderImage?: RenderImage;
  initialPositionSeconds?: number | null;
  onTimeUpdate?: (positionSeconds: number) => void;
  onCompleted?: () => void;
}) {
  const items = video.items;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<VideoController | null>(null);
  const outcomesRef = useRef<Outcomes>({});
  const previousTimeRef = useRef(0);
  const playingRef = useRef(false);
  const pausedForRef = useRef<Set<string>>(new Set());
  const resumedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [outcomes, setOutcomesState] = useState<Outcomes>({});
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const stageWidth = useElementWidth(stageRef);
  const compact = stageWidth > 0 && stageWidth < COMPACT_STAGE_WIDTH;

  const setOutcomes = useCallback((next: Outcomes) => {
    outcomesRef.current = next;
    setOutcomesState(next);
  }, []);

  const openItem = useCallback((itemId: string, resumeOnClose: boolean) => {
    controllerRef.current?.pause();
    setDialog({ itemId, resumeOnClose });
  }, []);

  /** Starts playback unless an unanswered mandatory item holds the playhead - then opens it instead. */
  const play = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }
    const gate = gateAt(items, outcomesRef.current, controller.currentTime());
    if (gate) {
      setNotice("Answer this to continue the video.");
      openItem(gate.id, true);
      return;
    }
    setNotice(null);
    setEnded(false);
    controller.play();
  }, [items, openItem]);

  /** A student seek - forward seeks stop at the first unanswered mandatory item. */
  const seek = useCallback(
    (target: number) => {
      const controller = controllerRef.current;
      if (!controller) {
        return;
      }
      const from = controller.currentTime();
      const landed = clampSeek(items, outcomesRef.current, from, target);
      setNotice(landed < target - 0.5 ? "Answer the question here before skipping ahead." : null);
      if (landed < from) {
        // Seeking back re-arms the pauses of everything ahead.
        for (const item of items) {
          if (item.start > landed) {
            pausedForRef.current.delete(item.id);
          }
        }
      }
      previousTimeRef.current = landed;
      setEnded(false);
      controller.seek(landed);
      setTime(landed);
    },
    [items],
  );

  /** A teacher-authored jump - adaptivity, go-to, hotspot, crossroads - which waives what it jumps over. */
  const jump = useCallback(
    (target: number) => {
      const controller = controllerRef.current;
      if (!controller) {
        return;
      }
      const from = controller.currentTime();
      setOutcomes(waiveJumpedOver(items, outcomesRef.current, from, target));
      for (const item of items) {
        if (item.start >= target) {
          pausedForRef.current.delete(item.id);
        }
      }
      // Just before the target, so an item starting exactly there still pauses as it's crossed.
      previousTimeRef.current = target - 0.01;
      setEnded(false);
      setNotice(null);
      controller.seek(target);
      setTime(target);
    },
    [items, setOutcomes],
  );

  function closeDialog() {
    const resume = dialog?.resumeOnClose ?? false;
    setDialog(null);
    if (resume) {
      play();
    }
  }

  function recordOutcome(item: InteractiveItem, outcome: ItemOutcome) {
    const current = outcomesRef.current[item.id];
    // A later wrong retry never takes back an earlier correct answer.
    if (current === "correct" && outcome === "wrong") {
      return;
    }
    setOutcomes({ ...outcomesRef.current, [item.id]: outcome });
    setNotice(null);
  }

  const events: VideoSourceEvents = {
    onReady: (controller) => {
      controllerRef.current = controller;
      setReady(true);
    },
    onDuration: (seconds) => {
      setDuration(seconds);
      if (!resumedRef.current) {
        resumedRef.current = true;
        const start = resumePoint(items, initialPositionSeconds);
        if (start > 0) {
          previousTimeRef.current = start;
          controllerRef.current?.seek(start);
          setTime(start);
        }
      }
    },
    onTime: (seconds) => {
      const previous = previousTimeRef.current;
      previousTimeRef.current = seconds;
      setTime(seconds);
      onTimeUpdate?.(Math.floor(seconds));
      const controller = controllerRef.current;
      if (!playingRef.current || !controller) {
        return;
      }
      const gate = gateAt(items, outcomesRef.current, seconds);
      if (gate) {
        const hold = gateHoldTime(gate);
        controller.pause();
        controller.seek(hold);
        previousTimeRef.current = hold;
        setNotice("Answer this to continue the video.");
        if (gate.displayAs === "BUTTON" || compact) {
          setDialog({ itemId: gate.id, resumeOnClose: true });
        }
        return;
      }
      const crossed = crossedPauses(items, previous, seconds, pausedForRef.current);
      if (crossed.length > 0) {
        crossed.forEach((item) => pausedForRef.current.add(item.id));
        controller.pause();
        const toOpen = crossed.find(
          (item) => item.type !== "NAV_HOTSPOT" && (item.displayAs === "BUTTON" || compact) && isInteractive(item.type),
        );
        if (toOpen) {
          setDialog({ itemId: toOpen.id, resumeOnClose: true });
        }
      }
    },
    onPlayingChange: (isPlaying) => {
      playingRef.current = isPlaying;
      setPlaying(isPlaying);
    },
    onEnded: () => {
      playingRef.current = false;
      setPlaying(false);
      setEnded(true);
      if (isComplete(items, outcomesRef.current)) {
        onCompleted?.();
      }
    },
    onError: () => setFailed(true),
  };

  // Native fullscreen state, including Safari's prefixed API.
  useEffect(() => {
    function handleChange() {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setNativeFullscreen(Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener("webkitfullscreenchange", handleChange);
    };
  }, []);

  function toggleFullscreen() {
    const doc = document as Document & { webkitExitFullscreen?: () => void; webkitFullscreenElement?: Element | null };
    const container = containerRef.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => void })
      | null;
    if (pseudoFullscreen) {
      setPseudoFullscreen(false);
      return;
    }
    if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else {
        doc.webkitExitFullscreen?.();
      }
      return;
    }
    if (container?.requestFullscreen) {
      container.requestFullscreen().catch(() => setPseudoFullscreen(true));
    } else if (container?.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    } else {
      // iPhone Safari has no element fullscreen; fill the viewport instead so the overlays stay.
      setPseudoFullscreen(true);
    }
  }

  const visible = useMemo(() => activeItems(items, time), [items, time]);
  const dialogItem = dialog ? items.find((item) => item.id === dialog.itemId) ?? null : null;
  const fullscreen = nativeFullscreen || pseudoFullscreen;

  const graded = items.filter((item) => isGraded(item.type));
  const correctCount = graded.filter((item) => outcomes[item.id] === "correct").length;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && dialog) {
      event.stopPropagation();
      closeDialog();
    } else if (event.key === "Escape" && pseudoFullscreen) {
      setPseudoFullscreen(false);
    }
  }

  const sourceUnavailable = source.kind === "file" && (source.error || source.url === null);

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={`relative flex flex-col overflow-hidden bg-black ${
        pseudoFullscreen ? "fixed inset-0 z-50" : fullscreen ? "h-full w-full" : "w-full rounded-card border border-slate-200"
      }`}
    >
      {/* 16:9 via padding-top, not `aspect-ratio` - Chrome 64 / iOS 12 (the browser floor) lack it and every child here is absolutely positioned. */}
      <div
        ref={stageRef}
        style={fullscreen ? undefined : { paddingTop: "56.25%" }}
        className={`relative w-full overflow-hidden bg-black ${fullscreen ? "flex-1" : ""}`}
      >
        {source.kind === "file" ? (
          source.url && !source.error ? (
            <HtmlVideoSource url={source.url} title={title} onUrlExpired={source.onUrlExpired} events={events} />
          ) : null
        ) : (
          <YouTubeVideoSource videoId={source.videoId} events={events} />
        )}

        {/* Click shield: covers the video (and YouTube's iframe) so taps toggle play rather than reaching the source. */}
        <button
          type="button"
          aria-label={playing ? "Pause video" : "Play video"}
          className="absolute inset-0 h-full w-full cursor-pointer bg-transparent"
          onClick={() => (playing ? controllerRef.current?.pause() : play())}
          tabIndex={-1}
        />

        {ready &&
          visible.map((item) => (
            <ItemHost
              key={item.id}
              item={item}
              compact={compact}
              answered={outcomes[item.id] !== undefined}
              renderImage={renderImage}
              onOpen={() => openItem(item.id, playingRef.current)}
              onOutcome={(outcome) => recordOutcome(item, outcome)}
              onJump={jump}
            />
          ))}

        {(!ready || sourceUnavailable) && !failed && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
            <Spinner /> Loading video…
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
            This video couldn&apos;t be played. It may have been removed, or its owner may not allow it to be embedded.
          </div>
        )}

        {notice && !dialog && (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit max-w-[90%] rounded-control bg-slate-900/85 px-3 py-1.5 text-center text-xs font-medium text-white"
          >
            {notice}
          </div>
        )}

        {ended && !dialog && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 p-6 text-center text-white">
            <p className="text-lg font-semibold">You&apos;ve reached the end</p>
            {graded.length > 0 && (
              <p className="text-sm text-white/80">
                You answered {correctCount} of {graded.length} question{graded.length === 1 ? "" : "s"} correctly.
              </p>
            )}
            <Button
              variant="accent"
              onClick={() => {
                pausedForRef.current.clear();
                seek(0);
                play();
              }}
            >
              Watch again
            </Button>
          </div>
        )}

        {dialogItem && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/60 p-3">
            <div
              role="dialog"
              aria-modal="true"
              aria-label={itemTitle(dialogItem)}
              className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-card bg-white p-5 shadow-xl"
            >
              <button
                type="button"
                aria-label="Close"
                onClick={closeDialog}
                className="absolute right-2 top-2 rounded-control px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
              {notice && <p className="mb-3 pr-6 text-xs font-medium text-amber-700">{notice}</p>}
              <ItemBody
                item={dialogItem}
                renderImage={renderImage}
                onOutcome={(outcome) => recordOutcome(dialogItem, outcome)}
                onJump={(seconds) => {
                  setDialog(null);
                  jump(seconds);
                  play();
                }}
                onClose={closeDialog}
              />
            </div>
          </div>
        )}
      </div>

      <ControlBar
        items={items}
        outcomes={outcomes}
        time={time}
        duration={duration}
        playing={playing}
        muted={muted}
        fullscreen={fullscreen}
        disabled={!ready || failed}
        onPlayPause={() => (playing ? controllerRef.current?.pause() : play())}
        onSeek={seek}
        onToggleMute={() => {
          controllerRef.current?.setMuted(!muted);
          setMuted(!muted);
        }}
        onToggleFullscreen={toggleFullscreen}
      />
    </div>
  );
}

const BUTTON_SIZES = { S: "h-8 min-w-8 text-xs", M: "h-10 min-w-10 text-sm", L: "h-12 min-w-12 text-base" } as const;

/** One item on the stage: a hotspot region, a poster box, or a button that opens the dialog. */
function ItemHost({
  item,
  compact,
  answered,
  renderImage,
  onOpen,
  onOutcome,
  onJump,
}: {
  item: InteractiveItem;
  compact: boolean;
  answered: boolean;
  renderImage?: RenderImage;
  onOpen: () => void;
  onOutcome: (outcome: ItemOutcome) => void;
  onJump: (seconds: number) => void;
}) {
  const box: CSSProperties = {
    left: `${item.x * 100}%`,
    top: `${item.y * 100}%`,
    width: `${item.w * 100}%`,
    height: `${item.h * 100}%`,
  };

  if (item.type === "NAV_HOTSPOT") {
    return (
      <button
        type="button"
        aria-label={item.style?.buttonLabel ?? "Jump in the video"}
        style={box}
        className={`absolute border-2 border-dashed border-white/80 bg-white/10 hover:bg-white/25 ${
          item.content.shape === "CIRCLE" ? "rounded-full" : "rounded-control"
        }`}
        onClick={() => {
          onOutcome("answered");
          if (item.content.targetSeconds != null) {
            onJump(item.content.targetSeconds);
          }
        }}
      />
    );
  }

  const background = item.style?.transparent ? "transparent" : item.style?.background ?? undefined;

  if (item.displayAs === "POSTER" && !compact) {
    const clickable = item.goTo != null;
    function handlePosterClick() {
      if (item.goTo?.kind === "TIME" && item.goTo.seconds != null) {
        onJump(item.goTo.seconds);
      } else if (item.goTo?.kind === "URL" && item.goTo.url) {
        window.open(item.goTo.url, "_blank", "noopener,noreferrer");
      }
    }
    return (
      <div
        style={{ ...box, background }}
        className={`absolute overflow-auto rounded-control p-2 text-slate-900 shadow-md ${
          background ? "" : "bg-white/95"
        } ${clickable ? "cursor-pointer" : ""}`}
        onClick={clickable ? handlePosterClick : undefined}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={clickable ? (event) => event.key === "Enter" && handlePosterClick() : undefined}
      >
        <ItemBody item={item} renderImage={renderImage} onOutcome={onOutcome} onJump={onJump} />
      </div>
    );
  }

  const size = BUTTON_SIZES[item.style?.size ?? "M"];
  return (
    <button
      type="button"
      style={{ left: box.left, top: box.top, background: background ?? undefined }}
      onClick={onOpen}
      className={`absolute flex max-w-[45%] items-center gap-2 rounded-full px-3 font-medium shadow-lg ring-2 ring-white/70 ${size} ${
        background ? "text-white" : answered ? "bg-green-600 text-white" : "bg-brand-500 text-white hover:bg-brand-600"
      }`}
    >
      <span aria-hidden="true">{answered ? "✓" : "+"}</span>
      <span className="truncate">{itemTitle(item)}</span>
    </button>
  );
}

function ControlBar({
  items,
  outcomes,
  time,
  duration,
  playing,
  muted,
  fullscreen,
  disabled,
  onPlayPause,
  onSeek,
  onToggleMute,
  onToggleFullscreen,
}: {
  items: readonly InteractiveItem[];
  outcomes: Outcomes;
  time: number;
  duration: number | null;
  playing: boolean;
  muted: boolean;
  fullscreen: boolean;
  disabled: boolean;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
}) {
  const length = duration ?? 0;
  return (
    <div className="flex items-center gap-2 bg-slate-900 px-2 py-1.5 text-white sm:gap-3 sm:px-3">
      <button
        type="button"
        onClick={onPlayPause}
        disabled={disabled}
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control hover:bg-white/10 disabled:opacity-50 mobile:h-11 mobile:w-11"
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <span className="shrink-0 text-xs tabular-nums text-white/80">
        {formatTimecode(time)} / {formatTimecode(length)}
      </span>
      <div className="relative flex-1">
        <input
          type="range"
          min={0}
          max={length || 0}
          step={0.1}
          value={Math.min(time, length)}
          disabled={disabled || !length}
          onChange={(event) => onSeek(Number(event.target.value))}
          aria-label="Seek"
          className="block w-full accent-amber-400"
        />
        {length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 -top-1.5 h-1.5" aria-hidden="true">
            {items
              .filter((item) => isInteractive(item.type))
              .map((item) => (
                <span
                  key={item.id}
                  className={`absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                    outcomes[item.id] !== undefined ? "bg-green-400" : item.mandatory !== "NONE" ? "bg-amber-400" : "bg-white/70"
                  }`}
                  style={{ left: `${Math.min(100, (item.start / length) * 100)}%` }}
                />
              ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onToggleMute}
        disabled={disabled}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-9 shrink-0 items-center justify-center rounded-control px-2 text-xs hover:bg-white/10 disabled:opacity-50 mobile:h-11"
      >
        {muted ? "Unmute" : "Mute"}
      </button>
      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label={fullscreen ? "Exit full screen" : "Full screen"}
        className="flex h-9 shrink-0 items-center justify-center rounded-control px-2 text-xs hover:bg-white/10 mobile:h-11"
      >
        {fullscreen ? "Exit" : "Full screen"}
      </button>
    </div>
  );
}
