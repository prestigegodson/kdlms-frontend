import { downloadMyLearningResourceImage, myLearningResourceImagePath } from "@/api/learning";
import { RICH_IMAGE_SIZE_CLASS } from "@/components/richText/richImageSize";
import { useObjectUrl } from "@/hooks/useObjectUrl";

interface StudentResourceImageProps {
  resourceId: string;
  fileId: string;
  alt: string;
}

/**
 * One image in a published rich-text resource, for the signed-in student - fetched as an
 * authenticated blob from the resource's own narrow endpoint, which serves only files its body
 * references (a `STUDENT` never reaches `/api/v1/files/{id}`). The path is the `useObjectUrl` key,
 * so the module-level fetcher stays stable.
 */
export function StudentResourceImage({ resourceId, fileId, alt }: StudentResourceImageProps) {
  const url = useObjectUrl(myLearningResourceImagePath(resourceId, fileId), downloadMyLearningResourceImage);
  if (!url) {
    return null;
  }
  return <img src={url} alt={alt} className={`my-1 ${RICH_IMAGE_SIZE_CLASS} rounded-control border border-slate-200`} />;
}
