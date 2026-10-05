import { type ClassQuizReader, classQuizImagePath, downloadClassQuizImage } from "@/api/classTakeHomeQuizzes";
import { QUIZ_IMAGE_SIZE_CLASS } from "@/features/takeHomeQuizzes/runner/quizImageSizes";
import { useObjectUrl } from "@/hooks/useObjectUrl";

interface ClassQuizImageProps {
  reader: ClassQuizReader;
  quizId: string;
  fileId: string;
  alt: string;
  size: "prompt" | "option";
}

/**
 * One image in a creator's class quiz, for a learner or guardian (creators Phase C13) - fetched as an
 * authenticated blob from the quiz's own narrow endpoint, which serves only files the quiz references
 * (`/api/v1/files` never admits either role). The path is the `useObjectUrl` key, so the fetcher stays stable.
 */
export function ClassQuizImage({ reader, quizId, fileId, alt, size }: ClassQuizImageProps) {
  const url = useObjectUrl(classQuizImagePath(reader, quizId, fileId), downloadClassQuizImage);
  if (!url) {
    return null;
  }
  return <img src={url} alt={alt} loading="lazy" className={QUIZ_IMAGE_SIZE_CLASS[size]} />;
}
