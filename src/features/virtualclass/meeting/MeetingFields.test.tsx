import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MeetingMode } from "@/api/virtualClasses";
import { MeetingFields } from "./MeetingFields";

function renderFields(mode: MeetingMode, { directVideo = true, platformVideo = false } = {}) {
  const onModeChange = vi.fn();
  render(
    <MeetingFields
      idPrefix="test"
      legend="Where sessions are held"
      mode={mode}
      url=""
      onModeChange={onModeChange}
      onUrlChange={vi.fn()}
      platformVideo={platformVideo}
      directVideo={directVideo}
    />,
  );
  return onModeChange;
}

describe("MeetingFields", () => {
  it("offers free one-on-one video on a plan without the built-in room", () => {
    const onModeChange = renderFields("EXTERNAL");
    fireEvent.click(screen.getByRole("radio", { name: "One-on-one video (free)" }));
    expect(onModeChange).toHaveBeenCalledWith("DIRECT");
  });

  it("explains one-on-one video once chosen, with no link field", () => {
    renderFields("DIRECT");
    expect(screen.getByText("Just you and one learner. Uses no plan minutes.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Meeting link")).not.toBeInTheDocument();
    expect(screen.queryByText(/isn't included in your plan/)).not.toBeInTheDocument();
  });

  it("hides one-on-one video while the platform has it switched off", () => {
    renderFields("EXTERNAL", { directVideo: false });
    expect(screen.queryByRole("radio", { name: /one-on-one video/i })).not.toBeInTheDocument();
  });

  it("keeps a setup already on one-on-one video readable while it's switched off", () => {
    renderFields("DIRECT", { directVideo: false });
    expect(screen.getByRole("radio", { name: /one-on-one video/i })).toBeDisabled();
    expect(screen.getByText(/currently unavailable/i)).toBeInTheDocument();
  });
});
