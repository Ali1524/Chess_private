import type {
  RoomStatePayload,
  GameResult,
  ChessState,
  ClockState,
  ChatMessage,
  DrawOffer,
  RematchState,
  PlayerColor,
} from "./game";

export interface TimeControl {
  initialTimeMs: number;
  incrementMs: number;
}

// Client → Server
export interface ClientToServerEvents {
  "room:create": (payload: { displayName: string; timeControl?: TimeControl }) => void;
  "room:join": (payload: { roomId: string; displayName: string; sessionId?: string }) => void;
  "room:leave": () => void;

  "game:move": (payload: { from: string; to: string; promotion?: string; expectedSequence: number }) => void;
  "game:resign": (payload: { confirmed: true }) => void;
  "game:draw:offer": () => void;
  "game:draw:respond": (payload: { accepted: boolean }) => void;
  "game:rematch": () => void;
  "game:sync": (payload: { expectedSequence?: number }) => void;

  "chat:message": (payload: { message: string }) => void;

  "webrtc:offer": (payload: { offer: RTCSessionDescriptionInit }) => void;
  "webrtc:answer": (payload: { answer: RTCSessionDescriptionInit }) => void;
  "webrtc:ice-candidate": (payload: { candidate: RTCIceCandidateInit }) => void;
}

// Server → Client
export interface ServerToClientEvents {
  "room:created": (payload: { roomId: string; sessionId: string; color: PlayerColor }) => void;
  "room:joined": (payload: { roomId: string; sessionId: string; color: PlayerColor; roomState: RoomStatePayload }) => void;
  "room:state": (payload: RoomStatePayload) => void;
  "room:error": (payload: { code: string; message: string }) => void;

  "game:state": (payload: RoomStatePayload) => void;
  "game:move:accepted": (payload: {
    chess: ChessState;
    clock: ClockState;
    move: { from: string; to: string; san: string; promotion?: string };
  }) => void;
  "game:finished": (payload: { result: GameResult; chess: ChessState; clock: ClockState }) => void;
  "game:draw:offered": (payload: DrawOffer) => void;
  "game:draw:declined": () => void;
  "game:rematch:state": (payload: RematchState) => void;
  "game:clock": (payload: { clock: ClockState }) => void;
  "game:error": (payload: { code: string; message: string }) => void;
  "game:sync:response": (payload: RoomStatePayload) => void;

  "chat:message": (payload: ChatMessage) => void;
  "chat:error": (payload: { code: string; message: string }) => void;

  "player:connected": (payload: { playerId: string; color: PlayerColor; connected: boolean; displayName: string }) => void;
  "player:disconnected": (payload: { playerId: string; color: PlayerColor; connected: boolean; displayName: string }) => void;

  "webrtc:offer": (payload: { offer: RTCSessionDescriptionInit }) => void;
  "webrtc:answer": (payload: { answer: RTCSessionDescriptionInit }) => void;
  "webrtc:ice-candidate": (payload: { candidate: RTCIceCandidateInit }) => void;
  "webrtc:peer:left": () => void;
}

export interface PlayerStatusPayload {
  playerId: string;
  color: PlayerColor;
  connected: boolean;
  displayName: string;
}
