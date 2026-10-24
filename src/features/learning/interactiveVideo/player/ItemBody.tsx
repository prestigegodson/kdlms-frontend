import { useState, type ReactNode } from "react";
import type { InteractiveItem } from "@/api/learning";
import { RichContent } from "@/components/richText/RichContent";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { checkBlanks, checkChoice, checkTrueFalse, parseBlanks } from "../check";
import type { ItemOutcome } from "../engine";

export type RenderImage = (fileId: string, alt: string) => ReactNode;

export interface ItemBodyProps {
  item: InteractiveItem;
  renderImage?: RenderImage;
  /** Records what the student did - drives mandatory gating and completion. */
  onOutcome: (outcome: ItemOutcome) => void;
  /** A teacher-authored jump (adaptivity, crossroads). */
  onJump: (seconds: number) => void;
  /** Present when the item is open in the player's dialog - its Continue button closes it. */
  onClose?: () => void;
}

/** Wraps a caller's rich-text image so it fills an IMAGE item's box rather than the rich-text thumbnail size. */
const FILL_IMAGE_CLASSES =
  "flex h-full w-full items-center justify-center [&_img]:!m-0 [&_img]:!h-full [&_img]:!max-h-full [&_img]:!w-full [&_img]:!max-w-full [&_img]:!border-0 [&_img]:object-contain";

/**
 * One overlay item's content - shared by a poster on the stage and the player's dialog. Graded
 * items are checked in the browser (`check.ts`) and never sent anywhere; a Continue after checking
 * applies the item's adaptivity jump and closes the dialog.
 */
export function ItemBody(props: ItemBodyProps) {
  const { item, renderImage } = props;
  const c = item.content;
  switch (item.type) {
    case "TEXT":
      return <RichContent html={c.html ?? ""} renderImage={renderImage} className="space-y-2 text-sm text-slate-700" />;
    case "LABEL":
      return <p className="whitespace-pre-line text-sm font-medium">{c.text}</p>;
    case "IMAGE":
      return (
        <div className={FILL_IMAGE_CLASSES}>
          {c.fileId && renderImage ? (
            renderImage(c.fileId, c.alt ?? "")
          ) : (
            <span className="text-sm text-slate-500">{c.alt || "Image"}</span>
          )}
        </div>
      );
    case "LINK":
      return c.url ? (
        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-brand-600 underline"
        >
          {c.text || c.url}
        </a>
      ) : (
        <span className="text-sm text-slate-500">{c.text}</span>
      );
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE":
      return <ChoiceBody {...props} />;
    case "TRUE_FALSE":
      return <TrueFalseBody {...props} />;
    case "FILL_BLANKS":
      return <FillBlanksBody {...props} />;
    case "FREE_TEXT":
      return <FreeTextBody {...props} />;
    case "CROSSROADS":
      return <CrossroadsBody {...props} />;
    case "NAV_HOTSPOT":
      return null;
  }
}

