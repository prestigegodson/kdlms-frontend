import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SlotDraft } from "../scheduleUtils";
import { ScheduleEditor } from "./ScheduleEditor";

const MONDAY_NINE: SlotDraft = {
  key: "s1",
  id: "s1",
  dayOfWeek: 1,
  startTime: "09:00",
  durationMinutes: 60,
};

describe("ScheduleEditor", () => {
  it("adds a session to a day after that day's latest one", () => {
    const onChange = vi.fn();
    render(<ScheduleEditor slots={[MONDAY_NINE]} onChange={onChange} />);

    fireEvent.click(screen.getAllByRole("button", { name: /add session/i })[0]);

    const next = onChange.mock.calls[0][0] as SlotDraft[];
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ dayOfWeek: 1, startTime: "10:00", durationMinutes: 60 });
    expect(next[1].id).toBeUndefined();
  });

  it("edits and removes a session", () => {
    const onChange = vi.fn();
    render(<ScheduleEditor slots={[MONDAY_NINE]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Monday start time"), { target: { value: "11:15" } });
    expect(onChange).toHaveBeenLastCalledWith([{ ...MONDAY_NINE, startTime: "11:15" }]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Monday 09:00 session" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("is read-only when disabled", () => {
    render(<ScheduleEditor slots={[MONDAY_NINE]} onChange={vi.fn()} disabled />);

    expect(screen.queryByRole("button", { name: /add session/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Monday start time")).toBeDisabled();
  });
});
