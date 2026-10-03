import type { TourDefinition } from "@/features/onboarding/types";

const ACCOUNT_STEPS = [
  {
    target: "help",
    title: "Help is always here",
    body: "Tap the question mark any time to replay the guide for the page you're on, or browse every how-to guide.",
  },
  {
    target: "account-menu",
    title: "Your account",
    body: "Change your password, open the how-to guides, or sign out from your account menu.",
  },
];

export const SHELL_TOURS: TourDefinition[] = [
  {
    key: "shell.school",
    version: 1,
    portal: "school",
    kind: "shell",
    title: "Welcome tour",
    description: "Find your way around the school portal: navigation, the current term, help and your account.",
    area: "Getting started",
    roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN", "TEACHER", "INVENTORY_MANAGER"],
    steps: [
      {
        title: "Welcome to your school portal",
        body: "This short tour shows you where everything lives. It takes less than a minute, and you can skip it at any time.",
      },
      {
        target: "sidebar",
        mobileTarget: "tabbar",
        roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN"],
        title: "Everything in one menu",
        body: "Academics holds sessions, classes, subjects, scores and reports. People holds staff, students and guardians. Administration holds your school's settings, fees and subscription.",
      },
      {
        target: "sidebar",
        mobileTarget: "tabbar",
        roles: ["TEACHER"],
        title: "Your teaching tools",
        body: "From here you can record scores, take attendance, write remarks and message guardians. You'll only see the classes and subjects you're assigned to.",
      },
      {
        target: "sidebar",
        mobileTarget: "tabbar",
        roles: ["INVENTORY_MANAGER"],
        title: "Your store",
        body: "Inventory is where you track stock, issue items and raise purchase requests. Students gives you a read-only view of the branch's registry.",
      },
      {
        target: "more",
        only: "mobile",
        title: "More pages",
        body: "Your most-used pages sit on the bottom bar. Tap More to see everything else.",
      },
      {
        target: "context",
        roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN", "TEACHER"],
        title: "The current term",
        body: "Every score, rating and attendance mark is filed under the current session and term, shown here. School admins change it under Sessions & Terms.",
      },
      ...ACCOUNT_STEPS,
      {
        title: "You're all set",
        body: "Short guides will pop up the first time you open key pages. You can turn them off, or replay them, from the help menu.",
      },
    ],
  },
  {
    key: "shell.guardian",
    version: 1,
    portal: "guardian",
    kind: "shell",
    title: "Welcome tour",
    description: "Find your children's results, bills and messages, and learn where help lives.",
    area: "Getting started",
    roles: ["GUARDIAN"],
    steps: [
      {
        title: "Welcome",
        body: "This is where you follow your children's progress at school. Let's take a quick look around.",
      },
      {
        target: "sidebar",
        mobileTarget: "tabbar",
        title: "Your children at a glance",
        body: "See your wards, their published results, bills and messages from their teachers. If your children attend different schools, you'll see all of them here.",
      },
      {
        target: "more",
        only: "mobile",
        title: "More pages",
        body: "Payments, timetables, attendance and notification settings are under More.",
      },
      ...ACCOUNT_STEPS,
      {
        title: "You're all set",
        body: "You can replay this tour, or any other guide, from the help menu.",
      },
    ],
  },
  {
    key: "shell.student",
    version: 1,
    portal: "student",
    kind: "shell",
    title: "Welcome tour",
    description: "Find your learning resources, quizzes and results.",
    area: "Getting started",
    roles: ["STUDENT"],
    steps: [
      {
        title: "Welcome",
        body: "This is your student portal. Let's take a quick look around.",
      },
      {
        target: "sidebar",
        mobileTarget: "tabbar",
        title: "Your learning",
        body: "Resources holds what your teachers have shared with you. Quizzes holds take-home quizzes to complete. Results shows your published report cards.",
      },
      ...ACCOUNT_STEPS,
      {
        title: "You're all set",
        body: "Replay this tour any time from the help menu.",
      },
    ],
  },
  {
    key: "shell.admin",
    version: 1,
    portal: "admin",
    kind: "shell",
    title: "Welcome tour",
    description: "Find your way around the platform admin console.",
    area: "Getting started",
    roles: ["SYSTEM_ADMIN"],
    steps: [
      {
        title: "Welcome to the admin console",
        body: "This is where you run the platform: schools, packages, result templates and platform settings.",
      },
      {
        target: "sidebar",
        mobileTarget: "tabbar",
        title: "Platform menu",
        body: "Onboard and manage schools, set up subscription packages, and design result templates. Support contact and AI settings are at the bottom.",
      },
      {
        target: "more",
        only: "mobile",
        title: "More pages",
        body: "Support contact and AI settings are under More.",
      },
      ...ACCOUNT_STEPS,
      {
        title: "You're all set",
        body: "Replay this tour, or any other guide, from the help menu.",
      },
    ],
  },
];
