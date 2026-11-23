import { describe, expect, it } from "vitest";
import { contactHref, splitName } from "@/features/creators/publicProfile";

describe("contactHref", () => {
  it("turns each kind of contact into a link", () => {
    expect(contactHref({ platform: "EMAIL", value: "ada@example.com" })).toBe("mailto:ada@example.com");
    expect(contactHref({ platform: "PHONE", value: "+234 (803) 000-0000" })).toBe("tel:+2348030000000");
    expect(contactHref({ platform: "WHATSAPP", value: "+234 803 000 0000" })).toBe("https://wa.me/2348030000000");
    expect(contactHref({ platform: "INSTAGRAM", value: "https://instagram.com/ada" })).toBe(
      "https://instagram.com/ada",
    );
  });
});

describe("splitName", () => {
  it("takes the first word as the first name and the rest as the last name", () => {
    expect(splitName("  Ada  Lovelace Byron ")).toEqual({ firstName: "Ada", lastName: "Lovelace Byron" });
    expect(splitName("Ada")).toEqual({ firstName: "Ada", lastName: "" });
  });
});
