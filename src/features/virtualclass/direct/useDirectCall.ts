import { useEffect, useState, useSyncExternalStore } from "react";
import type { JoinView } from "@/api/liveSessions";
import { type CallDeps, type CallState, DirectCallController } from "./callController";

export interface DirectCall {
  state: CallState;
  toggleAudio: () => void;
  toggleVideo: () => void;
  switchCamera: (deviceId: string) => Promise<void>;
  hangup: () => void;
}

/**
 * One one-on-one call for as long as the component is mounted (webrtc-video.md §4.4) - see
 * `DirectCallController` for the negotiation rules. Mount it once the viewer has chosen their
 * devices and pressed "Join": `localStream` is fixed for the call's life (null for a guardian, or
 * a listen-only join). The stream stays the caller's to stop.
 */
export function useDirectCall(
  session: JoinView,
  localStream: MediaStream | null,
  deps?: Partial<CallDeps>,
): DirectCall {
  const [controller] = useState(() => new DirectCallController(session, localStream, deps));
  useEffect(() => {
    controller.start();
    return () => controller.dispose();
  }, [controller]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  return {
    state,
    toggleAudio: () => controller.toggleAudio(),
    toggleVideo: () => controller.toggleVideo(),
    switchCamera: (deviceId) => controller.switchCamera(deviceId),
    hangup: () => controller.hangup(),
  };
}
