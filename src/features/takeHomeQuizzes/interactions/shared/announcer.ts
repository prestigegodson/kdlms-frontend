import { createContext, useContext, useMemo } from "react";

export type Announce = (message: string) => void;

export const AnnouncerContext = createContext<Announce | null>(null);

/** The nearest `LiveAnnouncer`'s announce function - a no-op outside one. */
export function useAnnouncer(): Announce {
  const announce = useContext(AnnouncerContext);
  return useMemo(() => announce ?? (() => undefined), [announce]);
}
