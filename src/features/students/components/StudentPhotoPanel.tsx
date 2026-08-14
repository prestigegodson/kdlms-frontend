import { downloadFile } from "@/api/files";
import type { StudentView } from "@/api/students";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { Camera } from "lucide-react";
import { initialsOf } from "@/utils/initials";

interface StudentPhotoPanelProps {
  student: StudentView;
  canManage: boolean;
  onEdit: () => void;
}

const FRAME_CLASSES =
  "relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-panel border border-slate-200 bg-slate-50 sm:w-40";

/**
 * The student's photo, framed large enough to actually see (unlike the
 * round `Avatar`, which is avatar-sized and crops to a circle) - lives in
 * the Bio card's own column. `object-contain` letterboxes rather than
 * cropping, so whatever aspect ratio was uploaded renders whole. A
 * `canManage` caller gets a persistent camera chip (not hover-only, which
 * is invisible on touch) that opens the same `StudentPhotoModal` the old
 * header avatar did.
 */
export function StudentPhotoPanel({ student, canManage, onEdit }: StudentPhotoPanelProps) {
  const photoUrl = useObjectUrl(student.photoFileId, downloadFile);

  const content = photoUrl ? (
    <img src={photoUrl} alt={student.fullName} className="h-full w-full object-contain" />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-brand-600">
      {initialsOf(student)}
    </span>
  );

  if (!canManage) {
    return <div className={FRAME_CLASSES}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edit ${student.fullName}'s photo`}
      className={`${FRAME_CLASSES} group cursor-pointer`}
    >
      {content}
      <span className="absolute inset-0 bg-slate-900/0 transition-colors group-hover:bg-slate-900/40" aria-hidden="true" />
      <span
        className="absolute bottom-1 right-1 rounded-full bg-slate-900/70 p-1.5 text-white"
        aria-hidden="true"
      >
        <Camera className="h-4 w-4" />
      </span>
    </button>
  );
}
