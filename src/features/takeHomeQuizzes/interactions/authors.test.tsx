import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CategorizeAuthor } from "./categorize/Author";
import { blankCategorize } from "./categorize/defaults";
import type { CategorizeConfig } from "./categorize/types";
import { DiagramLabelAuthor } from "./diagramLabel/Author";
import type { DiagramLabelConfig } from "./diagramLabel/types";
import { HotspotAuthor } from "./hotspot/Author";
import type { HotspotConfig } from "./hotspot/types";
import { MatchingAuthor } from "./matching/Author";
import { blankMatching } from "./matching/defaults";
import type { MatchingConfig } from "./matching/types";
import { SequenceAuthor } from "./sequence/Author";
import { blankSequence } from "./sequence/defaults";
import type { SequenceConfig } from "./sequence/types";

vi.mock("@/components/richText/AuthenticatedRichImage", () => ({ AuthenticatedRichImage: () => null }));

// The authors mount a real TipTap editor per label - the same jsdom geometry polyfills as
// ChoiceOptionsField.test.tsx.
beforeAll(() => {
  document.elementFromPoint = () => null;
  Range.prototype.getBoundingClientRect = () =>
    ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
  Range.prototype.getClientRects = () =>
    ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
});

/** Controlled harnesses that report every change, so a test can read the author's latest config. */
function SequenceHarness({ initial, onValue }: { initial: SequenceConfig; onValue(config: SequenceConfig): void }) {
  const [value, setValue] = useState(initial);
  return (
    <SequenceAuthor
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
      disabled={false}
      idPrefix="q1"
    />
  );
}

function MatchingHarness({ initial, onValue }: { initial: MatchingConfig; onValue(config: MatchingConfig): void }) {
  const [value, setValue] = useState(initial);
  return (
    <MatchingAuthor
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
      disabled={false}
      idPrefix="q1"
    />
  );
}

function CategorizeHarness({
  initial,
  onValue,
}: {
  initial: CategorizeConfig;
  onValue(config: CategorizeConfig): void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <CategorizeAuthor
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
      disabled={false}
      idPrefix="q1"
    />
  );
}

describe("SequenceAuthor", () => {
  it("adds, captions, reorders and removes items, and switches to a timeline", async () => {
    const initial = blankSequence();
    let latestSequence = initial;
    render(<SequenceHarness initial={initial} onValue={(next) => (latestSequence = next)} />);
    const user = userEvent.setup();
    const [first, second] = latestSequence.items;

    await user.click(screen.getByRole("button", { name: "Add item" }));
    expect(latestSequence.items).toHaveLength(4);

    await user.type(screen.getByLabelText("Item 1 caption, shown only in review"), "1914");
    expect(latestSequence.items[0].caption).toBe("1914");

    await user.click(screen.getByRole("button", { name: "Move item 1 down" }));
    expect(latestSequence.items.slice(0, 2).map((item) => item.id)).toEqual([second.id, first.id]);

    await user.click(screen.getByRole("button", { name: "Remove item 4" }));
    expect(latestSequence.items).toHaveLength(3);

    await user.selectOptions(screen.getByLabelText("Shown as"), "TIMELINE");
    expect(latestSequence.presentation).toBe("TIMELINE");
  });
});

describe("MatchingAuthor", () => {
  it("pairs each prompt with an answer, adds a distractor, and unpairs a removed answer", async () => {
    const initial = blankMatching();
    let latestMatching = initial;
    render(<MatchingHarness initial={initial} onValue={(next) => (latestMatching = next)} />);
    const user = userEvent.setup();
    const [firstRight, secondRight] = latestMatching.rights;
    expect(latestMatching.lefts.map((left) => left.rightId)).toEqual([firstRight.id, secondRight.id]);

    await user.click(screen.getByRole("button", { name: "Add a distractor answer" }));
    expect(latestMatching.rights).toHaveLength(3);
    expect(latestMatching.lefts).toHaveLength(2);

    const distractor = latestMatching.rights[2];
    await user.selectOptions(screen.getByLabelText("Prompt 2 matches"), distractor.id);
    expect(latestMatching.lefts[1].rightId).toBe(distractor.id);

    await user.click(screen.getByRole("button", { name: "Remove answer A" }));
    expect(latestMatching.lefts[0].rightId).toBeNull();

    await user.click(screen.getByLabelText("One answer can match more than one prompt"));
    expect(latestMatching.reuseRights).toBe(true);
  });
});

