import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import type { VideoSourceEvents } from "../player/videoSources";
import { newItem } from "../defaults";
import { InteractiveVideoEditor } from "./InteractiveVideoEditor";

function FakeSource({ events }: { events: VideoSourceEvents }) {
  useEffect(() => {
    events.onReady({ play: vi.fn(), pause: vi.fn(), seek: vi.fn(), currentTime: () => 0, setMuted: vi.fn() });
    events.onDuration(30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

vi.mock("../player/videoSources", () => ({ HtmlVideoSource: FakeSource, YouTubeVideoSource: FakeSource }));

function renderEditor(props: Partial<Parameters<typeof InteractiveVideoEditor>[0]> = {}) {
  const onDone = vi.fn();
  const onDuration = vi.fn();
  render(
    <InteractiveVideoEditor
      initial={{ schemaVersion: 1, items: [] }}
      source={{ kind: "youtube", videoId: "dQw4w9WgXcQ" }}
      title="Lesson"
      durationSeconds={null}
      renderImage={() => null}
      onDuration={onDuration}
      onDone={onDone}
      onCancel={vi.fn()}
      {...props}
    />,
  );
  return { onDone, onDuration };
}

describe("InteractiveVideoEditor", () => {
  it("adds an item at the current time from the toolbar and hands the document back on Done", async () => {
    const user = userEvent.setup();
    const { onDone, onDuration } = renderEditor();
    expect(onDuration).toHaveBeenCalledWith(30);

    await user.click(screen.getByRole("button", { name: "+ Single choice" }));
    expect(screen.getByRole("heading", { name: "Single choice" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Question"), "What do plants need?");
    await user.click(screen.getByRole("button", { name: "Done" }));

    const document = onDone.mock.calls[0][0];
    expect(document.items).toHaveLength(1);
    expect(document.items[0]).toMatchObject({
      type: "SINGLE_CHOICE",
      start: 0,
      end: 5,
      pause: true,
      displayAs: "BUTTON",
      content: { question: "What do plants need?" },
    });
  });

  it("keeps requiring a correct answer and retry together", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: "+ True / false" }));

    await user.selectOptions(screen.getByLabelText("Before the video continues"), "CORRECT");

    expect(screen.getByLabelText("Allow retry")).toBeChecked();
    expect(screen.getByLabelText("Allow retry")).toBeDisabled();
  });

  it("flags items that run past the end of the video", () => {
    const late = { ...newItem("LABEL", 25, 0.1, 0.1), id: "late", end: 40 };
    renderEditor({ initial: { schemaVersion: 1, items: [late] }, durationSeconds: 30 });

    expect(screen.getByText(/1 item falls after the end of the video/)).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Items in time order" });
    expect(within(list).getByText("Needs attention")).toBeInTheDocument();
  });
});
