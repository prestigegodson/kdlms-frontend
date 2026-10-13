import { useObjectUrl } from "@/hooks/useObjectUrl";

/**
 * Where a themed page gets its theme's images from - the same narrow endpoint its question images
 * use, since a student, learner or anonymous token holder may never read `/api/v1/files`. The token
 * page's endpoint is public, so a plain URL works; every authenticated path fetches a blob.
 */
export type ThemeImageSource =
  | { kind: "url"; urlFor: (fileId: string) => string }
  | { kind: "blob"; keyFor: (fileId: string) => string; fetch: (key: string) => Promise<Blob> };

const NO_FETCH = () => Promise.reject(new Error("unused"));

/** A displayable URL for `fileId` through `source`, or null while it loads (or when there's no image). */
export function useThemeImageUrl(source: ThemeImageSource, fileId: string | null): string | null {
  const blobKey = source.kind === "blob" && fileId ? source.keyFor(fileId) : undefined;
  const blobUrl = useObjectUrl(blobKey, source.kind === "blob" ? source.fetch : NO_FETCH);
  if (!fileId) return null;
  return source.kind === "url" ? source.urlFor(fileId) : blobUrl;
}
