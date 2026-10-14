import {
  getShareTargetSubjects,
  getShareTargets,
  type ShareResultView,
  shareLearningResource,
} from "@/api/learning";
import { ShareToClassModal } from "@/features/academics/components/ShareToClassModal";

interface ShareResourceModalProps {
  /** The resource to share - mount the modal only while sharing, so each opening starts fresh. */
  resource: { id: string; title: string };
  onClose: () => void;
  onShared: (result: ShareResultView) => void;
}

/** Sends a published copy of a learning resource to another class (level) of its branch - see {@link ShareToClassModal}. */
export function ShareResourceModal({ resource, onClose, onShared }: ShareResourceModalProps) {
  return (
    <ShareToClassModal
      item={resource}
      noun="resource"
      loadTargets={getShareTargets}
      loadSubjects={getShareTargetSubjects}
      share={shareLearningResource}
      footnote="Pupils in the selected classrooms will see the copy straight away. Their teachers manage it from then on, and your later edits won't carry over."
      onClose={onClose}
      onShared={onShared}
    />
  );
}
