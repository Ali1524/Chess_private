import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { connectSocket } from "../services/socket";
import type { AppSocket } from "../services/socket";
import type { PlayerColor, LocalSession, RoomStatePayload, PublicPlayerInfo } from "../types/game";
import { useChessGame } from "../hooks/useChessGame";
import { useGameClock } from "../hooks/useGameClock";
import { useWebRTC } from "../hooks/useWebRTC";
import { useSocket } from "../hooks/useSocket";
import ChessBoard from "../components/chess/ChessBoard";
import PromotionDialog from "../components/chess/PromotionDialog";
import GameControls from "../components/chess/GameControls";
import GameResultOverlay from "../components/chess/GameResultOverlay";
import PlayerClock from "../components/players/PlayerClock";
import ChatPanel from "../components/chat/ChatPanel";
import VideoCallPanel from "../components/video/VideoCallPanel";
import ConnectionStatus from "../components/common/ConnectionStatus";
import MoveHistory from "../components/chess/MoveHistory";

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [myColor, setMyColor] = useState<PlayerColor | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const { connectionState } = useSocket();

  // Initialize socket and session
  useEffect(() => {
    if (!roomId) {
      navigate("/");
      return;
    }

    const s = connectSocket();
    setSocket(s);

    // Restore session from sessionStorage
    const stored = sessionStorage.getItem(`chess-session-${roomId}`);
    if (!stored) {
      navigate("/");
      return;
    }

    let session: LocalSession;
    try {
      session = JSON.parse(stored) as LocalSession;
    } catch {
      navigate("/");
      return;
    }

    setMyColor(session.color);

    // Listen for join confirmation
    const onRoomJoined = (payload: { roomId: string; sessionId: string; color: PlayerColor; roomState: RoomStatePayload }) => {
      setMyColor(payload.color);
      setInitialized(true);

      // Determine player ID
      const myPlayer = payload.color === "w" ? payload.roomState.players.white : payload.roomState.players.black;
      if (myPlayer) setMyPlayerId(myPlayer.playerId);

      const status = payload.roomState.status;
      setWaitingForOpponent(status === "WAITING");
    };

    const onRoomCreated = (payload: { roomId: string; sessionId: string; color: PlayerColor }) => {
      setMyColor(payload.color);
      setWaitingForOpponent(true);
      setInitialized(true);
    };

    const onRoomError = (payload: { code: string; message: string }) => {
      setRoomError(payload.message);
    };

    const onGameState = (payload: RoomStatePayload) => {
      setInitialized(true);
      if (payload.status !== "WAITING") {
        setWaitingForOpponent(false);
      } else {
        setWaitingForOpponent(true);
      }

      // Extract our player ID from state
      const myPlayer = session.color === "w" ? payload.players.white : payload.players.black;
      if (myPlayer) setMyPlayerId(myPlayer.playerId);
    };

    const onSyncResponse = (payload: RoomStatePayload) => {
      setInitialized(true);
      setWaitingForOpponent(payload.status === "WAITING");
      const myPlayer = session.color === "w" ? payload.players.white : payload.players.black;
      if (myPlayer) setMyPlayerId(myPlayer.playerId);
    };

    s.on("room:joined", onRoomJoined);
    s.on("room:created", onRoomCreated);
    s.on("room:error", onRoomError);
    s.on("game:state", onGameState);
    s.on("game:sync:response", onSyncResponse);

    // Attempt reconnection if disconnected or page refresh
    const attemptJoin = () => {
      s.emit("room:join", {
        roomId: session.roomId,
        displayName: session.displayName,
        sessionId: session.sessionId,
      });
    };

    if (s.connected) {
      attemptJoin();
    } else {
      s.once("connect", attemptJoin);
    }

    // Handle reconnect
    s.io.on("reconnect", attemptJoin);

    return () => {
      s.off("room:joined", onRoomJoined);
      s.off("room:created", onRoomCreated);
      s.off("room:error", onRoomError);
      s.off("game:state", onGameState);
      s.off("game:sync:response", onSyncResponse);
      s.io.off("reconnect", attemptJoin);
    };
  }, [roomId, navigate]);

  if (!socket || !roomId) return null;

  if (roomError) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{roomError}</p>
          <button onClick={() => navigate("/")} className="text-accent hover:underline">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-secondary animate-pulse">Connecting…</div>
      </div>
    );
  }

  return (
    <GameView
      socket={socket}
      roomId={roomId}
      myColor={myColor}
      myPlayerId={myPlayerId}
      connectionState={connectionState}
      waitingForOpponent={waitingForOpponent}
      setWaitingForOpponent={setWaitingForOpponent}
      onLeave={() => {
        socket.emit("room:leave");
        sessionStorage.removeItem(`chess-session-${roomId}`);
        navigate("/");
      }}
    />
  );
}

interface GameViewProps {
  socket: AppSocket;
  roomId: string;
  myColor: PlayerColor | null;
  myPlayerId: string | null;
  connectionState: string;
  waitingForOpponent: boolean;
  setWaitingForOpponent: (v: boolean) => void;
  onLeave: () => void;
}

