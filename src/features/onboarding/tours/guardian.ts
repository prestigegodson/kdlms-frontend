import type { TourDefinition } from "@/features/onboarding/types";

export const GUARDIAN_TOURS: TourDefinition[] = [
  {
    key: "guardian.wards",
    version: 1,
    portal: "guardian",
    kind: "page",
    title: "Your wards",
    description: "The children linked to your account.",
    area: "Getting started",
    roles: ["GUARDIAN"],
    route: "/guardian",
    navHref: "/guardian",
    steps: [
      {
        target: "page-header",
        title: "Your children",
        body: "Every child linked to your account appears here, even if they attend different schools. If one is missing, contact their school.",
      },
    ],
  },
  {
    key: "guardian.results",
    version: 1,
    portal: "guardian",
    kind: "page",
    title: "Results",
    description: "Read and download your child's published report cards.",
    area: "Your child's school",
    roles: ["GUARDIAN"],
    route: "/guardian/results",
    navHref: "/guardian/results",
    steps: [
      {
        target: "page-header",
        title: "Report cards",
        body: "Choose a child, then a session and term, to read their result. A term's result appears once the school publishes it, and you can download it as a PDF.",
      },
    ],
  },
  {
    key: "guardian.bills",
    version: 1,
    portal: "guardian",
    kind: "page",
    title: "Bills",
    description: "See each term's bill, what's paid and what's left.",
    area: "Fees",
    roles: ["GUARDIAN"],
    route: "/guardian/bills",
    navHref: "/guardian/bills",
    steps: [
      {
        target: "page-header",
        title: "Termly bills",
        body: "Each card shows a term's bill, how much is confirmed paid and the balance.",
      },
      {
        target: "page-actions",
        title: "Log a payment",
        body: "Paid the school? Upload your proof of payment here. The school confirms it, and your receipt is emailed to you.",
      },
    ],
  },
  {
    key: "guardian.payments",
    version: 1,
    portal: "guardian",
    kind: "page",
    title: "Payments",
    description: "Track every payment you've logged and its status.",
    area: "Fees",
    roles: ["GUARDIAN"],
    route: "/guardian/payments",
    navHref: "/guardian/payments",
    steps: [
      {
        target: "page-header",
        title: "Payment history",
        body: "Every payment you've logged, for all your children, with its status. You can edit or withdraw a payment while it's still pending.",
      },
    ],
  },
  {
    key: "guardian.messages",
    version: 1,
    portal: "guardian",
    kind: "page",
    title: "Messages",
    description: "Read and reply to notes from your child's teachers.",
    area: "Your child's school",
    roles: ["GUARDIAN"],
    route: "/guardian/messages",
    navHref: "/guardian/messages",
    steps: [
      {
        target: "page-header",
        title: "Notes from school",
        body: "Teachers log notes about your child here. Open a conversation to read it and reply.",
      },
    ],
  },
];
