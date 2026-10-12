import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/ui/PageHeader";

describe("PageHeader", () => {
  it("shows a desktop back link when given both backTo and backLabel", () => {
    render(
      <MemoryRouter>
        <PageHeader title="Fractions quiz" backTo="/school/take-home-quizzes" backLabel="Back to CBT/Quizzes" />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Back to CBT/Quizzes" });
    expect(link).toHaveAttribute("href", "/school/take-home-quizzes");
    // The mobile app bar already carries a back chevron, so the link is `lg`-and-up only.
    expect(link.className).toContain("hidden");
    expect(link.className).toContain("lg:inline-flex");
  });

  it("leaves backTo to the mobile app bar alone when no backLabel is given", () => {
    render(
      <MemoryRouter>
        <PageHeader title="Student" backTo="/school/students" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
