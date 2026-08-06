import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DateInput } from "@/components/ui/DateInput";
import { Modal } from "@/components/ui/Modal";

function Labeled({
  value,
  onChange,
  min,
  max,
  isDayDisabled,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  isDayDisabled?: (day: Date) => boolean;
}) {
  return (
    <>
      <label htmlFor="the-date">The date</label>
      <DateInput
        id="the-date"
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        isDayDisabled={isDayDisabled}
      />
    </>
  );
}

/** Saturday/Sunday - the same predicate `ClassDatePicker` passes for `disableWeekends`. */
function isWeekend(day: Date): boolean {
  const weekday = day.getDay();
  return weekday === 0 || weekday === 6;
}

describe("DateInput", () => {
  it("fires onChange with the ISO value once a full valid date is typed", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Labeled value="" onChange={onChange} />);

    await user.type(screen.getByLabelText("The date"), "2026-09-01");

    expect(onChange).toHaveBeenCalledWith("2026-09-01");
    expect(onChange).toHaveBeenLastCalledWith("2026-09-01");
  });

  it("does not fire onChange while the date is only partially typed", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Labeled value="" onChange={onChange} />);

    await user.type(screen.getByLabelText("The date"), "2026-09");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("The date")).toHaveValue("2026-09");
  });

  it("fires onChange with an empty string when cleared", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Labeled value="2026-09-01" onChange={onChange} />);

    await user.clear(screen.getByLabelText("The date"));

    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("does not call onChange for an invalid calendar date", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Labeled value="" onChange={onChange} />);

    await user.type(screen.getByLabelText("The date"), "2026-02-30");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("The date")).toHaveAttribute("aria-invalid", "true");
  });

  it("opens a calendar grid and selects a day from it", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Labeled value="2026-08-01" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Open calendar" }));
    await user.click(await screen.findByRole("gridcell", { name: "15" }));

    expect(onChange).toHaveBeenCalledWith("2026-08-15");
  });

  it("disables days outside a max bound and does not select them", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Labeled value="2026-08-01" onChange={onChange} max="2026-08-10" />);

    await user.click(screen.getByRole("button", { name: "Open calendar" }));
    const outOfRangeDay = await screen.findByRole("gridcell", { name: "15" });

    expect(outOfRangeDay).toBeDisabled();
    await user.click(outOfRangeDay);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables days excluded by isDayDisabled and does not select them", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Labeled value="2026-08-01" onChange={onChange} isDayDisabled={isWeekend} />);

    await user.click(screen.getByRole("button", { name: "Open calendar" }));
    const saturday = await screen.findByRole("gridcell", { name: "15" });
    const monday = await screen.findByRole("gridcell", { name: "17" });

    expect(saturday).toBeDisabled();
    expect(monday).not.toBeDisabled();
    await user.click(saturday);
    expect(onChange).not.toHaveBeenCalled();

    await user.click(monday);
    expect(onChange).toHaveBeenCalledWith("2026-08-17");
  });

  it("blocks typing a date excluded by isDayDisabled, same as min/max", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Labeled value="" onChange={onChange} isDayDisabled={isWeekend} />);

    await user.type(screen.getByLabelText("The date"), "2026-08-15");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("The date")).toHaveAttribute("aria-invalid", "true");
  });

  it("closes on Escape and returns focus to the field", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Labeled value="2026-08-01" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Open calendar" }));
    expect(await screen.findByRole("dialog", { name: "Choose date" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Choose date" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("The date")).toHaveFocus();
  });

  it("renders and opens correctly when mounted inside a Modal", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={vi.fn()} title="Edit term">
        <Labeled value="2026-08-01" onChange={onChange} />
      </Modal>,
    );

    await user.click(screen.getByRole("button", { name: "Open calendar" }));
    const day = await screen.findByRole("gridcell", { name: "20" });
    await user.click(day);

    expect(onChange).toHaveBeenCalledWith("2026-08-20");
  });

  it("Escape closes the calendar without closing the surrounding Modal", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Edit term">
        <Labeled value="2026-08-01" onChange={vi.fn()} />
      </Modal>,
    );

    await user.click(screen.getByRole("button", { name: "Open calendar" }));
    expect(await screen.findByRole("dialog", { name: "Choose date" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Choose date" })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("adopts an external reset of value", () => {
    const { rerender } = render(<Labeled value="2026-08-01" onChange={vi.fn()} />);
    expect(screen.getByLabelText("The date")).toHaveValue("2026-08-01");

    rerender(<Labeled value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("The date")).toHaveValue("");
  });
});
