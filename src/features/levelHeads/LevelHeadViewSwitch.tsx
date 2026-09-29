import { type ReactNode, useState } from "react";
import { Tabs } from "@/components/ui/Tabs";

type View = "teaching" | "levels";

interface LevelHeadViewSwitchProps {
  ariaLabel: string;
  /** The page's ordinary TEACHER view - the classes they themselves teach. */
  teachingView: ReactNode;
  /** The page's admin view, which the server narrows to the levels they head. */
  levelsView: ReactNode;
}

/**
 * For a Head of Level on a page that otherwise forks TEACHER vs admin: they are
 * both, so they get a "My classes" / "My levels" tab pair instead of one fork.
 */
export function LevelHeadViewSwitch({
  ariaLabel,
  teachingView,
  levelsView,
}: LevelHeadViewSwitchProps) {
  const [view, setView] = useState<View>("levels");
  return (
    <div className="space-y-6">
      <Tabs
        ariaLabel={ariaLabel}
        value={view}
        onChange={setView}
        items={[
          { value: "levels", label: "My levels" },
          { value: "teaching", label: "My classes" },
        ]}
      />
      {view === "levels" ? levelsView : teachingView}
    </div>
  );
}
