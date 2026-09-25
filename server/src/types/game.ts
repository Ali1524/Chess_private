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
  winner: PlayerColor | null; // null = draw
  reason: GameResultReason;
  finalFen: string;
}

export interface PlayerSession {
  sessionId: string;
  socketId: string;
  playerId: string;
  displayName: string;
  color: PlayerColor;
  connected: boolean;
  disconnectedAt: number | null;
}

export interface ChessState {
  fen: string;
  turn: PlayerColor;
  moveHistory: string[]; // SAN notation
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

export interface GameRoom {
  id: string;
  status: RoomStatus;
  players: {
    white: PlayerSession | null;
    black: PlayerSession | null;
  };
  chess: ChessState;
  clock: ClockState;
  result: GameResult | null;
  drawOffer: DrawOffer | null;
  rematch: RematchState;
  createdAt: number;
  lastActivityAt: number;
  clockInterval: ReturnType<typeof setInterval> | null;
  // Lock to prevent race conditions
  operationLock: boolean;
}

export interface TimeControl {
  initialTimeMs: number;
  incrementMs: number;
}

export const DEFAULT_TIME_CONTROL: TimeControl = {
  initialTimeMs: 10 * 60 * 1000, // 10 minutes
  incrementMs: 0,
};

export interface ChatMessage {
  id: string;
  playerId: string;
  displayName: string;
  message: string;
  timestamp: number;
}

// Socket event payloads - Client to Server
export interface RoomCreatePayload {
  displayName: string;
  timeControl?: TimeControl;
}

export interface RoomJoinPayload {
  roomId: string;
  displayName: string;
  sessionId?: string; // For reconnection
}

export interface GameMovePayload {
  from: string;
  to: string;
  promotion?: string;
  expectedSequence: number;
}

export interface GameResignPayload {
  confirmed: boolean;
}

export interface DrawRespondPayload {
  accepted: boolean;
}

export interface ChatMessagePayload {
  message: string;
}

export interface RTCSessionDescriptionLike {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp?: string;
}

export interface RTCIceCandidateLike {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface WebRTCOfferPayload {
  offer: RTCSessionDescriptionLike;
}

export interface WebRTCAnswerPayload {
  answer: RTCSessionDescriptionLike;
}

export interface WebRTCIceCandidatePayload {
  candidate: RTCIceCandidateLike;
}

export interface GameSyncPayload {
  expectedSequence?: number;
}

// Socket event payloads - Server to Client
export interface RoomCreatedPayload {
  roomId: string;
  sessionId: string;
  color: PlayerColor;
}

export interface RoomJoinedPayload {
  roomId: string;
  sessionId: string;
  color: PlayerColor;
  roomState: RoomStatePayload;
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

export interface PublicPlayerInfo {
  playerId: string;
  displayName: string;
  color: PlayerColor;
  connected: boolean;
}

export interface GameMoveAcceptedPayload {
  chess: ChessState;
  clock: ClockState;
  move: {
    from: string;
    to: string;
    san: string;
    promotion?: string;
  };
}

export interface GameFinishedPayload {
  result: GameResult;
  chess: ChessState;
  clock: ClockState;
}

export interface ClockUpdatePayload {
  clock: ClockState;
}

export interface PlayerStatusPayload {
  playerId: string;
  color: PlayerColor;
  connected: boolean;
  displayName: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "NOT_YOUR_TURN"
  | "INVALID_MOVE"
  | "GAME_FINISHED"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "SESSION_INVALID"
  | "INVALID_PAYLOAD"
  | "DRAW_NO_OFFER"
  | "ALREADY_OFFERED_DRAW"
  | "GAME_NOT_STARTED"
  | "INVALID_STATE_TRANSITION"
  | "SERVER_ERROR";
