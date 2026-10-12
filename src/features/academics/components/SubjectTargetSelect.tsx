import { ChevronDown } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type GroupableSubject,
  groupSubjects,
  groupTargetKey,
  withLevelName,
} from "@/features/academics/subjectTarget";

interface SubjectTargetSelectProps {
  id: string;
  /** The selected target key (`subjectTarget.ts`) - a bare subject id, `group:<id>`, or `""` for none. */
  value: string;
  onChange: (key: string) => void;
  subjects: GroupableSubject[];
  /** The groups the caller may pick as a target - every other group is a heading only. */
  subjectGroups?: { subjectGroupId: string; subjectGroupName: string }[];
  /** The empty option's text; `null` renders no empty option (a picker that always has a value). */
  placeholder?: string | null;
  disabled?: boolean;
}

interface Option {
  key: string;
  label: string;
  indent: boolean;
  placeholder?: boolean;
}

/** What the open list renders: a lone option, or a non-selectable heading's run of options. */
type Block = { kind: "option"; option: Option } | { kind: "group"; label: string; options: Option[] };

interface Section {
  /** A selectable group's own option, or `null` for a heading-only section. */
  groupOption: Option | null;
  heading: string | null;
  options: Option[];
}

function optionId(id: string, key: string): string {
  return `${id}-option-${key || "none"}`;
}

function matches(text: string, query: string): boolean {
  return text.toLocaleLowerCase().includes(query);
}

/**
 * A searchable subject (or subject-or-group, see `subjectTarget.ts`) picker - a type-to-filter
 * combobox replacing the native `<select>` so a long subject catalogue can be narrowed by typing.
 * Lists every subject under its own group (`groupSubjects`): a group the caller may target is
 * itself an option, its subjects indented after it; any other group is a non-selectable heading.
 * Ungrouped subjects trail under "Other subjects" - or, when nothing is grouped, the list stays
 * flat. A group whose name matches the query keeps all of its subjects; otherwise only its
 * matching subjects stay. Shared by the Learning resources, CBT/Quizzes and teacher Assessments
 * pages, the resource editor, and the lesson-notes subject picker.
 *
 * The list is an absolutely-positioned popover rather than `StudentSearchField`'s in-flow list,
 * since most call sites sit in a sticky filter bar where an in-flow list would shove the page.
 */
