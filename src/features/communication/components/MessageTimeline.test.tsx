import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MessageView } from "@/api/communication";
import { MessageRow } from "./MessageTimeline";

const base: MessageView = {
  messageId: "m1",
  threadId: "t1",
  authorId: "u1",
  authorName: "Tess Tutor",
  authorRole: "CREATOR",
  body: "No class next week",
  createdAt: "2026-10-05T08:00:00Z",
  canEdit: false,
  editableUntil: "2026-10-05T08:15:00Z",
};

describe("MessageRow", () => {
  it("labels a creator as the tutor and marks an announcement copy", () => {
    render(<MessageRow message={{ ...base, announcement: true }} indented={false} onEdit={async () => {}} />);

    expect(screen.getByText("Tutor")).toBeInTheDocument();
    expect(screen.getByText("Announcement")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
  });

  it("labels a learner's message and offers no announcement badge on a direct message", () => {
    render(<MessageRow message={{ ...base, authorRole: "LEARNER", canEdit: true }} indented={false} onEdit={async () => {}} />);

    expect(screen.getByText("Learner")).toBeInTheDocument();
    expect(screen.queryByText("Announcement")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
  });
});
