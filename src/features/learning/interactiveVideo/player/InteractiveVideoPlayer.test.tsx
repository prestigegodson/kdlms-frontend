import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InteractiveItem, InteractiveVideoDocument } from "@/api/learning";
import { newItem } from "../defaults";
import { InteractiveVideoPlayer } from "./InteractiveVideoPlayer";
import type { VideoController, VideoSourceEvents } from "./videoSources";

// A scripted stand-in for both video sources: the test drives time, play state and the end.
let events: VideoSourceEvents;
let position = 0;
const controller = {
  play: vi.fn(() => events.onPlayingChange(true)),
  pause: vi.fn(() => events.onPlayingChange(false)),
  seek: vi.fn((seconds: number) => {
    position = seconds;
  }),
  currentTime: () => position,
  setMuted: vi.fn(),
} satisfies VideoController;

function FakeSource({ events: sourceEvents }: { events: VideoSourceEvents }) {
  useEffect(() => {
    events = sourceEvents;
  });
  useEffect(() => {
    sourceEvents.onReady(controller);
    sourceEvents.onDuration(60);
    // Mount-only: the real sources also report ready once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

vi.mock("./videoSources", () => ({ HtmlVideoSource: FakeSource, YouTubeVideoSource: FakeSource }));

let stageWidth = 1000;
vi.mock("./useElementWidth", () => ({ useElementWidth: () => stageWidth }));

function question(overrides: Partial<InteractiveItem> = {}): InteractiveItem {
  const base = newItem("SINGLE_CHOICE", 10, 0.1, 0.1);
  return {
    ...base,
    id: "q",
    end: 15,
    mandatory: "CORRECT",
    enableRetry: true,
    content: {
      ...base.content,
      question: "2 + 2?",
      options: [
        { id: "a", text: "4", correct: true },
        { id: "b", text: "5", correct: false },
      ],
    },
    ...overrides,
  };
}

function renderPlayer(document: InteractiveVideoDocument, props: { onCompleted?: () => void; initial?: number } = {}) {
  render(
    <InteractiveVideoPlayer
      document={document}
      title="Lesson"
      source={{ kind: "youtube", videoId: "dQw4w9WgXcQ" }}
      initialPositionSeconds={props.initial}
      onCompleted={props.onCompleted}
    />,
  );
}

function playTo(seconds: number) {
  act(() => {
    events.onPlayingChange(true);
    position = seconds;
    events.onTime(seconds);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  position = 0;
  stageWidth = 1000;
});

describe("InteractiveVideoPlayer", () => {
  it("pauses at the end of an unanswered required question and opens it", () => {
    renderPlayer({ schemaVersion: 1, items: [question()] });

    playTo(14.8);

    expect(controller.pause).toHaveBeenCalled();
    expect(controller.seek).toHaveBeenLastCalledWith(14.65);
    expect(screen.getByRole("dialog", { name: "2 + 2?" })).toBeInTheDocument();
    expect(screen.getByText("Answer this to continue the video.")).toBeInTheDocument();
  });

  it("won't let the seek bar skip an unanswered required question", () => {
    renderPlayer({ schemaVersion: 1, items: [question()] });

    fireEvent.change(screen.getByRole("slider", { name: "Seek" }), { target: { value: "50" } });

    expect(controller.seek).toHaveBeenLastCalledWith(10);
    expect(screen.getByText("Answer the question here before skipping ahead.")).toBeInTheDocument();
  });

  it("resumes at the earliest required question before the saved position", () => {
    renderPlayer({ schemaVersion: 1, items: [question()] }, { initial: 40 });

    expect(controller.seek).toHaveBeenCalledWith(10);
  });

  it("marks the video complete when it ends with the required question answered correctly", async () => {
    const user = userEvent.setup();
    const onCompleted = vi.fn();
    renderPlayer({ schemaVersion: 1, items: [question()] }, { onCompleted });

    playTo(12);
    await user.click(screen.getByRole("button", { name: /2 \+ 2\?/ }));
    await user.click(screen.getByRole("radio", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText(/Correct!/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    act(() => events.onEnded());

    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(screen.getByText("You answered 1 of 1 question correctly.")).toBeInTheDocument();
  });

  it("doesn't complete a video whose required question was answered wrongly", async () => {
    const user = userEvent.setup();
    const onCompleted = vi.fn();
    renderPlayer({ schemaVersion: 1, items: [question()] }, { onCompleted });

    playTo(12);
    await user.click(screen.getByRole("button", { name: /2 \+ 2\?/ }));
    await user.click(screen.getByRole("radio", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();

    act(() => events.onEnded());

    expect(onCompleted).not.toHaveBeenCalled();
  });

  it("shows a poster inline on a wide stage", () => {
    const poster = { ...newItem("LABEL", 0, 0.1, 0.1), id: "label", end: 20, content: { ...newItem("LABEL", 0, 0, 0).content, text: "Look here" } };
    renderPlayer({ schemaVersion: 1, items: [poster] });
    playTo(1);
    expect(screen.getByText("Look here")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Look here/ })).not.toBeInTheDocument();
  });

  it("collapses a poster to a button below the compact width", () => {
    stageWidth = 400;
    const poster = { ...newItem("LABEL", 0, 0.1, 0.1), id: "label", end: 20, content: { ...newItem("LABEL", 0, 0, 0).content, text: "Look here" } };
    renderPlayer({ schemaVersion: 1, items: [poster] });
    playTo(1);
    expect(screen.getByRole("button", { name: /Look here/ })).toBeInTheDocument();
  });

  it("follows a crossroads choice to its time, carrying the student past what it skips", async () => {
    const user = userEvent.setup();
    const crossroads: InteractiveItem = {
      ...newItem("CROSSROADS", 5, 0.1, 0.1),
      id: "cross",
      end: 8,
      displayAs: "BUTTON",
      content: {
        ...newItem("CROSSROADS", 0, 0, 0).content,
        prompt: "Which topic?",
        choices: [
          { label: "Plants", targetSeconds: 30 },
          { label: "Animals", targetSeconds: 45 },
        ],
      },
    };
    renderPlayer({ schemaVersion: 1, items: [crossroads, question()] });

    playTo(6);
    await user.click(screen.getByRole("button", { name: /Which topic\?/ }));
    await user.click(screen.getByRole("button", { name: "Plants" }));

    expect(controller.seek).toHaveBeenLastCalledWith(30);
    // The required question at 0:10 was jumped over by the author's own branch - it no longer gates.
    playTo(31);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
