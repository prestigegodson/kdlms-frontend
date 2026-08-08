import type { BloodGroup, Genotype } from "@/api/students";

/** Separate from the panel/modal components so fast refresh doesn't warn about a file mixing a component with plain helpers - mirrors `communication/messageCategory.ts`. */
export const BLOOD_GROUPS: { value: BloodGroup; label: string }[] = [
  { value: "A_POSITIVE", label: "A+" },
  { value: "A_NEGATIVE", label: "A-" },
  { value: "B_POSITIVE", label: "B+" },
  { value: "B_NEGATIVE", label: "B-" },
  { value: "AB_POSITIVE", label: "AB+" },
  { value: "AB_NEGATIVE", label: "AB-" },
  { value: "O_POSITIVE", label: "O+" },
  { value: "O_NEGATIVE", label: "O-" },
];

export const GENOTYPES: { value: Genotype; label: string }[] = [
  { value: "AA", label: "AA" },
  { value: "AS", label: "AS" },
  { value: "SS", label: "SS" },
  { value: "AC", label: "AC" },
  { value: "SC", label: "SC" },
];

const BLOOD_GROUP_LABEL: Record<BloodGroup, string> = Object.fromEntries(
  BLOOD_GROUPS.map((option) => [option.value, option.label]),
) as Record<BloodGroup, string>;

export function bloodGroupLabel(bloodGroup: BloodGroup | undefined): string | undefined {
  return bloodGroup ? BLOOD_GROUP_LABEL[bloodGroup] : undefined;
}
