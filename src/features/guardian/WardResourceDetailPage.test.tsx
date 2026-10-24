import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import type { MyLearningResourceView } from "@/api/learning";
import * as wardsApi from "@/api/wards";
import { WardResourceDetailPage } from "@/features/guardian/WardResourceDetailPage";

vi.mock("@/api/wards", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/wards")>()),
  getWardLearningResource: vi.fn(),
  downloadWardLearningResourceBlob: vi.fn(),
  getWardLearningResourceMediaUrl: vi.fn(),
}));

const NOTES: MyLearningResourceView = {
  id: "r1",
  title: "Reading notes",
  description: "Read before Monday",
  subjectName: "English",
  resourceType: "RICH_TEXT",
  bodyHtml: "<p>Chapter one</p>",
  youtubeVideoId: null,
  durationSeconds: null,
  fileSizeBytes: null,
  commentsEnabled: true,
  completed: true,
  positionSeconds: null,
};

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ path: "/guardian/resources/:studentId/:resourceId", element: <WardResourceDetailPage /> }],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

describe("WardResourceDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the ward's resource read-only with their progress", async () => {
    vi.mocked(wardsApi.getWardLearningResource).mockResolvedValue(NOTES);

    renderAt("/guardian/resources/s1/r1");

    expect(await screen.findByText("Chapter one")).toBeInTheDocument();
    expect(wardsApi.getWardLearningResource).toHaveBeenCalledWith("s1", "r1");
    expect(screen.getByText("Your ward has marked this as done")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark as/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows an error when the resource can't be read", async () => {
    vi.mocked(wardsApi.getWardLearningResource).mockRejectedValue(
      new ApiError(404, "Learning resource not found"),
    );

    renderAt("/guardian/resources/s1/missing");

    expect(await screen.findByText("Learning resource not found")).toBeInTheDocument();
  });
});
