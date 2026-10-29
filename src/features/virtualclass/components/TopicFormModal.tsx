import { type FormEvent, useState } from "react";
import { getErrorMessage } from "@/api/client";
import type { ClassTopic, TopicInput } from "@/api/classTopics";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";

interface TopicFormModalProps {
  /** The topic being edited, or `null` to add one. */
  existing: ClassTopic | null;
  onSubmit: (input: TopicInput) => Promise<void>;
  onClose: () => void;
}

/** Add or edit one topic a class covers - its title and an optional description. */
export function TopicFormModal({ existing, onSubmit, onClose }: TopicFormModalProps) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Enter a title for the topic.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), description: description.trim() || null });
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Failed to save the topic."));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={existing ? "Edit topic" : "Add topic"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Title" htmlFor="topic-title">
          <Input
            id="topic-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
            autoFocus
          />
        </FormField>
        <FormField label="Description (optional)" htmlFor="topic-description">
          <Textarea
            id="topic-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={3}
          />
        </FormField>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {existing ? "Save topic" : "Add topic"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
