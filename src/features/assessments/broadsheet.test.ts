import { describe, expect, it } from "vitest";
import type { BroadsheetView } from "@/api/assessments";
import { broadsheetPrintTitle, broadsheetToCsv } from "@/features/assessments/broadsheet";

const BOM = "﻿";

/** The CSV's lines, BOM stripped and the trailing CRLF dropped. */
function csvLines(csv: string): string[] {
  expect(csv.startsWith(BOM)).toBe(true);
  return csv.slice(1).replace(/\r\n$/, "").split("\r\n");
}

const NUMERIC_BROADSHEET: BroadsheetView = {
  classId: "class-1",
  termId: "term-1",
  assessmentMode: "NUMERIC",
  subjects: [
    { subjectId: "math", name: "Mathematics", code: "MTH" },
    { subjectId: "eng", name: "English" },
  ],
  rows: [
    {
      enrollmentId: "e-2",
      studentId: "s-2",
      studentName: "Bola Eze",
      admissionNumber: "SCH/2",
      subjectResults: [{ subjectId: "math", finalScore: 60, grade: "B" }],
      total: 60,
      average: 60,
      position: 2,
    },
    {
      enrollmentId: "e-1",
      studentId: "s-1",
      studentName: "Ada Obi",
      admissionNumber: "SCH/1",
      subjectResults: [
        { subjectId: "math", finalScore: 90, grade: "A" },
        { subjectId: "eng", finalScore: 80, grade: "A" },
      ],
      total: 170,
      average: 85,
      position: 1,
    },
  ],
};

describe("broadsheetToCsv", () => {
  it("writes a numeric TERM broadsheet in position order, with grades and aggregate columns", () => {
    expect(csvLines(broadsheetToCsv(NUMERIC_BROADSHEET, "TERM"))).toEqual([
      "Pupil,Admission no.,MTH,English,Total,Average,Position",
      "Ada Obi,SCH/1,90 (A),80 (A),170,85,1",
      "Bola Eze,SCH/2,60 (B),—,60,60,2",
    ]);
  });

  it("marks a special-needs pupil (SN) and sorts them, unranked, after the ranked pupils", () => {
    const withSpecialNeeds: BroadsheetView = {
      ...NUMERIC_BROADSHEET,
      rows: [
        {
          enrollmentId: "e-3",
          studentId: "s-3",
          studentName: "Chidi Okafor",
          admissionNumber: "SCH/3",
          subjectResults: [{ subjectId: "math", finalScore: 95, grade: "A" }],
          total: 95,
          average: 95,
          specialNeeds: true,
        },
        ...NUMERIC_BROADSHEET.rows,
      ],
    };

    expect(csvLines(broadsheetToCsv(withSpecialNeeds, "TERM"))).toEqual([
      "Pupil,Admission no.,MTH,English,Total,Average,Position",
      "Ada Obi,SCH/1,90 (A),80 (A),170,85,1",
      "Bola Eze,SCH/2,60 (B),—,60,60,2",
      "Chidi Okafor (SN),SCH/3,95 (A),—,95,95,—",
    ]);
  });

  it("writes a MIDTERM broadsheet with the score max in the header and no aggregates", () => {
    const midterm: BroadsheetView = {
      ...NUMERIC_BROADSHEET,
      subjects: [{ subjectId: "math", name: "Mathematics", code: "MTH" }],
      rows: [
        {
          enrollmentId: "e-1",
          studentId: "s-1",
          studentName: "Ada Obi",
          admissionNumber: "SCH/1",
          subjectResults: [{ subjectId: "math", finalScore: 18, scoreMax: 20 }],
        },
      ],
    };

    expect(csvLines(broadsheetToCsv(midterm, "MIDTERM"))).toEqual(["Pupil,Admission no.,MTH (20)", "Ada Obi,SCH/1,18"]);
  });

  it("writes rating labels for a qualitative class", () => {
    const qualitative: BroadsheetView = {
      classId: "class-2",
      termId: "term-1",
      assessmentMode: "QUALITATIVE",
      subjects: [{ subjectId: "num", name: "Numeracy", code: "NUM" }],
      rows: [
        {
          enrollmentId: "e-1",
          studentId: "s-1",
          studentName: "Zara Bello",
          admissionNumber: "SCH/3",
          subjectResults: [{ subjectId: "num", ratingLabel: "Meets Expectation" }],
        },
      ],
    };

    expect(csvLines(broadsheetToCsv(qualitative))).toEqual(["Pupil,Admission no.,NUM", "Zara Bello,SCH/3,Meets Expectation"]);
  });

  it("appends a class-average row when the school shows class averages", () => {
    const withAverages: BroadsheetView = {
      ...NUMERIC_BROADSHEET,
      subjects: [
        { subjectId: "math", name: "Mathematics", code: "MTH", classAverage: 75 },
        { subjectId: "eng", name: "English", classAverage: 80 },
      ],
    };

    expect(csvLines(broadsheetToCsv(withAverages, "TERM")).at(-1)).toBe("Class average,,75,80,,,");
  });

  it("quotes fields holding commas or quotes", () => {
    const awkward: BroadsheetView = {
      ...NUMERIC_BROADSHEET,
      rows: [{ ...NUMERIC_BROADSHEET.rows[1], studentName: 'Obi, Ada "Adaeze"' }],
    };

    expect(csvLines(broadsheetToCsv(awkward, "TERM"))[1]).toBe('"Obi, Ada ""Adaeze""",SCH/1,90 (A),80 (A),170,85,1');
  });
});

describe("broadsheetPrintTitle", () => {
  it("names the class, session, and term, flagging a mid-term broadsheet", () => {
    const labels = { sessionName: "2026/2027", termName: "First Term" };

    expect(broadsheetPrintTitle("Primary 1A", labels, "TERM")).toBe("Primary 1A - 2026/2027, First Term");
    expect(broadsheetPrintTitle("Primary 1A", labels, "MIDTERM")).toBe("Primary 1A - 2026/2027, First Term (Mid-term)");
  });
});
