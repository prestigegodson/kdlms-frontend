import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The quiz pages' bare `<img src>` URLs can't go through `apiFetch`, so they must carry the API
 * origin themselves - production serves the SPA and the API from different hosts, and a relative
 * `/api/...` image path there loads the SPA's `index.html` instead of the image.
 */
async function loadHelpers(baseUrl: string) {
  vi.stubEnv("VITE_API_BASE_URL", baseUrl);
  vi.resetModules();
  const guest = await import("@/api/guestQuiz");
  const publicQuiz = await import("@/api/publicTakeHomeQuiz");
  return [
    guest.guestQuizImageUrl("session", "file-1"),
    guest.guestQuizLinkImageUrl("link", "file-1"),
    publicQuiz.publicQuestionImageUrl("token", "file-1"),
  ];
}

describe("quiz image URLs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("are prefixed with the API origin when one is configured", async () => {
    const urls = await loadHelpers("https://api.example.test");
    expect(urls).toEqual([
      "https://api.example.test/api/v1/public/guest-quiz-attempts/session/images/file-1",
      "https://api.example.test/api/v1/public/guest-quiz-links/link/images/file-1",
      "https://api.example.test/api/v1/public/take-home-quiz/token/images/file-1",
    ]);
  });

  it("stay same-origin when no API origin is configured", async () => {
    const urls = await loadHelpers("");
    expect(urls.every((url) => url.startsWith("/api/v1/public/"))).toBe(true);
  });
});
