import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StatusSegments } from "@/features/attendance/components/StatusSegments";

describe("StatusSegments", () => {
  it("renders one segment per status, none selected when no value is set", () => {
    render(<StatusSegments id="att-0" studentName="Ada Obi" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /Present/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: /Absent/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: /Late/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: /Excused/ })).toHaveAttribute("aria-checked", "false");
  });

  it("marks the matching segment checked once a value is set", () => {
    render(<StatusSegments id="att-0" value="ABSENT" studentName="Ada Obi" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /Absent/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Present/ })).toHaveAttribute("aria-checked", "false");
  });

  it("clicking a segment reports the status and advances", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onAdvance = vi.fn();
    render(
      <StatusSegments id="att-0" studentName="Ada Obi" onChange={onChange} onAdvance={onAdvance} />,
    );

    await user.click(screen.getByRole("radio", { name: /Late/ }));

    expect(onChange).toHaveBeenCalledWith("LATE");
    expect(onAdvance).toHaveBeenCalled();
  });

  it("the L key sets Late from anywhere in the group and advances", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onAdvance = vi.fn();
    render(
      <StatusSegments id="att-0" studentName="Ada Obi" onChange={onChange} onAdvance={onAdvance} />,
    );

    await user.click(screen.getByRole("radio", { name: /Present/ }));
    onChange.mockClear();
    await user.keyboard("l");

    expect(onChange).toHaveBeenCalledWith("LATE");
    expect(onAdvance).toHaveBeenCalled();
  });

  it("an unrelated key is ignored", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StatusSegments id="att-0" studentName="Ada Obi" onChange={onChange} />);

    screen.getByRole("radio", { name: /Present/ }).focus();
    await user.keyboard("z");

    expect(onChange).not.toHaveBeenCalled();
  });
});