function GameView({
  socket,
  myColor,
  myPlayerId,
  connectionState,
  waitingForOpponent,
  onLeave,
}: GameViewProps) {
  const {
    state,
    selectSquare,
    initiateMove,
    attemptMove,
    clearSelection,
    resign,
    offerDraw,
    respondDraw,
    requestRematch,
  } = useChessGame(socket, myColor);

  const clock = useGameClock(state.clock);

  const isInitiator = myColor === "w";
  const rtc = useWebRTC(socket, isInitiator);

  const chess = state.chess;
  const room = state.room;
  const isGameActive = room?.status === "PLAYING" || room?.status === "READY";
  const isMyTurn = chess?.turn === myColor && isGameActive && !state.result;
  const myPlayer: PublicPlayerInfo | null = myColor === "w" ? room?.players.white ?? null : room?.players.black ?? null;
  const opponentPlayer: PublicPlayerInfo | null = myColor === "w" ? room?.players.black ?? null : room?.players.white ?? null;

  const handleBoardClick = useCallback(
    (square: string, pieceColor: PlayerColor | null) => {
      if (!chess || !myColor || state.result) return;
      if (chess.turn !== myColor) return;

      const selected = state.selectedSquare;

      if (!selected) {
        if (pieceColor === myColor) {
          selectSquare(square, pieceColor);
        }
        return;
      }

      if (selected === square) {
        clearSelection();
        return;
      }

      if (pieceColor === myColor) {
        selectSquare(square, pieceColor);
        return;
      }

      initiateMove(selected, square);
    },
    [chess, myColor, state.selectedSquare, state.result, initiateMove, selectSquare, clearSelection]
  );

  // Disconnect banner
  const showDisconnectBanner = !state.opponentConnected && isGameActive;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-accent text-xl select-none">♔</span>
          <span className="text-text-primary font-medium tracking-wide hidden sm:block">Private Chess</span>
        </div>
        <ConnectionStatus state={connectionState as "connected" | "connecting" | "disconnected" | "error"} />
      </header>

      {/* Disconnect banner */}
      {showDisconnectBanner && (
        <div className="bg-yellow-900 border-b border-yellow-700 px-4 py-2 text-yellow-300 text-sm text-center animate-pulse">
          Opponent disconnected — waiting for reconnection…
        </div>
      )}

      {/* Game error toast */}
      {state.gameError && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-900 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm shadow-lg">
          {state.gameError}
        </div>
      )}

      {/* Main layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 md:p-6 min-h-0">

        {/* Left: Board + clocks + controls */}
        <div className="flex flex-col items-center gap-3 flex-1">

          {/* Waiting overlay */}
          {waitingForOpponent && (
            <div className="w-full bg-panel border border-border rounded-lg px-6 py-4 text-center">
              <div className="animate-pulse text-text-secondary text-sm flex items-center justify-center gap-2">
                <span>●</span>
                <span>Waiting for opponent to join…</span>
              </div>
            </div>
          )}

          {/* Opponent clock */}
          <div className="w-full max-w-[512px]">
            <PlayerClock
              player={opponentPlayer}
              timeMs={myColor === "w" ? clock.blackMs : clock.whiteMs}
              isActive={clock.activeColor !== myColor && clock.activeColor !== null}
              isMe={false}
              color={myColor === "w" ? "b" : "w"}
            />
          </div>

          {/* Board */}
          <div className="relative">
            {chess && myColor && (
              <ChessBoard
                fen={chess.fen}
                myColor={myColor}
                turn={chess.turn}
                selectedSquare={state.selectedSquare}
                lastMove={state.lastMove}
                isCheck={chess.isCheck}
                onSquareClick={handleBoardClick}
                disabled={!isMyTurn || !!state.result || waitingForOpponent}
              />
            )}
            {state.result && chess && myColor && (
              <GameResultOverlay
                result={state.result}
                myColor={myColor}
                rematch={state.rematch}
                onRematch={requestRematch}
                onLeave={onLeave}
              />
            )}
          </div>

          {/* My clock */}
          <div className="w-full max-w-[512px]">
            <PlayerClock
              player={myPlayer}
              timeMs={myColor === "w" ? clock.whiteMs : clock.blackMs}
              isActive={clock.activeColor === myColor}
              isMe
              color={myColor ?? "w"}
            />
          </div>

          {/* Move history */}
          <div className="w-full max-w-[512px]">
            <MoveHistory moves={chess?.moveHistory ?? []} />
          </div>

          {/* Game controls */}
          <div className="w-full max-w-[512px]">
            <GameControls
              myColor={myColor ?? "w"}
              drawOffer={state.drawOffer}
              gameActive={!!isGameActive && !state.result}
              onResign={resign}
              onOfferDraw={offerDraw}
              onRespondDraw={respondDraw}
            />
          </div>
        </div>

        {/* Right sidebar: video + chat */}
        <div className="lg:w-80 xl:w-96 flex flex-col gap-3">
          <VideoCallPanel
            callState={rtc.callState}
            localStream={rtc.localStream}
            remoteStream={rtc.remoteStream}
            isMuted={rtc.isMuted}
            isCameraOff={rtc.isCameraOff}
            error={rtc.error}
            onStartCall={rtc.startCall}
            onEndCall={rtc.endCall}
            onToggleMute={rtc.toggleMute}
            onToggleCamera={rtc.toggleCamera}
          />

          <div className="flex-1 min-h-0" style={{ minHeight: "300px" }}>
            <ChatPanel
              socket={socket}
              myPlayerId={myPlayerId}
            />
          </div>
        </div>
      </div>

      {/* Promotion dialog */}
      {state.promotionPending && myColor && (
        <PromotionDialog
          color={myColor}
          onSelect={(piece) => {
            if (state.promotionPending) {
              attemptMove(state.promotionPending.from, state.promotionPending.to, piece);
            }
          }}
          onCancel={clearSelection}
        />
      )}
    </div>
  );
}
