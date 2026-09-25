import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { connectSocket } from "../services/socket";
import type { AppSocket } from "../services/socket";
import type { RoomStatePayload } from "../types/game";

export default function JoinGamePage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code?: string }>();
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState(code ?? "");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [socket, setSocket] = useState<AppSocket | null>(null);

  // Keep displayName in closure for event handlers
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;

  useEffect(() => {
    const s = connectSocket();
    setSocket(s);

    const onRoomJoined = (payload: { roomId: string; sessionId: string; color: "w" | "b"; roomState: RoomStatePayload }) => {
      sessionStorage.setItem(
        `chess-session-${payload.roomId}`,
        JSON.stringify({
          sessionId: payload.sessionId,
          roomId: payload.roomId,
          color: payload.color,
          displayName: displayNameRef.current,
        })
      );
      navigate(`/game/${payload.roomId}`);
    };

    const onRoomError = (payload: { code: string; message: string }) => {
      setError(payload.message);
      setJoining(false);
    };

    s.on("room:joined", onRoomJoined);
    s.on("room:error", onRoomError);

    return () => {
      s.off("room:joined", onRoomJoined);
      s.off("room:error", onRoomError);
    };
  }, [navigate]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !roomCode.trim()) return;
    setError("");
    setJoining(true);
    socket?.emit("room:join", {
      displayName: displayName.trim(),
      roomId: roomCode.trim().toUpperCase(),
    });
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <button
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 text-text-secondary hover:text-text-primary transition-colors text-sm flex items-center gap-2"
      >
        ← Back
      </button>

      <div className="text-accent text-4xl mb-8 select-none">♚</div>

      <div className="w-full max-w-sm">
        <h2 className="text-2xl font-light text-text-primary mb-8 text-center">Join a Game</h2>

        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <div>
            <label className="block text-text-secondary text-sm mb-2">Your Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              className="w-full px-4 py-3 bg-panel border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-2">Game Code</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. X7K92Q"
              maxLength={6}
              className="w-full px-4 py-3 bg-panel border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent transition-colors font-mono text-xl tracking-widest text-center uppercase"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!displayName.trim() || roomCode.length !== 6 || joining}
            className="w-full py-4 bg-accent hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed text-bg font-semibold text-lg rounded-lg transition-colors duration-200"
          >
            {joining ? "Joining…" : "Join Game"}
          </button>
        </form>
      </div>
    </div>
  );
}
