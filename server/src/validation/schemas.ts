import { z } from "zod";

export const TimeControlSchema = z.object({
  initialTimeMs: z
    .number()
    .int()
    .min(30_000, "Minimum 30 seconds")
    .max(60 * 60 * 1000, "Maximum 60 minutes"),
  incrementMs: z.number().int().min(0).max(60_000),
});

export const RoomCreateSchema = z.object({
  displayName: z
    .string()
    .min(1, "Display name required")
    .max(20, "Display name too long")
    .regex(/^[a-zA-Z0-9_\- ]+$/, "Invalid characters in display name")
    .transform((s) => s.trim()),
  timeControl: TimeControlSchema.optional(),
});

export const RoomJoinSchema = z.object({
  roomId: z
    .string()
    .length(6, "Room code must be 6 characters")
    .regex(/^[A-Z0-9]+$/, "Invalid room code"),
  displayName: z
    .string()
    .min(1, "Display name required")
    .max(20, "Display name too long")
    .regex(/^[a-zA-Z0-9_\- ]+$/, "Invalid characters in display name")
    .transform((s) => s.trim()),
  sessionId: z.string().uuid().optional(),
});

const FILE_RANK = /^[a-h][1-8]$/;
const PROMOTION_PIECE = /^[qrbn]$/;

export const GameMoveSchema = z.object({
  from: z.string().regex(FILE_RANK, "Invalid from square"),
  to: z.string().regex(FILE_RANK, "Invalid to square"),
  promotion: z.string().regex(PROMOTION_PIECE, "Invalid promotion piece").optional(),
  expectedSequence: z.number().int().nonnegative(),
});

export const GameResignSchema = z.object({
  confirmed: z.literal(true, { errorMap: () => ({ message: "Must confirm resignation" }) }),
});

export const DrawRespondSchema = z.object({
  accepted: z.boolean(),
});

export const ChatMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(500, "Message too long")
    .transform((s) => s.trim()),
});

// RTCSessionDescriptionInit-compatible
const RTCSessionDescriptionSchema = z.object({
  type: z.enum(["offer", "answer", "pranswer", "rollback"]),
  sdp: z.string().optional(),
});

const RTCIceCandidateSchema = z.object({
  candidate: z.string(),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().nullable().optional(),
  usernameFragment: z.string().nullable().optional(),
});

export const WebRTCOfferSchema = z.object({
  offer: RTCSessionDescriptionSchema,
});

export const WebRTCAnswerSchema = z.object({
  answer: RTCSessionDescriptionSchema,
});

export const WebRTCIceCandidateSchema = z.object({
  candidate: RTCIceCandidateSchema,
});

export const GameSyncSchema = z.object({
  expectedSequence: z.number().int().nonnegative().optional(),
});

export type ValidatedRoomCreate = z.infer<typeof RoomCreateSchema>;
export type ValidatedRoomJoin = z.infer<typeof RoomJoinSchema>;
export type ValidatedGameMove = z.infer<typeof GameMoveSchema>;
export type ValidatedGameResign = z.infer<typeof GameResignSchema>;
export type ValidatedDrawRespond = z.infer<typeof DrawRespondSchema>;
export type ValidatedChatMessage = z.infer<typeof ChatMessageSchema>;
export type ValidatedWebRTCOffer = z.infer<typeof WebRTCOfferSchema>;
export type ValidatedWebRTCAnswer = z.infer<typeof WebRTCAnswerSchema>;
export type ValidatedWebRTCIceCandidate = z.infer<typeof WebRTCIceCandidateSchema>;
