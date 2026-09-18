import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as learningApi from "@/api/learning";
import type { ResourceCompletionsView } from "@/api/learning";
import { CompletionsModal } from "@/features/learning/components/CompletionsModal";

vi.mock("@/api/learning", async () => {
  const actual = await vi.importActual<typeof import("@/api/learning")>("@/api/learning");
  return { ...actual, getLearningResourceCompletions: vi.fn() };
});

const COMPLETIONS: ResourceCompletionsView = {
  resourceId: "resource-1",
  title: "Fractions Explainer",
  totalStudents: 2,
  completedCount: 1,
  students: [
    {
      studentId: "student-1",
      studentName: "Ada Obi",
      admissionNumber: "SCH/2026/0001",
      completed: true,
      completedAt: "2026-09-02T10:00:00Z",
      positionSeconds: null,
      lastOpenedAt: "2026-09-02T10:00:00Z",
    },
    {
      studentId: "student-2",
      studentName: "Bola Musa",
      admissionNumber: "SCH/2026/0002",
      completed: false,
      completedAt: null,
      positionSeconds: null,
      lastOpenedAt: null,
    },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("CompletionsModal", () => {
  it("loads and renders the resource's completion roster, titled with the resource name", async () => {
    vi.mocked(learningApi.getLearningResourceCompletions).mockResolvedValue(COMPLETIONS);

    render(<CompletionsModal resourceId="resource-1" onClose={vi.fn()} />);

    expect(await screen.findByText("Completions · Fractions Explainer")).toBeInTheDocument();
    expect(screen.getByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("Bola Musa")).toBeInTheDocument();
  });

  it("shows an error message when the load fails", async () => {
    vi.mocked(learningApi.getLearningResourceCompletions).mockRejectedValue(new Error("network down"));

    render(<CompletionsModal resourceId="resource-1" onClose={vi.fn()} />);

    expect(await screen.findByText("Failed to load completions")).toBeInTheDocument();
  });
});
