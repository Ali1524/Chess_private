import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { connectSocket } from "../services/socket";
import type { AppSocket } from "../services/socket";

type PageState = "form" | "waiting" | "error";

export default function CreateGamePage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [pageState, setPageState] = useState<PageState>("form");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [socket, setSocket] = useState<AppSocket | null>(null);

  useEffect(() => {
    const s = connectSocket();
    setSocket(s);

    const onRoomCreated = (payload: { roomId: string; sessionId: string; color: "w" | "b" }) => {
      setRoomId(payload.roomId);
      setPageState("waiting");
      // Persist session
      sessionStorage.setItem(
        `chess-session-${payload.roomId}`,
        JSON.stringify({ sessionId: payload.sessionId, roomId: payload.roomId, color: payload.color, displayName })
      );
    };

    const onRoomError = (payload: { code: string; message: string }) => {
      setError(payload.message);
      setPageState("error");
    };

    const onGameState = (payload: { status: string; id: string }) => {
      if (payload.status === "READY" || payload.status === "PLAYING") {
        navigate(`/game/${payload.id}`);
      }
    };

    s.on("room:created", onRoomCreated);
    s.on("room:error", onRoomError);
    s.on("game:state", onGameState);

    return () => {
      s.off("room:created", onRoomCreated);
      s.off("room:error", onRoomError);
      s.off("game:state", onGameState);
    };
  }, [navigate, displayName]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setError("");
    socket?.emit("room:create", { displayName: displayName.trim() });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <button
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 text-text-secondary hover:text-text-primary transition-colors text-sm flex items-center gap-2"
      >
        ← Back
      </button>

      <div className="text-accent text-4xl mb-8 select-none">♔</div>

      {pageState === "form" && (
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-light text-text-primary mb-8 text-center">Create a Game</h2>

          <form onSubmit={handleCreate} className="flex flex-col gap-4">
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

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={!displayName.trim()}
              className="w-full py-4 bg-accent hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed text-bg font-semibold text-lg rounded-lg transition-colors duration-200"
            >
              Create Game
            </button>
          </form>
        </div>
      )}

      {pageState === "waiting" && (
        <div className="w-full max-w-sm text-center">
          <h2 className="text-2xl font-light text-text-primary mb-2">Your Game</h2>
          <p className="text-text-secondary text-sm mb-8">Share this code with your opponent</p>

          <div className="bg-panel border border-border rounded-xl p-8 mb-6">
            <div className="text-5xl font-mono font-bold text-accent tracking-widest mb-6">
              {roomId}
            </div>

            <button
              onClick={handleCopy}
              className="w-full py-3 bg-bg hover:bg-border border border-border rounded-lg text-text-primary transition-colors text-sm font-medium"
            >
              {copied ? "✓ Copied!" : "Copy Code"}
            </button>
          </div>

          <div className="flex items-center justify-center gap-3 text-text-secondary text-sm">
            <span className="animate-pulse">●</span>
            <span>Waiting for opponent…</span>
          </div>

          <p className="mt-4 text-text-secondary text-xs opacity-60">
            Playing as White
          </p>
        </div>
      )}

      {pageState === "error" && (
        <div className="w-full max-w-sm text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => { setPageState("form"); setError(""); }}
            className="text-accent hover:underline text-sm"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
