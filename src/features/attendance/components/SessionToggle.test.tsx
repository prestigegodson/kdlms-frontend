import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionToggle } from "@/features/attendance/components/SessionToggle";

describe("SessionToggle", () => {
  it("marks the selected session and reports a newly picked one", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SessionToggle session="MORNING" onChange={onChange} />);

    expect(screen.getByRole("radio", { name: "Morning" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("radio", { name: "All day" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Afternoon" }));

    expect(onChange).toHaveBeenCalledWith("AFTERNOON");
  });

  it("offers an All day option that reports null when includeAll is set", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SessionToggle session="AFTERNOON" onChange={onChange} includeAll />);

    await user.click(screen.getByRole("radio", { name: "All day" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
