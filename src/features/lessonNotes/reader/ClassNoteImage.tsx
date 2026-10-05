import {
  type ClassNotesReader,
  classLessonNoteImagePath,
  downloadClassLessonNoteImage,
} from "@/api/lessonNotes";
import { useObjectUrl } from "@/hooks/useObjectUrl";

interface ClassNoteImageProps {
  reader: ClassNotesReader;
  noteId: string;
  fileId: string;
  alt: string;
}

/**
 * One image in a published class lesson note, for a learner or guardian (creators Phase C12) -
 * fetched as an authenticated blob from the note's own narrow endpoint, which serves only files
 * that note references. The path is the `useObjectUrl` key, so the module-level fetcher stays stable.
 */
export function ClassNoteImage({ reader, noteId, fileId, alt }: ClassNoteImageProps) {
  const url = useObjectUrl(classLessonNoteImagePath(reader, noteId, fileId), downloadClassLessonNoteImage);
  if (!url) {
    return null;
  }
  return <img src={url} alt={alt} className="my-1 inline-block max-w-full rounded-control border border-slate-200" />;
}
