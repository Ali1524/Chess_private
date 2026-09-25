import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      {/* Logo / Crown */}
      <div className="mb-8 text-accent text-6xl select-none">♔</div>

      <h1 className="text-4xl md:text-5xl font-light text-text-primary tracking-wide mb-3 text-center">
        Private Chess
      </h1>

      <p className="text-text-secondary text-lg mb-2 text-center font-light">
        Chess. Just You &amp; Your Opponent.
      </p>
      <p className="text-text-secondary text-sm mb-12 text-center">
        A private room for two. No accounts. No distractions.
      </p>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => navigate("/create")}
          className="w-full py-4 bg-accent hover:bg-accent-dim text-bg font-semibold text-lg rounded-lg transition-colors duration-200 tracking-wide"
        >
          Create Game
        </button>

        <button
          onClick={() => navigate("/join")}
          className="w-full py-4 bg-panel hover:bg-border text-text-primary font-semibold text-lg rounded-lg border border-border transition-colors duration-200 tracking-wide"
        >
          Join Game
        </button>
      </div>

      <p className="mt-16 text-text-secondary text-xs text-center opacity-40">
        Private Chess · Real-time · WebRTC
      </p>
    </div>
  );
}
