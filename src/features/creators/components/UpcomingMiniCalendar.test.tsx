import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { longDate } from "@/features/virtualclass/scheduleUtils";
import { UpcomingMiniCalendar } from "./UpcomingMiniCalendar";

function renderCalendar(props: Partial<Parameters<typeof UpcomingMiniCalendar>[0]> = {}) {
  const onSelectDate = vi.fn();
  const onMonthChange = vi.fn();
  render(
    <UpcomingMiniCalendar
      month="2026-10"
      minMonth="2026-10"
      maxMonth="2026-11"
      onMonthChange={onMonthChange}
      counts={new Map([
        ["2026-10-13", 1],
        ["2026-10-15", 3],
      ])}
      today="2026-10-12"
      selectedDate={null}
      onSelectDate={onSelectDate}
      {...props}
    />,
  );
  return { onSelectDate, onMonthChange };
}

describe("UpcomingMiniCalendar", () => {
  it("shows one dot for a single session and two for several", () => {
    renderCalendar();
    const single = screen.getByRole("button", { name: `${longDate("2026-10-13")}, 1 session` });
    const several = screen.getByRole("button", { name: `${longDate("2026-10-15")}, 3 sessions` });
    expect(single.querySelector("[data-testid=session-dots]")?.childElementCount).toBe(1);
    expect(several.querySelector("[data-testid=session-dots]")?.childElementCount).toBe(2);
    expect(screen.getByRole("button", { name: `${longDate("2026-10-12")}, today, no sessions` })).toBeInTheDocument();
  });

  it("selects only days that have sessions", async () => {
    const user = userEvent.setup();
    const { onSelectDate } = renderCalendar();
    await user.click(screen.getByRole("button", { name: `${longDate("2026-10-14")}, no sessions` }));
    expect(onSelectDate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: `${longDate("2026-10-13")}, 1 session` }));
    expect(onSelectDate).toHaveBeenCalledWith("2026-10-13");
  });

  it("pages only within the months the data covers", async () => {
    const user = userEvent.setup();
    const { onMonthChange } = renderCalendar();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-11");
  });
});