/** Shared tail of every graded item: feedback, then Retry / Show solution / Continue. */
function GradedFooter({
  item,
  result,
  onRetry,
  onShowSolution,
  solutionShown,
  onJump,
  onClose,
}: {
  item: InteractiveItem;
  result: boolean;
  onRetry: () => void;
  onShowSolution: () => void;
  solutionShown: boolean;
  onJump: (seconds: number) => void;
  onClose?: () => void;
}) {
  const feedback = result ? item.feedback?.correct : item.feedback?.wrong;
  const target = result ? item.adaptivity?.onCorrectSeconds : item.adaptivity?.onWrongSeconds;
  function handleContinue() {
    if (target != null) {
      onJump(target);
    }
    onClose?.();
  }
  return (
    <div className="space-y-2" aria-live="polite">
      <p className={`text-sm font-medium ${result ? "text-green-700" : "text-red-700"}`}>
        {result ? "Correct!" : "Not quite."} {feedback}
      </p>
      <div className="flex flex-wrap gap-2">
        {!result && item.enableRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        )}
        {!result && item.enableSolution && !solutionShown && (
          <Button size="sm" variant="ghost" onClick={onShowSolution}>
            Show solution
          </Button>
        )}
        {(onClose || target != null) && (
          <Button size="sm" onClick={handleContinue}>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}

function ChoiceBody({ item, onOutcome, onJump, onClose }: ItemBodyProps) {
  const multiple = item.type === "MULTIPLE_CHOICE";
  const options = item.content.options ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const [solutionShown, setSolutionShown] = useState(false);

  function toggle(id: string) {
    if (result !== null) {
      return;
    }
    setSelected((current) =>
      multiple ? (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]) : [id],
    );
  }

  function check() {
    const correct = checkChoice(item, selected);
    setResult(correct);
    onOutcome(correct ? "correct" : "wrong");
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-slate-900">{item.content.question}</legend>
      {multiple && <p className="text-xs text-slate-500">Choose every correct answer.</p>}
      <div className="space-y-2">
        {options.map((option) => {
          const isSelected = selected.includes(option.id);
          const reveal = result !== null && (solutionShown || result);
          const tone = reveal
            ? option.correct
              ? "border-green-500 bg-green-50"
              : isSelected
                ? "border-red-400 bg-red-50"
                : "border-slate-200"
            : isSelected
              ? "border-brand-500 bg-brand-50"
              : "border-slate-200 hover:bg-slate-50";
          return (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm text-slate-800 mobile:min-h-11 ${tone}`}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={`choice-${item.id}`}
                checked={isSelected}
                disabled={result !== null}
                onChange={() => toggle(option.id)}
                className="h-4 w-4 text-brand-500"
              />
              {option.text}
            </label>
          );
        })}
      </div>
      {result === null ? (
        <Button size="sm" onClick={check} disabled={selected.length === 0}>
          Check
        </Button>
      ) : (
        <GradedFooter
          item={item}
          result={result}
          solutionShown={solutionShown}
          onShowSolution={() => setSolutionShown(true)}
          onRetry={() => {
            setResult(null);
            setSelected([]);
            setSolutionShown(false);
          }}
          onJump={onJump}
          onClose={onClose}
        />
      )}
    </fieldset>
  );
}

function TrueFalseBody({ item, onOutcome, onJump, onClose }: ItemBodyProps) {
  const [value, setValue] = useState<boolean | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [solutionShown, setSolutionShown] = useState(false);

  function check() {
    if (value === null) {
      return;
    }
    const correct = checkTrueFalse(item, value);
    setResult(correct);
    onOutcome(correct ? "correct" : "wrong");
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-900">{item.content.question}</p>
      <div className="flex gap-2" role="radiogroup" aria-label="True or false">
        {[true, false].map((option) => (
          <Button
            key={String(option)}
            size="sm"
            role="radio"
            aria-checked={value === option}
            variant={value === option ? "primary" : "secondary"}
            disabled={result !== null}
            onClick={() => setValue(option)}
          >
            {option ? "True" : "False"}
          </Button>
        ))}
      </div>
      {solutionShown && (
        <p className="text-sm text-slate-700">The statement is {item.content.answer ? "true" : "false"}.</p>
      )}
      {result === null ? (
        <Button size="sm" onClick={check} disabled={value === null}>
          Check
        </Button>
      ) : (
        <GradedFooter
          item={item}
          result={result}
          solutionShown={solutionShown}
          onShowSolution={() => setSolutionShown(true)}
          onRetry={() => {
            setResult(null);
            setValue(null);
            setSolutionShown(false);
          }}
          onJump={onJump}
          onClose={onClose}
        />
      )}
    </div>
  );
}

function FillBlanksBody({ item, onOutcome, onJump, onClose }: ItemBodyProps) {
  const segments = parseBlanks(item.content.text);
  const blankCount = segments.filter((segment) => segment.kind === "blank").length;
  const [typed, setTyped] = useState<string[]>(() => Array.from({ length: blankCount }, () => ""));
  const [results, setResults] = useState<boolean[] | null>(null);
  const [solutionShown, setSolutionShown] = useState(false);

  function check() {
    const checked = checkBlanks(item, typed);
    setResults(checked);
    onOutcome(checked.every(Boolean) ? "correct" : "wrong");
  }

  // Each segment's blank number (-1 for prose), worked out before rendering.
  const blankNumbers = segments.reduce<number[]>((numbers, segment) => {
    const lastBlank = Math.max(-1, ...numbers);
    numbers.push(segment.kind === "blank" ? lastBlank + 1 : -1);
    return numbers;
  }, []);
  return (
    <div className="space-y-3">
      <p className="text-sm leading-8 text-slate-800">
        {segments.map((segment, index) => {
          if (segment.kind === "text") {
            return <span key={index}>{segment.value}</span>;
          }
          const at = blankNumbers[index];
          const ok = results?.[at];
          return (
            <span key={index} className="inline-flex flex-col align-middle">
              <input
                aria-label={`Blank ${at + 1}`}
                value={typed[at] ?? ""}
                disabled={results !== null}
                onChange={(event) => setTyped((current) => current.map((v, i) => (i === at ? event.target.value : v)))}
                className={`mx-1 w-28 rounded-control border px-2 py-0.5 text-sm ${
                  ok === undefined ? "border-slate-300" : ok ? "border-green-500 bg-green-50" : "border-red-400 bg-red-50"
                }`}
              />
              {solutionShown && !ok && (
                <span className="mx-1 text-xs text-green-700">{segment.answers[0]}</span>
              )}
            </span>
          );
        })}
      </p>
      {results === null ? (
        <Button size="sm" onClick={check} disabled={typed.every((value) => value.trim() === "")}>
          Check
        </Button>
      ) : (
        <GradedFooter
          item={item}
          result={results.every(Boolean)}
          solutionShown={solutionShown}
          onShowSolution={() => setSolutionShown(true)}
          onRetry={() => {
            setResults(null);
            setSolutionShown(false);
          }}
          onJump={onJump}
          onClose={onClose}
        />
      )}
    </div>
  );
}

function FreeTextBody({ item, onOutcome, onClose }: ItemBodyProps) {
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const modelAnswer = item.content.modelAnswer;

  function submit() {
    setRevealed(true);
    onOutcome("answered");
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-900">{item.content.prompt}</p>
      <Textarea
        aria-label="Your answer"
        rows={3}
        value={answer}
        disabled={revealed}
        onChange={(event) => setAnswer(event.target.value)}
      />
      {!revealed ? (
        <Button size="sm" onClick={submit} disabled={answer.trim() === ""}>
          {modelAnswer ? "Compare with model answer" : "Done"}
        </Button>
      ) : (
        <div className="space-y-2" aria-live="polite">
          {modelAnswer && (
            <div className="rounded-control border border-green-200 bg-green-50 p-3 text-sm text-slate-800">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-700">Model answer</p>
              <p className="whitespace-pre-line">{modelAnswer}</p>
            </div>
          )}
          {onClose && (
            <Button size="sm" onClick={onClose}>
              Continue
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function CrossroadsBody({ item, onOutcome, onJump, onClose }: ItemBodyProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-900">{item.content.prompt}</p>
      <div className="flex flex-col gap-2">
        {(item.content.choices ?? []).map((choice, index) => (
          <Button
            key={index}
            variant="secondary"
            onClick={() => {
              onOutcome("answered");
              if (choice.targetSeconds != null) {
                onJump(choice.targetSeconds);
              }
              onClose?.();
            }}
          >
            {choice.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
