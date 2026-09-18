import { downloadMyTakeHomeQuizImage } from "@/api/myTakeHomeQuizzes";
import { QUIZ_IMAGE_SIZE_CLASS } from "@/features/takeHomeQuizzes/runner/quizImageSizes";
import { useObjectUrl } from "@/hooks/useObjectUrl";

interface PortalQuizImageProps {
  quizId: string;
  fileId: string;
  alt: string;
  size: "prompt" | "option";
}

/**
 * Resolves one quiz question image through the authenticated `GET /api/v1/me/take-home-quizzes/
 * {quizId}/images/{fileId}` endpoint (Phase 35I.3) - the `AuthenticatedRichImage`/`downloadFile`
 * shape, since (unlike the public path's `publicQuestionImageUrl`) this endpoint needs a Bearer
 * header a bare `<img src>` can't carry.
 */
export function PortalQuizImage({ quizId, fileId, alt, size }: PortalQuizImageProps) {
  const previewUrl = useObjectUrl(fileId, (id) => downloadMyTakeHomeQuizImage(quizId, id));
  if (!previewUrl) {
    return null;
  }
  return <img src={previewUrl} alt={alt} loading="lazy" className={QUIZ_IMAGE_SIZE_CLASS[size]} />;
}
