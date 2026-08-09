import { beforeEach, describe, expect, it } from "vitest";
import { resetAppBarStore, useAppBarStore } from "@/stores/appBarStore";

describe("appBarStore", () => {
  beforeEach(() => {
    resetAppBarStore();
  });

  it("claim publishes the title, backTo, and owner", () => {
    useAppBarStore.getState().claim("a", "Students", "/school");

    expect(useAppBarStore.getState()).toMatchObject({
      ownerId: "a",
      title: "Students",
      backTo: "/school",
    });
  });

  it("a later claim always wins, regardless of the previous owner", () => {
    useAppBarStore.getState().claim("a", "A", null);
    useAppBarStore.getState().claim("b", "B", "/school");

    expect(useAppBarStore.getState()).toMatchObject({
      ownerId: "b",
      title: "B",
      backTo: "/school",
    });
  });

  it("release is a no-op unless the caller is still the current owner - a stale unmount can't clobber the next page", () => {
    useAppBarStore.getState().claim("a", "A", null);
    useAppBarStore.getState().claim("b", "B", null);

    useAppBarStore.getState().release("a");

    expect(useAppBarStore.getState()).toMatchObject({ ownerId: "b", title: "B" });
  });

  it("release clears the entry when the caller is still the current owner", () => {
    useAppBarStore.getState().claim("a", "A", "/back");

    useAppBarStore.getState().release("a");

    expect(useAppBarStore.getState()).toMatchObject({
      ownerId: null,
      title: null,
      backTo: null,
    });
  });
});
