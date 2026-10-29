import { describe, expect, it } from "vitest";
import { base64UrlToBuffer, bufferToBase64Url } from "@/utils/webauthn";

describe("base64url helpers", () => {
  it("round-trips bytes that need the URL-safe alphabet and no padding", () => {
    const bytes = new Uint8Array([251, 255, 191, 0, 1, 62, 63]);
    const encoded = bufferToBase64Url(bytes);

    expect(encoded).not.toMatch(/[+/=]/);
    expect(new Uint8Array(base64UrlToBuffer(encoded))).toEqual(bytes);
  });

  it("decodes a server challenge of 32 bytes", () => {
    const challenge = "q0E4u0Q5oF8x2r1v9bQ3m6c5nW7a8k2L1p0s4d3f6g8";
    expect(base64UrlToBuffer(challenge).byteLength).toBe(32);
  });
});
