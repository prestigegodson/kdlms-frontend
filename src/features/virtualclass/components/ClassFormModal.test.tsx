import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { VirtualClass } from "@/api/virtualClasses";
import { ClassFormModal } from "./ClassFormModal";

const existing: VirtualClass = {
  id: "c1",
  name: "Algebra",
  description: null,
  subjectLabel: null,
  status: "ACTIVE",
  startDate: "2026-10-01",
  endDate: null,
  overLimit: false,
  slots: [],
  createdAt: "2026-10-01T08:00:00Z",
  meetingMode: "PLATFORM",
  meetingUrl: null,
  meetingProvider: null,
  meetingUnavailable: true,
};

function renderForm(props: Partial<Parameters<typeof ClassFormModal>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <ClassFormModal
      existing={null}
      defaultStartDate="2026-10-01"
      platformVideo
      onSubmit={onSubmit}
      onClose={() => {}}
      {...props}
    />,
  );
  return onSubmit;
}

describe("ClassFormModal meeting choice", () => {
  it("defaults a new class to Platform Video Conferencing when the plan has it", async () => {
    const onSubmit = renderForm();
    const user = userEvent.setup();

    expect(screen.getByLabelText("Platform Video Conferencing")).toBeChecked();
    expect(screen.queryByLabelText("Meeting link")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Algebra");
    await user.click(screen.getByRole("button", { name: "Create class" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ meetingMode: "PLATFORM", meetingUrl: null }));
  });

  it("asks for a Google Meet or Zoom link when the plan has no platform video", async () => {
    const onSubmit = renderForm({ platformVideo: false });
    const user = userEvent.setup();

    expect(screen.getByLabelText("Platform Video Conferencing")).toBeDisabled();
    expect(screen.getByLabelText("Google Meet or Zoom link")).toBeChecked();
    await user.type(screen.getByLabelText("Name"), "Algebra");
    await user.type(screen.getByLabelText("Meeting link"), "https://example.com/meet");
    await user.click(screen.getByRole("button", { name: "Create class" }));
    expect(await screen.findByText(/Enter a Google Meet or Zoom meeting link/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Meeting link"));
    await user.type(screen.getByLabelText("Meeting link"), " https://us02web.zoom.us/j/123 ");
    await user.click(screen.getByRole("button", { name: "Create class" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ meetingMode: "EXTERNAL", meetingUrl: "https://us02web.zoom.us/j/123" }),
    );
  });

  it("warns about a class left on the platform room after a downgrade", () => {
    renderForm({ existing, platformVideo: false });

    expect(screen.getByLabelText("Platform Video Conferencing")).toBeChecked();
    expect(screen.getByText(/no longer includes Platform Video Conferencing/)).toBeInTheDocument();
  });
});
