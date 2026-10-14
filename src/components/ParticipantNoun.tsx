import { createContext, useContext, type ReactNode } from "react";

/**
 * What the person taking a quiz or reading a resource is called. Schools say "pupil"; a creator's
 * classes say "learner". Components shared by both portals (quiz review, question authoring, resource
 * completions) read it from here instead of hard-coding one word. The default is "pupil", and the
 * creator/learner shells and the guardian's online-class pages provide "learner".
 */
export type ParticipantNoun = "pupil" | "learner";

const ParticipantNounContext = createContext<ParticipantNoun>("pupil");

export function ParticipantNounProvider({ noun, children }: { noun: ParticipantNoun; children: ReactNode }) {
  return <ParticipantNounContext.Provider value={noun}>{children}</ParticipantNounContext.Provider>;
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export function useParticipantNoun() {
  const noun = useContext(ParticipantNounContext);
  return {
    singular: noun,
    plural: `${noun}s`,
    Singular: capitalize(noun),
    Plural: capitalize(`${noun}s`),
    /** Rewrites "pupil"/"Pupils"/... in school-worded copy (e.g. shared field help) to the current noun. */
    adapt: (text: string) =>
      noun === "pupil"
        ? text
        : text.replace(/\b([Pp])upil(s?)\b/g, (_, p: string, s: string) => (p === "P" ? capitalize(noun) : noun) + s),
  };
}
