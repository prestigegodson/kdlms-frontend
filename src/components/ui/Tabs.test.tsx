import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "@/components/ui/Tabs";

describe("Tabs", () => {
  it("shows a count badge only when it's above zero, capped at 99+", () => {
    render(
      <Tabs
        ariaLabel="Views"
        value="a"
        onChange={vi.fn()}
        items={[
          { value: "a", label: "Bills", badge: 0 },
          { value: "b", label: "Payments", badge: 3 },
          { value: "c", label: "Queue", badge: 150 },
        ]}
      />,
    );

    expect(screen.getByRole("tab", { name: "Bills" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Payments (3 pending)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Queue (99+ pending)" })).toBeInTheDocument();
  });
});