describe("CategorizeAuthor", () => {
  it("adds a group and an item, assigns it, and ungroups the items of a removed group", async () => {
    const initial = blankCategorize();
    let latest = initial;
    render(<CategorizeHarness initial={initial} onValue={(next) => (latest = next)} />);
    const user = userEvent.setup();
    const [first, second] = latest.groups;
    expect(latest.items.map((item) => item.groupId)).toEqual([first.id, second.id, first.id, second.id]);
    expect(screen.queryByRole("button", { name: "Remove group A" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add a group" }));
    expect(latest.groups).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Add an item" }));
    expect(latest.items).toHaveLength(5);
    expect(latest.items[4].groupId).toBeNull();

    const third = latest.groups[2];
    await user.selectOptions(screen.getByLabelText("Item 5 belongs in"), third.id);
    expect(latest.items[4].groupId).toBe(third.id);

    await user.click(screen.getByRole("button", { name: "Remove group A" }));
    expect(latest.groups.map((group) => group.id)).toEqual([second.id, third.id]);
    expect(latest.items.map((item) => item.groupId)).toEqual([null, second.id, null, second.id, third.id]);

    await user.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(latest.items).toHaveLength(4);
  });
});

/** A controlled harness for any author, reporting each change. */
function AuthorHarness<C>({
  Author,
  initial,
  onValue,
}: {
  Author: (props: { value: C; onChange(config: C): void; disabled: boolean; idPrefix: string }) => React.ReactNode;
  initial: C;
  onValue(config: C): void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Author
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
      disabled={false}
      idPrefix="q1"
    />
  );
}

describe("DiagramLabelAuthor", () => {
  it("ticks a zone's right label, adds a label, and unticks a removed one", async () => {
    const initial: DiagramLabelConfig = {
      schemaVersion: 1,
      imageFileId: "img",
      imageAspect: 1.5,
      zones: [{ id: "z1", shape: { kind: "RECT", x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, acceptedLabelIds: [] }],
      labels: [
        { id: "n", html: "<p>Nucleus</p>" },
        { id: "w", html: "<p>Cell wall</p>" },
      ],
      reuseLabels: false,
    };
    let latest = initial;
    render(<AuthorHarness Author={DiagramLabelAuthor} initial={initial} onValue={(next) => (latest = next)} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("A. Nucleus"));
    expect(latest.zones[0].acceptedLabelIds).toEqual(["n"]);

    await user.click(screen.getByRole("button", { name: "Add a label" }));
    expect(latest.labels).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Remove label A" }));
    expect(latest.labels.map((label) => label.id)).not.toContain("n");
    expect(latest.zones[0].acceptedLabelIds).toEqual([]);

    await user.click(screen.getByLabelText("One label can go on more than one zone"));
    expect(latest.reuseLabels).toBe(true);
    expect(screen.queryByRole("button", { name: "Circle" })).not.toBeInTheDocument();
  });
});

describe("HotspotAuthor", () => {
  it("names a region, flips it to a target, and keeps the pin allowance in range", async () => {
    const initial: HotspotConfig = {
      schemaVersion: 1,
      imageFileId: "img",
      imageAspect: 1,
      maxPins: 1,
      regions: [
        { id: "a", shape: { kind: "RECT", x: 0.1, y: 0.1, w: 0.1, h: 0.1 }, target: true, label: null },
        { id: "b", shape: { kind: "CIRCLE", cx: 0.6, cy: 0.6, r: 0.1 }, target: false, label: null },
      ],
    };
    let latest = initial;
    render(<AuthorHarness Author={HotspotAuthor} initial={initial} onValue={(next) => (latest = next)} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Region 2 name"), "<Sea>");
    expect(latest.regions[1].label).toBe("<p>&lt;Sea&gt;</p>");

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["1", "2", "3", "4"]);
    await user.click(screen.getAllByLabelText("Target")[1]);
    expect(latest.regions[1].target).toBe(true);
    expect(latest.maxPins).toBe(2);

    await user.selectOptions(screen.getByLabelText("Pins a student may place"), "5");
    expect(latest.maxPins).toBe(5);
  });
});
