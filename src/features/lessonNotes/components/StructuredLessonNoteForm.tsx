import type { LessonNoteContentView } from "@/api/lessonNotes";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { PresentationStepsField } from "@/features/lessonNotes/components/PresentationStepsField";
import { StringListField } from "@/features/lessonNotes/components/StringListField";
import { LESSON_NOTE_FIELD_HELP } from "@/features/lessonNotes/lessonNoteFieldHelp";

interface StructuredLessonNoteFormProps {
  content: LessonNoteContentView;
  onChange: (content: LessonNoteContentView) => void;
}

/**
 * The original NERDC structured form - twelve fields (topic lives on
 * `LessonNoteEditorPage` itself; the eleven here are `LessonNoteContentView`'s
 * `STRUCTURED` half). Lifted out of `LessonNoteEditorPage` verbatim (Phase
 * 16G, alongside the new `LessonNoteDocumentEditor` free-form half) - a pure
 * extraction with no behaviour change, so every field keeps its existing id/
 * `aria-describedby` pairing and `LessonNoteEditorPage.test.tsx`'s
 * description assertions.
 */
export function StructuredLessonNoteForm({ content, onChange }: StructuredLessonNoteFormProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Sub-topic" htmlFor="lesson-note-subtopic" description={LESSON_NOTE_FIELD_HELP.subTopic}>
          <Input
            id="lesson-note-subtopic"
            value={content.subTopic ?? ""}
            onChange={(event) => onChange({ ...content, subTopic: event.target.value })}
            aria-describedby="lesson-note-subtopic-description"
          />
        </FormField>
        <FormField label="Duration" htmlFor="lesson-note-duration" description={LESSON_NOTE_FIELD_HELP.duration}>
          <Input
            id="lesson-note-duration"
            placeholder="e.g. 40 minutes"
            value={content.duration ?? ""}
            onChange={(event) => onChange({ ...content, duration: event.target.value })}
            aria-describedby="lesson-note-duration-description"
          />
        </FormField>
        <FormField
          label="Average age"
          htmlFor="lesson-note-average-age"
          description={LESSON_NOTE_FIELD_HELP.averageAge}
        >
          <Input
            id="lesson-note-average-age"
            placeholder="e.g. 12 years"
            value={content.averageAge ?? ""}
            onChange={(event) => onChange({ ...content, averageAge: event.target.value })}
            aria-describedby="lesson-note-average-age-description"
          />
        </FormField>
      </div>

      <FormField
        label="Entry behaviour"
        htmlFor="lesson-note-entry-behaviour"
        description={LESSON_NOTE_FIELD_HELP.entryBehaviour}
      >
        <Textarea
          id="lesson-note-entry-behaviour"
          rows={2}
          value={content.entryBehaviour ?? ""}
          onChange={(event) => onChange({ ...content, entryBehaviour: event.target.value })}
          aria-describedby="lesson-note-entry-behaviour-description"
        />
      </FormField>

      <StringListField
        label="Behavioural objectives"
        description={LESSON_NOTE_FIELD_HELP.objectives}
        values={content.objectives}
        onChange={(objectives) => onChange({ ...content, objectives })}
      />
      <StringListField
        label="Instructional materials"
        description={LESSON_NOTE_FIELD_HELP.instructionalMaterials}
        values={content.instructionalMaterials}
        onChange={(instructionalMaterials) => onChange({ ...content, instructionalMaterials })}
      />
      <StringListField
        label="References"
        description={LESSON_NOTE_FIELD_HELP.references}
        values={content.references}
        onChange={(references) => onChange({ ...content, references })}
      />

      <PresentationStepsField
        description={LESSON_NOTE_FIELD_HELP.presentation}
        steps={content.presentation}
        onChange={(presentation) => onChange({ ...content, presentation })}
      />

      <FormField label="Evaluation" htmlFor="lesson-note-evaluation" description={LESSON_NOTE_FIELD_HELP.evaluation}>
        <Textarea
          id="lesson-note-evaluation"
          rows={3}
          value={content.evaluation ?? ""}
          onChange={(event) => onChange({ ...content, evaluation: event.target.value })}
          aria-describedby="lesson-note-evaluation-description"
        />
      </FormField>
      <FormField label="Conclusion" htmlFor="lesson-note-conclusion" description={LESSON_NOTE_FIELD_HELP.conclusion}>
        <Textarea
          id="lesson-note-conclusion"
          rows={2}
          value={content.conclusion ?? ""}
          onChange={(event) => onChange({ ...content, conclusion: event.target.value })}
          aria-describedby="lesson-note-conclusion-description"
        />
      </FormField>
      <FormField label="Assignment" htmlFor="lesson-note-assignment" description={LESSON_NOTE_FIELD_HELP.assignment}>
        <Textarea
          id="lesson-note-assignment"
          rows={2}
          value={content.assignment ?? ""}
          onChange={(event) => onChange({ ...content, assignment: event.target.value })}
          aria-describedby="lesson-note-assignment-description"
        />
      </FormField>
    </>
  );
}