export function SubjectTargetSelect({
  id,
  value,
  onChange,
  subjects,
  subjectGroups = [],
  placeholder = "Select a subject…",
  disabled,
}: SubjectTargetSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sections = useMemo<Section[]>(() => {
    const { sections: grouped, ungrouped } = groupSubjects(subjects, subjectGroups);
    const subjectRow = (subject: GroupableSubject, indent = false): Option => ({
      key: subject.subjectId,
      label: withLevelName(subject.subjectName, subject.levelName),
      indent,
    });
    if (grouped.length === 0) {
      return [{ groupOption: null, heading: null, options: ungrouped.map((subject) => subjectRow(subject)) }];
    }
    const result: Section[] = grouped.map((section) =>
      section.selectable
        ? {
            groupOption: { key: groupTargetKey(section.subjectGroupId), label: section.label, indent: false },
            heading: null,
            options: section.subjects.map((subject) => subjectRow(subject, true)),
          }
        : { groupOption: null, heading: section.label, options: section.subjects.map((subject) => subjectRow(subject)) },
    );
    if (ungrouped.length > 0) {
      result.push({ groupOption: null, heading: "Other subjects", options: ungrouped.map((subject) => subjectRow(subject)) });
    }
    return result;
  }, [subjects, subjectGroups]);

  const selectedLabel = useMemo(() => {
    for (const section of sections) {
      for (const option of [section.groupOption, ...section.options]) {
        if (option?.key === value) return option.label;
      }
    }
    return "";
  }, [sections, value]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const blocks = useMemo<Block[]>(() => {
    const visible: Block[] = [];
    const lone = (option: Option): Block => ({ kind: "option", option });
    if (placeholder !== null && !normalizedQuery) {
      visible.push(lone({ key: "", label: placeholder, indent: false, placeholder: true }));
    }
    for (const section of sections) {
      const sectionLabel = section.groupOption?.label ?? section.heading ?? "";
      const sectionMatches = Boolean(normalizedQuery) && Boolean(sectionLabel) && matches(sectionLabel, normalizedQuery);
      const options =
        !normalizedQuery || sectionMatches
          ? section.options
          : section.options.filter((option) => matches(option.label, normalizedQuery));
      if (section.groupOption) {
        if (sectionMatches || options.length > 0 || !normalizedQuery) {
          visible.push(lone(section.groupOption), ...options.map(lone));
        }
      } else if (options.length > 0) {
        if (section.heading) visible.push({ kind: "group", label: section.heading, options });
        else visible.push(...options.map(lone));
      }
    }
    return visible;
  }, [sections, normalizedQuery, placeholder]);

  const optionKeys = blocks.flatMap((block) =>
    block.kind === "option" ? [block.option.key] : block.options.map((option) => option.key),
  );

  useEffect(() => {
    if (!open || highlightedKey === null) return;
    // jsdom (the test environment) has no scrollIntoView - guard the method, not just the element.
    document.getElementById(optionId(id, highlightedKey))?.scrollIntoView?.({ block: "nearest" });
  }, [id, open, highlightedKey]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery("");
      setHighlightedKey(null);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function openList() {
    if (disabled || open) return;
    setOpen(true);
    setQuery("");
    setHighlightedKey(value);
  }

  function close() {
    setOpen(false);
    setQuery("");
    setHighlightedKey(null);
  }

  function select(key: string) {
    close();
    if (key !== value) onChange(key);
  }

  function moveHighlight(step: 1 | -1) {
    if (optionKeys.length === 0) return;
    const current = highlightedKey === null ? -1 : optionKeys.indexOf(highlightedKey);
    const next =
      current === -1 ? (step === 1 ? 0 : optionKeys.length - 1) : Math.min(Math.max(current + step, 0), optionKeys.length - 1);
    setHighlightedKey(optionKeys[next]);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          openList();
        } else {
          moveHighlight(event.key === "ArrowDown" ? 1 : -1);
        }
        break;
      case "Enter":
        // The editor modal's picker sits inside a <form> - picking must never submit it.
        if (!open) return;
        event.preventDefault();
        if (highlightedKey !== null && optionKeys.includes(highlightedKey)) select(highlightedKey);
        break;
      case "Escape":
        if (!open) return;
        event.preventDefault();
        close();
        break;
      case "Tab":
        close();
        break;
      default:
        break;
    }
  }

  const listboxId = `${id}-listbox`;
  const activeOptionId =
    open && highlightedKey !== null && optionKeys.includes(highlightedKey) ? optionId(id, highlightedKey) : undefined;

  function renderOption(option: Option) {
    return (
      <li
        key={option.key || "none"}
        id={optionId(id, option.key)}
        role="option"
        aria-selected={option.key === value}
        // Keep focus on the input so a click doesn't blur-close the list before it lands.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => select(option.key)}
        onMouseEnter={() => setHighlightedKey(option.key)}
        className={`cursor-pointer px-3 py-2 text-sm ${option.indent ? "pl-7" : ""} ${
          option.placeholder ? "text-slate-500" : "text-slate-900"
        } ${option.key === value ? "font-medium" : ""} ${option.key === highlightedKey ? "bg-brand-50" : ""}`}
      >
        {option.label}
      </li>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        disabled={disabled}
        value={open ? query : selectedLabel}
        placeholder={open ? selectedLabel || "Search subjects…" : (placeholder ?? "")}
        onChange={(event) => {
          if (!open) openList();
          setQuery(event.target.value);
          setHighlightedKey(null);
        }}
        onFocus={openList}
        onClick={openList}
        onKeyDown={handleKeyDown}
        className={`block w-full cursor-pointer truncate rounded-control border border-slate-300 bg-white px-3 py-2 pr-9 text-sm text-slate-900
          placeholder:text-slate-500 transition-colors focus:cursor-text focus:border-brand-500
          disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500 mobile:text-base mobile:min-h-11`}
      />
      <ChevronDown
        className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform ${
          open ? "rotate-180" : ""
        }`}
        aria-hidden="true"
      />
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Subjects"
          className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-panel border border-slate-200 bg-white py-1 shadow-lg"
        >
          {optionKeys.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-sm text-slate-500">
              {normalizedQuery ? "No matching subjects" : "No subjects"}
            </li>
          ) : (
            blocks.map((block) =>
              block.kind === "option" ? (
                renderOption(block.option)
              ) : (
                <li key={`group-${block.label}`} role="presentation">
                  <ul role="group" aria-label={block.label}>
                    <li
                      role="presentation"
                      className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {block.label}
                    </li>
                    {block.options.map(renderOption)}
                  </ul>
                </li>
              ),
            )
          )}
        </ul>
      )}
    </div>
  );
}
