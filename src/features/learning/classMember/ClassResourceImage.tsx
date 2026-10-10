import {
  type ClassResourceReader,
  classResourceImagePath,
  downloadClassResourceImage,
} from "@/api/classLearningResources";
import { RICH_IMAGE_SIZE_CLASS } from "@/components/richText/richImageSize";
import { useObjectUrl } from "@/hooks/useObjectUrl";

interface ClassResourceImageProps {
  reader: ClassResourceReader;
  resourceId: string;
  fileId: string;
  alt: string;
}

/**
 * One image in a published class resource, for a learner or guardian (creators Phase C14) - fetched
 * as an authenticated blob from the resource's own narrow endpoint, which serves only files its body
 * references. The path is the `useObjectUrl` key, so the module-level fetcher stays stable.
 */
export function ClassResourceImage({ reader, resourceId, fileId, alt }: ClassResourceImageProps) {
  const url = useObjectUrl(classResourceImagePath(reader, resourceId, fileId), downloadClassResourceImage);
  if (!url) {
    return null;
  }
  return <img src={url} alt={alt} className={`my-1 ${RICH_IMAGE_SIZE_CLASS} rounded-control border border-slate-200`} />;
}
