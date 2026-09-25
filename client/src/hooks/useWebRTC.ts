import { useState, useEffect, useRef, useCallback } from "react";
import type { AppSocket } from "../services/socket";

export type CallState =
  | "idle"
  | "requesting-permissions"
  | "permission-denied"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export interface WebRTCState {
  callState: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  error: string | null;
}

const STUN_SERVER = import.meta.env.VITE_STUN_SERVER ?? "stun:stun.l.google.com:19302";
const TURN_URL = import.meta.env.VITE_TURN_URL as string | undefined;
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME as string | undefined;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

function buildICEConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [{ urls: STUN_SERVER }];
  if (TURN_URL && TURN_USERNAME && TURN_CREDENTIAL) {
    iceServers.push({
      urls: TURN_URL,
      username: TURN_USERNAME,
      credential: TURN_CREDENTIAL,
    });
  }
  return { iceServers };
}

export function useWebRTC(socket: AppSocket, isInitiator: boolean) {
  const [state, setState] = useState<WebRTCState>({
    callState: "idle",
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isCameraOff: false,
    error: null,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);

  // ─── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
  }, []);

  // ─── Create peer connection ─────────────────────────────────────────────────
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(buildICEConfig());
    pcRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("webrtc:ice-candidate", { candidate: candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        remoteStreamRef.current = remoteStream;
        setState((s) => ({ ...s, remoteStream }));
      }
    };

    pc.onconnectionstatechange = () => {
      const cs = pc.connectionState;
      if (cs === "connected") {
        setState((s) => ({ ...s, callState: "connected", error: null }));
      } else if (cs === "failed" || cs === "closed") {
        setState((s) => ({ ...s, callState: cs === "failed" ? "failed" : "disconnected" }));
      } else if (cs === "connecting") {
        setState((s) => ({ ...s, callState: "connecting" }));
      }
    };

    pc.onnegotiationneeded = async () => {
      if (!isInitiator) return;
      try {
        makingOfferRef.current = true;
        await pc.setLocalDescription();
        if (pc.localDescription) {
          socket.emit("webrtc:offer", { offer: pc.localDescription });
        }
      } catch (err) {
        console.error("[webrtc] negotiation error:", err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    return pc;
  }, [socket, isInitiator]);

  // ─── Start call ─────────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (state.callState !== "idle" && state.callState !== "disconnected" && state.callState !== "failed") {
      return;
    }

    setState((s) => ({ ...s, callState: "requesting-permissions", error: null }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setState((s) => ({ ...s, localStream: stream }));

      const pc = createPeerConnection();

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      setState((s) => ({ ...s, callState: "connecting" }));
    } catch (err) {
      const error = err instanceof Error ? err.message : "Permission denied";
      const isDenied =
        error.includes("Permission denied") ||
        error.includes("NotAllowedError") ||
        error.includes("NotFoundError");

      setState((s) => ({
        ...s,
        callState: isDenied ? "permission-denied" : "failed",
        error: isDenied
          ? "Camera/microphone access denied. Chess and chat still work."
          : "Failed to access media devices.",
      }));
    }
  }, [state.callState, createPeerConnection]);

  // ─── End call ───────────────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    cleanup();
    setState({
      callState: "idle",
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isCameraOff: false,
      error: null,
    });
  }, [cleanup]);

  // ─── Toggle mute ────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setState((s) => ({ ...s, isMuted: !audioTrack.enabled }));
  }, []);

  // ─── Toggle camera ──────────────────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setState((s) => ({ ...s, isCameraOff: !videoTrack.enabled }));
  }, []);

  // ─── WebRTC signaling events ────────────────────────────────────────────────
  useEffect(() => {
    const onOffer = async (payload: { offer: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;

      const offerCollision =
        payload.offer.type === "offer" &&
        (makingOfferRef.current || pc.signalingState !== "stable");

      ignoreOfferRef.current = !isInitiator && offerCollision;
      if (ignoreOfferRef.current) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        if (payload.offer.type === "offer") {
          await pc.setLocalDescription();
          if (pc.localDescription) {
            socket.emit("webrtc:answer", { answer: pc.localDescription });
          }
        }
      } catch (err) {
        console.error("[webrtc] offer handling error:", err);
      }
    };

    const onAnswer = async (payload: { answer: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (pc.signalingState === "stable") return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
      } catch (err) {
        console.error("[webrtc] answer handling error:", err);
      }
    };

    const onIceCandidate = async (payload: { candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (err) {
        if (!ignoreOfferRef.current) {
          console.error("[webrtc] ICE candidate error:", err);
        }
      }
    };

    const onPeerLeft = () => {
      setState((s) => ({
        ...s,
        remoteStream: null,
        callState: s.callState === "connected" ? "disconnected" : s.callState,
      }));
    };

    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice-candidate", onIceCandidate);
    socket.on("webrtc:peer:left", onPeerLeft);

    return () => {
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice-candidate", onIceCandidate);
      socket.off("webrtc:peer:left", onPeerLeft);
    };
  }, [socket, isInitiator]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    ...state,
    startCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}
