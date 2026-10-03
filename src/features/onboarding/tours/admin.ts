import type { TourDefinition } from "@/features/onboarding/types";

export const ADMIN_TOURS: TourDefinition[] = [
  {
    key: "admin.schools",
    version: 1,
    portal: "admin",
    kind: "page",
    title: "Schools",
    description: "Onboard schools and manage their subscriptions and admins.",
    area: "Platform",
    roles: ["SYSTEM_ADMIN"],
    route: "/admin/schools",
    navHref: "/admin/schools",
    steps: [
      {
        target: "page-header",
        title: "Every school on the platform",
        body: "Open a school to manage its subscription and school admins, or to impersonate a user for support.",
      },
      {
        target: "page-actions",
        title: "Onboard a school",
        body: "Create a school. It's seeded with its default classes, and you can then add its first school admin.",
      },
    ],
  },
  {
    key: "admin.packages",
    version: 1,
    portal: "admin",
    kind: "page",
    title: "Packages",
    description: "Define the plans schools subscribe to.",
    area: "Platform",
    roles: ["SYSTEM_ADMIN"],
    route: "/admin/packages",
    navHref: "/admin/packages",
    steps: [
      {
        target: "page-header",
        title: "Subscription packages",
        body: "A package sets a school's branch and student limits and which features it includes, such as billing, take-home quizzes or student logins.",
      },
      {
        target: "page-actions",
        title: "Add a package",
        body: "Create a monthly or annual plan. Activate and extend a school's subscription from that school's page.",
      },
    ],
  },
  {
    key: "admin.templates",
    version: 1,
    portal: "admin",
    kind: "page",
    title: "Result templates",
    description: "Design the report-card templates schools choose from.",
    area: "Platform",
    roles: ["SYSTEM_ADMIN"],
    route: "/admin/templates",
    navHref: "/admin/templates",
    steps: [
      {
        target: "page-header",
        title: "Report-card templates",
        body: "Design a template in the drag-and-drop designer. Make it available to every school, or bind it to one school.",
      },
      {
        target: "page-actions",
        title: "New template",
        body: "Start a template from scratch, then open it in the designer.",
      },
    ],
  },
];
