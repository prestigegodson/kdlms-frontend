import { CheckCircle2, Circle } from "lucide-react";
import type { QuizThemeStyle } from "@/api/quizThemes";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { QuizThemeFrame } from "@/features/takeHomeQuizzes/theme/QuizThemeFrame";
import { STAFF_THEME_IMAGES } from "@/features/takeHomeQuizzes/theme/staffThemeImages";

export type PreviewScreen = "start" | "question";

interface ThemePreviewProps {
  style: QuizThemeStyle;
  screen: PreviewScreen;
  /** The quiz's own title when previewing from its editor; a sample otherwise. */
  title?: string;
}

const SAMPLE_OPTIONS = ["Lagos", "Abuja", "Kano"];

/**
 * A theme rendered on sample content, through the very `QuizThemeFrame` students get - so what a
 * teacher sees in the designer is what the class sees. Inert: nothing here is clickable.
 */
export function ThemePreview({ style, screen, title = "Sample quiz" }: ThemePreviewProps) {
  return (
    <div aria-hidden="true" inert className="pointer-events-none select-none">
      <QuizThemeFrame theme={style} images={STAFF_THEME_IMAGES}>
        {screen === "start" ? (
          <Card>
            <h3 className="font-display text-lg font-medium text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">Basic Science · Primary 4</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Questions</dt>
                <dd className="font-medium text-slate-900">10</dd>
              </div>
              <div>
                <dt className="text-slate-500">Time limit</dt>
                <dd className="font-medium text-slate-900">20 minutes</dd>
              </div>
            </dl>
            <Button className="mt-6 w-full" size="lg">
              Start quiz
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/5 rounded-full bg-brand-500" />
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    n === 3 ? "bg-brand-500 text-white" : n < 3 ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {n}
                </span>
              ))}
            </div>
            <Card>
              <p className="text-sm text-slate-500">Question 3 of 10</p>
              <p className="mt-1 font-medium text-slate-900">What is the capital of Nigeria?</p>
              <ul className="mt-4 space-y-2">
                {SAMPLE_OPTIONS.map((option) => {
                  const selected = option === "Abuja";
                  return (
                    <li
                      key={option}
                      className={`flex items-center gap-2 rounded-control border px-3 py-2 text-sm ${
                        selected ? "border-brand-500 bg-brand-50 text-slate-900" : "border-slate-200 text-slate-700"
                      }`}
                    >
                      {selected ? (
                        <CheckCircle2 className="h-4 w-4 text-brand-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-300" />
                      )}
                      {option}
                    </li>
                  );
                })}
              </ul>
            </Card>
            <div className="flex justify-between">
              <Button variant="secondary">Previous</Button>
              <Button>Next</Button>
            </div>
          </div>
        )}
      </QuizThemeFrame>
    </div>
  );
}

/** A small, cheap swatch for gallery cards and the editor's summary row - background, header and accent at a glance. */
export function ThemeSwatch({ style, className = "" }: { style: QuizThemeStyle; className?: string }) {
  return (
    <div aria-hidden="true" inert className={`pointer-events-none select-none overflow-hidden rounded-panel ${className}`}>
      <QuizThemeFrame theme={style} images={STAFF_THEME_IMAGES} variant="compact">
        <div className="space-y-1.5">
          <div className="h-1.5 w-3/4 rounded-full bg-slate-300" />
          <div className="h-1.5 w-1/2 rounded-full bg-slate-200" />
          <div className="h-3 w-12 rounded-full bg-brand-500" />
        </div>
      </QuizThemeFrame>
    </div>
  );
}
