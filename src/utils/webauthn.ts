import type { AuthenticationOptionsView, RegistrationOptionsView } from "@/api/staffAttendance";

/**
 * Thin WebAuthn helpers for staff passkey clock-in (Phase 46). Hand-rolled
 * rather than pulling in a WebAuthn client library: the server sends every
 * binary field base64url-encoded and expects the credential back in the same
 * `PublicKeyCredential.toJSON()` shape, and `toJSON()` itself is too new for
 * the phones staff carry (see package.json's browserslist), so the
 * serialisation is done here by hand.
 */

export function base64UrlToBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function bufferToBase64Url(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Whether this browser can create and use passkeys at all. */
export function passkeysSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential === "function" &&
    typeof navigator.credentials?.create === "function"
  );
}

/** Whether the device has a built-in fingerprint/face (or PIN) unlock a passkey can use. */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!passkeysSupported()) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** A human message for a WebAuthn failure - cancelling the prompt is the common case. */
export function describeWebAuthnError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "The fingerprint check was cancelled or timed out. Please try again.";
    }
    if (error.name === "InvalidStateError") {
      return "This phone already has a clock-in passkey for you.";
    }
    if (error.name === "SecurityError") {
      return "Passkeys can't be used on this address. Open the link from the school's own website.";
    }
    if (error.name === "NotSupportedError") {
      return "This phone doesn't support passkeys. Ask your admin to enroll you on the fingerprint terminal instead.";
    }
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export async function createPasskey(options: RegistrationOptionsView): Promise<unknown> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: base64UrlToBuffer(options.challenge),
      rp: { id: options.rpId, name: options.rpName },
      user: {
        id: base64UrlToBuffer(options.userId),
        name: options.userName,
        displayName: options.userDisplayName,
      },
      pubKeyCredParams: options.algorithms.map((alg) => ({ type: "public-key" as const, alg })),
      excludeCredentials: options.excludeCredentials.map((descriptor) => ({
        type: "public-key" as const,
        id: base64UrlToBuffer(descriptor.id),
      })),
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
      attestation: "none",
      timeout: options.timeoutMillis,
    },
  })) as PublicKeyCredential | null;
  if (!credential) {
    throw new Error("No passkey was created.");
  }
  const response = credential.response as AuthenticatorAttestationResponse;
  const transports =
    typeof response.getTransports === "function" ? response.getTransports() : ["internal"];
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject),
      transports,
    },
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
  };
}

/** A discoverable-credential assertion - no allow list, so the phone offers whichever passkey it holds for this site. */
export async function getPasskeyAssertion(options: AuthenticationOptionsView): Promise<unknown> {
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: base64UrlToBuffer(options.challenge),
      rpId: options.rpId,
      allowCredentials: [],
      userVerification: "required",
      timeout: options.timeoutMillis,
    },
  })) as PublicKeyCredential | null;
  if (!credential) {
    throw new Error("No passkey was used.");
  }
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
  };
}
