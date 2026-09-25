export type PlayerColor = "w" | "b";
export type RoomStatus = "WAITING" | "READY" | "PLAYING" | "FINISHED" | "EXPIRED";
export type GameResultReason =
  | "CHECKMATE"
  | "STALEMATE"
  | "DRAW_AGREEMENT"
  | "RESIGNATION"
  | "TIMEOUT"
  | "THREEFOLD_REPETITION"
  | "INSUFFICIENT_MATERIAL"
  | "FIFTY_MOVE_RULE";

export interface GameResult {
  winner: PlayerColor | null;
  reason: GameResultReason;
  finalFen: string;
}

export interface PublicPlayerInfo {
  playerId: string;
  displayName: string;
  color: PlayerColor;
  connected: boolean;
}

export interface ChessState {
  fen: string;
  turn: PlayerColor;
  moveHistory: string[];
  pgn: string;
  sequence: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
}

export interface ClockState {
  whiteRemainingMs: number;
  blackRemainingMs: number;
  activeColor: PlayerColor | null;
  turnStartedAt: number | null;
  incrementMs: number;
}

export interface DrawOffer {
  offeredBy: PlayerColor;
  offeredAt: number;
}

export interface RematchState {
  white: boolean;
  black: boolean;
}

export interface RoomStatePayload {
  id: string;
  status: RoomStatus;
  players: {
    white: PublicPlayerInfo | null;
    black: PublicPlayerInfo | null;
  };
  chess: ChessState;
  clock: ClockState;
  result: GameResult | null;
  drawOffer: DrawOffer | null;
  rematch: RematchState;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  displayName: string;
  message: string;
  timestamp: number;
}

// Local session state stored in sessionStorage
export interface LocalSession {
  sessionId: string;
  roomId: string;
  color: PlayerColor;
  displayName: string;
}
