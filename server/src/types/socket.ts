import type {
  RoomCreatePayload,
  RoomJoinPayload,
  GameMovePayload,
  GameResignPayload,
  DrawRespondPayload,
  ChatMessagePayload,
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  WebRTCIceCandidatePayload,
  GameSyncPayload,
  RoomCreatedPayload,
  RoomJoinedPayload,
  RoomStatePayload,
  GameMoveAcceptedPayload,
  GameFinishedPayload,
  ClockUpdatePayload,
  PlayerStatusPayload,
  ErrorPayload,
  ChatMessage,
  DrawOffer,
  RematchState,
  RTCSessionDescriptionLike,
  RTCIceCandidateLike,
} from "./game.js";

export interface ClientToServerEvents {
  "room:create": (payload: RoomCreatePayload) => void;
  "room:join": (payload: RoomJoinPayload) => void;
  "room:leave": () => void;

  "game:move": (payload: GameMovePayload) => void;
  "game:resign": (payload: GameResignPayload) => void;
  "game:draw:offer": () => void;
  "game:draw:respond": (payload: DrawRespondPayload) => void;
  "game:rematch": () => void;
  "game:sync": (payload: GameSyncPayload) => void;

  "chat:message": (payload: ChatMessagePayload) => void;

  "webrtc:offer": (payload: WebRTCOfferPayload) => void;
  "webrtc:answer": (payload: WebRTCAnswerPayload) => void;
  "webrtc:ice-candidate": (payload: WebRTCIceCandidatePayload) => void;
}

export interface ServerToClientEvents {
  "room:created": (payload: RoomCreatedPayload) => void;
  "room:joined": (payload: RoomJoinedPayload) => void;
  "room:state": (payload: RoomStatePayload) => void;
  "room:error": (payload: ErrorPayload) => void;

  "game:state": (payload: RoomStatePayload) => void;
  "game:move:accepted": (payload: GameMoveAcceptedPayload) => void;
  "game:finished": (payload: GameFinishedPayload) => void;
  "game:draw:offered": (payload: DrawOffer) => void;
  "game:draw:declined": () => void;
  "game:rematch:state": (payload: RematchState) => void;
  "game:clock": (payload: ClockUpdatePayload) => void;
  "game:error": (payload: ErrorPayload) => void;
  "game:sync:response": (payload: RoomStatePayload) => void;

  "chat:message": (payload: ChatMessage) => void;
  "chat:error": (payload: ErrorPayload) => void;

  "player:connected": (payload: PlayerStatusPayload) => void;
  "player:disconnected": (payload: PlayerStatusPayload) => void;

  "webrtc:offer": (payload: { offer: RTCSessionDescriptionLike }) => void;
  "webrtc:answer": (payload: { answer: RTCSessionDescriptionLike }) => void;
  "webrtc:ice-candidate": (payload: { candidate: RTCIceCandidateLike }) => void;
  "webrtc:peer:left": () => void;
}

export interface SocketData {
  sessionId: string;
  roomId: string;
  playerId: string;
  color: "w" | "b";
}
