import type { TourDefinition } from "@/features/onboarding/types";

export const STUDENT_TOURS: TourDefinition[] = [
  {
    key: "student.resources",
    version: 1,
    portal: "student",
    kind: "page",
    title: "Resources",
    description: "Open what your teachers have shared and mark it done.",
    area: "Learning",
    roles: ["STUDENT"],
    route: "/student/resources",
    navHref: "/student/resources",
    steps: [
      {
        target: "page-header",
        title: "Learning resources",
        body: "Notes, PDFs, audio and videos from your teachers, by subject. Open one to study it, mark it done, and ask questions in the comments.",
      },
    ],
  },
  {
    key: "student.quizzes",
    version: 1,
    portal: "student",
    kind: "page",
    title: "Quizzes",
    description: "Take your CBT/Quizzes before the deadline.",
    area: "Learning",
    roles: ["STUDENT"],
    route: "/student/quizzes",
    navHref: "/student/quizzes",
    steps: [
      {
        target: "page-header",
        title: "CBT/Quizzes",
        body: "Each quiz shows its deadline. Once you start, the timer keeps running, so make sure you have enough time to finish.",
      },
    ],
  },
];
