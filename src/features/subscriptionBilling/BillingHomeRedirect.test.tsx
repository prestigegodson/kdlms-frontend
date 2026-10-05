import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import type { Role } from "@/api/types";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { BillingHomeRedirect } from "./BillingHomeRedirect";

function renderAs(role: Role) {
  useAuthStore.setState({
    user: {
      id: "u1",
      email: "someone@example.com",
      firstName: "Ada",
      lastName: "Obi",
      role,
      schoolId: "tenant-1",
      emailVerified: true,
    },
  });
  render(
    <MemoryRouter initialEntries={["/billing"]}>
      <Routes>
        <Route path="/billing" element={<BillingHomeRedirect />} />
        <Route path="/creator/billing" element={<p>creator billing</p>} />
        <Route path="/school/subscription" element={<p>school billing</p>} />
        <Route path="*" element={<p>somewhere else</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BillingHomeRedirect", () => {
  beforeEach(() => {
    resetAuthStore();
  });

  it("sends a creator to Plan & billing", () => {
    renderAs("CREATOR");
    expect(screen.getByText("creator billing")).toBeInTheDocument();
  });

  it("sends a school admin to Subscription & billing", () => {
    renderAs("SCHOOL_ADMIN");
    expect(screen.getByText("school billing")).toBeInTheDocument();
  });

  it("sends anyone else to their portal home", () => {
    renderAs("TEACHER");
    expect(screen.getByText("somewhere else")).toBeInTheDocument();
  });
});
