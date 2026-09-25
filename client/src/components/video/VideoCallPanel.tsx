import { useEffect, useRef } from "react";
import type { CallState } from "../../hooks/useWebRTC";

interface VideoCallPanelProps {
  callState: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  error: string | null;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
}

function VideoElement({ stream, muted = false, label }: { stream: MediaStream | null; muted?: boolean; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) {
    return (
      <div className="w-full aspect-video bg-bg rounded-lg flex items-center justify-center border border-border">
        <div className="text-center">
          <div className="text-3xl mb-1 opacity-30">📷</div>
          <p className="text-text-secondary text-xs">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-1 left-2 text-white text-xs opacity-70">{label}</div>
    </div>
  );
}

const STATE_LABELS: Record<CallState, string> = {
  idle: "Start Video Call",
  "requesting-permissions": "Requesting permissions…",
  "permission-denied": "Permission denied",
  connecting: "Connecting…",
  connected: "Connected",
  disconnected: "Opponent left call",
  failed: "Connection failed",
};

export default function VideoCallPanel({
  callState,
  localStream,
  remoteStream,
  isMuted,
  isCameraOff,
  error,
  onStartCall,
  onEndCall,
  onToggleMute,
  onToggleCamera,
}: VideoCallPanelProps) {
  const isActive = callState === "connecting" || callState === "connected";
  const canStart = callState === "idle" || callState === "disconnected" || callState === "failed";

  return (
    <div className="flex flex-col gap-2 bg-panel rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-text-secondary text-xs font-medium uppercase tracking-wider">Video</h3>
        {callState !== "idle" && (
          <span className={`text-xs ${callState === "connected" ? "text-green-400" : "text-text-secondary"}`}>
            {STATE_LABELS[callState]}
          </span>
        )}
      </div>

      {/* Opponent video */}
      <VideoElement
        stream={remoteStream}
        label="Opponent"
      />

      {/* Local video (small) */}
      {isActive && (
        <VideoElement
          stream={localStream}
          muted
          label="You"
        />
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}

      {/* Controls */}
      <div className="flex gap-2 mt-1">
        {canStart ? (
          <button
            onClick={onStartCall}
            className="flex-1 py-2 bg-accent hover:bg-accent-dim text-bg text-sm font-medium rounded-lg transition-colors"
          >
            📹 Start Call
          </button>
        ) : (
          <>
            <button
              onClick={onToggleMute}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                isMuted
                  ? "bg-red-900 border-red-700 text-red-300"
                  : "bg-bg border-border text-text-secondary hover:text-text-primary"
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? "🔇" : "🎤"}
            </button>
            <button
              onClick={onToggleCamera}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                isCameraOff
                  ? "bg-red-900 border-red-700 text-red-300"
                  : "bg-bg border-border text-text-secondary hover:text-text-primary"
              }`}
              title={isCameraOff ? "Camera on" : "Camera off"}
            >
              {isCameraOff ? "📷" : "📹"}
            </button>
            <button
              onClick={onEndCall}
              className="flex-1 py-2 bg-red-900 hover:bg-red-800 border border-red-700 text-red-300 text-sm rounded-lg transition-colors"
              title="End call"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}
