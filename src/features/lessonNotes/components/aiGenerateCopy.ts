/** Separate from `AiGenerateSheet.tsx` so fast refresh doesn't warn about a file mixing a component with constants. */

/**
 * The hint field's wording - a school note narrows the Nigerian class a level spans, a creator's
 * class note (creators Phase C12) names who the lesson is for.
 */
export interface AiGenerateCopy {
  description: string;
  hintLabel: string;
  hintPlaceholder: string;
}

export const SCHOOL_AI_COPY: AiGenerateCopy = {
  description:
    "Drafts a lesson note aligned to the Nigerian NERDC/UBE curriculum. Review and adjust it before saving - this doesn't save anything on its own.",
  hintLabel: "Class (optional)",
  hintPlaceholder:
    "e.g. JSS 2 - narrows the curriculum level if this level spans more than one Nigerian class",
};

export const CREATOR_AI_COPY: AiGenerateCopy = {
  description:
    "Drafts a lesson note for this session from your class details and topic. Review and adjust it before saving - this doesn't save anything on its own.",
  hintLabel: "Audience (optional)",
  hintPlaceholder: "e.g. adult beginners, or 12-14 year olds",
};

/** The AI remark sheet's wording (insights Phase I5) - it has no topic or hint field, only extra instructions. */
export interface AiRemarkCopy {
  description: string;
  extraInstructionsPlaceholder: string;
}

export const REMARK_AI_COPY: AiRemarkCopy = {
  description:
    "Drafts a class teacher's remark from this pupil's scores, behaviour ratings, attendance and insights, using their first name only. Review and edit it, then save the remarks as usual - this doesn't save anything on its own.",
  extraInstructionsPlaceholder: "e.g. mention their improvement in reading, or keep it brief",
};
