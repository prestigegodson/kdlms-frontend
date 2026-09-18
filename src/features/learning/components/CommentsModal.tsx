import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ResourceCommentsModeration } from "@/features/learning/components/ResourceCommentsModeration";

interface CommentsModalProps {
  resourceId: string;
  onClose: () => void;
}

/**
 * Thin modal wrapper around `ResourceCommentsModeration` (Phase 35G) - opened from
 * `LearningResourcesPage`'s Actions column. Reads the resource's title for the modal header off
 * `ResourceCommentsModeration`'s own `onResourceLoaded` callback rather than fetching the resource
 * itself, so opening this modal costs exactly the one `getLearningResource` round-trip
 * `ResourceCommentsModeration` already makes - the same shape `LearningResourcePreviewPage` uses
 * to embed it inline without a modal at all.
 */
export function CommentsModal({ resourceId, onClose }: CommentsModalProps) {
  const [title, setTitle] = useState<string | null>(null);

  return (
    <Modal open onClose={onClose} title={title ? `Comments · ${title}` : "Comments"} size="lg">
      <ResourceCommentsModeration resourceId={resourceId} onResourceLoaded={(resource) => setTitle(resource.title)} />
    </Modal>
  );
}
