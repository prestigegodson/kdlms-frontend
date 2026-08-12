import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement these - needed by `useObjectUrl` (ImageUploadField,
// student/ward photo avatars, the template designer's image preview), all of
// which call URL.createObjectURL/revokeObjectURL on a fetched Blob.
if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:mock-url";
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => undefined;
}
