import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClassDatePicker } from "@/features/attendance/components/ClassDatePicker";

const CLASSES = [{ id: "class-1", name: "Primary 1" }];

// A safely past month (well before any real "today" this suite runs on, so
// ClassDatePicker's own `max={todayIso()}` bound never interferes with the
// weekend assertions below). 2020-01-04 is a Saturday, 2020-01-06 a Monday.
const PAST_DATE = "2020-01-01";

/**
 * The calendar grid's day number isn't a unique accessible name - a
 * leading/trailing day from an adjacent month can repeat it (see the popup's
 * 42-cell fixed grid) - so look up a cell by its `data-iso` instead, scoped
 * to the whole document since the popup is portaled to `document.body`.
 */
function dayCell(iso: string): HTMLElement {
  const cell = document.querySelector<HTMLElement>(`[data-iso="${iso}"]`);
  if (!cell) {
    throw new Error(`No day cell for ${iso}`);
  }
  return cell;
}

describe("ClassDatePicker", () => {
  it("greys out weekend dates when disableWeekends is set", async () => {
    const user = userEvent.setup();
    render(
      <ClassDatePicker
        classes={CLASSES}
        classId="class-1"
        onClassChange={vi.fn()}
        date={PAST_DATE}
        onDateChange={vi.fn()}
        disableWeekends
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open calendar" }));
    await screen.findByRole("dialog", { name: "Choose date" });

    expect(dayCell("2020-01-04")).toBeDisabled();
    expect(dayCell("2020-01-06")).not.toBeDisabled();
  });

  it("leaves weekend dates selectable when disableWeekends is not set", async () => {
    const onDateChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ClassDatePicker
        classes={CLASSES}
        classId="class-1"
        onClassChange={vi.fn()}
        date={PAST_DATE}
        onDateChange={onDateChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open calendar" }));
    await screen.findByRole("dialog", { name: "Choose date" });
    const saturday = dayCell("2020-01-04");

    expect(saturday).not.toBeDisabled();
    await user.click(saturday);
    expect(onDateChange).toHaveBeenCalledWith("2020-01-04");
  });
});
