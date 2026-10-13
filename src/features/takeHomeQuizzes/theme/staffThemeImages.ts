import { downloadFile } from "@/api/files";
import type { ThemeImageSource } from "@/features/takeHomeQuizzes/theme/themeImages";

/** Staff previews read a theme's images straight from `/api/v1/files`, which admits every quiz author. */
export const STAFF_THEME_IMAGES: ThemeImageSource = { kind: "blob", keyFor: (fileId) => fileId, fetch: downloadFile };
