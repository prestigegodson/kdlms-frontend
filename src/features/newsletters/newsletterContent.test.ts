import { describe, expect, it } from "vitest";
import { describeAudience, extractEmails, parseEmailList, previewHtml } from "./newsletterContent";

describe("previewHtml", () => {
  it("fills merge tags with sample values and adds the unsubscribe footer when the body has none", () => {
    const html = previewHtml("<html><body><p>Hi {{name}} of {{school_name}}</p></body></html>");

    expect(html).toContain("Hi Ada Obi of Greenwood Academy");
    expect(html).toContain("Unsubscribe</a></div></body>");
  });

  it("leaves the admin's own unsubscribe link alone", () => {
    const html = previewHtml('<p><a href="{{unsubscribe_url}}">Stop these</a></p>');

    expect(html).not.toContain("because you use KDLMS");
    expect(html).toContain('href="#unsubscribe"');
  });
});

describe("parseEmailList", () => {
  it("splits on commas and new lines, lower-cases, de-duplicates and reports invalid entries", () => {
    expect(parseEmailList("Ada@Example.com, bo@example.org\nada@example.com; nope")).toEqual({
      valid: ["ada@example.com", "bo@example.org"],
      invalid: ["nope"],
    });
  });
});

describe("extractEmails", () => {
  it("finds every address in a CSV whatever its columns", () => {
    expect(extractEmails('name,email\n"Ada Obi",ADA@example.com\nBo,bo@example.org\n')).toEqual([
      "ada@example.com",
      "bo@example.org",
    ]);
  });
});

describe("describeAudience", () => {
  it("summarises the chosen segments", () => {
    expect(
      describeAudience({
        schoolAdmins: true,
        schoolStatuses: ["ACTIVE"],
        packageIds: [],
        schoolIds: [],
        creators: true,
        customEmails: ["a@example.com"],
      }),
    ).toBe("School admins (filtered) · Tutors · 1 custom email");
  });
});
